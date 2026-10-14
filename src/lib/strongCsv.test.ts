/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCsv } from './csv';
import { guessExercise } from './exerciseGuess';
import { parseStrongCsv, parseStrongDuration, workoutsToStrongCsv } from './strongCsv';
import { KG_PER_LB } from './units';

const COMMA_EXPORT = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-01 07:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",W,60,10,0,0,"","Felt good",
2024-03-01 07:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",1,100,5,0,0,"Paused reps","Felt good",8
2024-03-01 07:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",Rest Timer,0,0,0,120,"","Felt good",
2024-03-01 07:30:00,"Push Day",1h 5m,"Plank (Bodyweight)",1,0,0,0,60,"","Felt good",
2024-03-03 18:00:00,"Run",30m,"Running (Outdoor)",1,0,0,5,1800,"","",
`;

const SEMICOLON_EXPORT = `Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration
2020-01-05 10:00:00;Legs;Squat (Barbell);1;225;lbs;5;;;;0;;;45m
2020-01-05 10:00:00;Legs;Squat (Barbell);2;225;lbs;5;;;;0;;;45m
`;

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and newlines', () => {
    assert.deepEqual(parseCsv('a,"b ""x""","c\nd"\n1,2,3\n'), [
      ['a', 'b "x"', 'c\nd'],
      ['1', '2', '3'],
    ]);
  });
  it('detects semicolons', () => {
    assert.deepEqual(parseCsv('a;b\n1;2'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseStrongDuration', () => {
  it('parses common formats', () => {
    assert.equal(parseStrongDuration('1h 5m'), 3900);
    assert.equal(parseStrongDuration('45m'), 2700);
    assert.equal(parseStrongDuration('90'), 90);
    assert.equal(parseStrongDuration('1:00:30'), 3630);
  });
});

describe('parseStrongCsv', () => {
  it('groups rows into workouts and exercises', () => {
    const { workouts, skippedRows } = parseStrongCsv(COMMA_EXPORT, 'metric');
    assert.equal(skippedRows, 1); // rest timer row
    assert.equal(workouts.length, 2);
    const [push, run] = workouts;
    assert.equal(push.name, 'Push Day');
    assert.equal(push.durationS, 3900);
    assert.equal(push.notes, 'Felt good');
    assert.equal(push.exercises.length, 2);
    const bench = push.exercises[0];
    assert.equal(bench.sets.length, 2);
    assert.equal(bench.sets[0].setType, 'warmup');
    assert.equal(bench.sets[1].weight, 100);
    assert.equal(bench.sets[1].rpe, 8);
    assert.equal(bench.notes, 'Paused reps');
    assert.equal(push.exercises[1].sets[0].durationS, 60);
    assert.equal(run.exercises[0].sets[0].distanceM, 5000);
  });

  it('converts pounds to kilograms using the unit column', () => {
    const { workouts } = parseStrongCsv(SEMICOLON_EXPORT, 'metric');
    assert.equal(workouts.length, 1);
    assert.equal(workouts[0].durationS, 2700);
    const w = workouts[0].exercises[0].sets[0].weight!;
    assert.ok(Math.abs(w - 225 * KG_PER_LB) < 1e-9);
  });

  it('rejects files that are not Strong exports', () => {
    assert.throws(() => parseStrongCsv('foo,bar\n1,2', 'metric'));
  });

  it('round-trips through the exporter', () => {
    const { workouts } = parseStrongCsv(COMMA_EXPORT, 'metric');
    const again = parseStrongCsv(workoutsToStrongCsv(workouts, 'imperial'), 'metric').workouts;
    assert.equal(again.length, workouts.length);
    const a = workouts[0].exercises[0].sets[1];
    const b = again[0].exercises[0].sets[1];
    assert.ok(Math.abs(a.weight! - b.weight!) < 0.01);
    assert.equal(b.reps, 5);
    assert.equal(again[0].exercises[0].sets[0].setType, 'warmup');
    assert.ok(Math.abs(again[1].exercises[0].sets[0].distanceM! - 5000) < 1);
  });
});

describe('guessExercise', () => {
  const s = (weight: number | null, reps: number | null, durationS: number | null = null, distanceM: number | null = null) => ({
    setType: 'normal' as const,
    weight,
    reps,
    durationS,
    distanceM,
    rpe: null,
  });
  it('reads equipment from the name', () => {
    assert.deepEqual(guessExercise('Zercher Squat (Barbell)', [s(100, 5)]), {
      equipment: 'Barbell',
      bodyPart: 'Quads',
      type: 'weight_reps',
    });
  });
  it('detects assisted and cardio movements', () => {
    assert.equal(guessExercise('Dip (Assisted)', [s(20, 8)]).type, 'assisted_bodyweight');
    assert.equal(guessExercise('Leg Curl (Cable)', [s(20, 8)]).bodyPart, 'Hamstrings');
    const run = guessExercise('Trail Running', [s(null, null, 1800, 5000)]);
    assert.equal(run.type, 'distance_duration');
    assert.equal(run.bodyPart, 'Cardio');
  });
});
