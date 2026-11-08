/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guessExercise } from './exerciseGuess';
import { csvStatesWeightUnit, detectCsvFormat, parseHevyDate, parseWorkoutCsv } from './workoutCsv';
import { KG_PER_LB } from './units';

// Header as in a real Hevy "Export Workouts" file.
const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push Day","22 Dec 2025, 08:00","22 Dec 2025, 09:05","Felt strong","Bench Press (Barbell)",,"Paused",0,"warmup",60,10,,0,
"Push Day","22 Dec 2025, 08:00","22 Dec 2025, 09:05","Felt strong","Bench Press (Barbell)",,"Paused",1,"normal",100,5,,0,8.5
"Push Day","22 Dec 2025, 08:00","22 Dec 2025, 09:05","Felt strong","Bench Press (Barbell)",,"Paused",2,"dropset",80,8,,0,
"Push Day","22 Dec 2025, 08:00","22 Dec 2025, 09:05","Felt strong","Lateral Raise (Dumbbell)",0,"",0,"normal",10,15,,0,
"Push Day","22 Dec 2025, 08:00","22 Dec 2025, 09:05","Felt strong","Triceps Pushdown (Cable)",0,"",0,"failure",30,12,,0,
"Push Day","22 Dec 2025, 08:00","22 Dec 2025, 09:05","Felt strong","Plank",,"",0,"normal",,,,60,
"Evening Run","23 Dec 2025, 18:30","23 Dec 2025, 19:00","","Running",,"",0,"normal",,,5.2,1800,
`;

// Columns as FitNotes writes them (read by name, so their order doesn't matter).
const FITNOTES = `Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time
2024-05-01,Flat Barbell Bench Press,Chest,100.0,kgs,5,,,
2024-05-01,Flat Barbell Bench Press,Chest,100.0,kgs,5,,,
2024-05-01,Rope Push Down,Triceps,25.0,kgs,12,,,
2024-05-01,Incline Hammer Strength Press,Chest,40.0,kgs,10,,,
2024-05-03,Treadmill Run,Cardio,,,,5.0,km,0:30:00
2024-05-03,Barbell Squat,Legs,225.0,lbs,5,,,
2024-05-03,Single Leg Curl,Legs,30.0,kgs,10,,,
`;

describe('detecting the app an export came from', () => {
  it('recognises Strong, Hevy and FitNotes by their columns', () => {
    assert.equal(detectCsvFormat(HEVY), 'hevy');
    assert.equal(detectCsvFormat(FITNOTES), 'fitnotes');
    assert.equal(detectCsvFormat('Date,Workout Name,Exercise Name,Set Order,Weight,Reps\n'), 'strong');
    assert.equal(detectCsvFormat('foo,bar\n1,2'), null);
    assert.throws(() => parseWorkoutCsv('foo,bar\n1,2', 'metric'), /Strong, Hevy or FitNotes/);
  });

  it('knows when the file states its weight unit', () => {
    assert.equal(csvStatesWeightUnit(HEVY), true);
    assert.equal(csvStatesWeightUnit(FITNOTES), true);
    assert.equal(csvStatesWeightUnit('Date,Workout Name,Exercise Name,Set Order,Weight,Reps\n'), false);
  });
});

describe('Hevy', () => {
  it('reads its dates as local time', () => {
    assert.equal(parseHevyDate('22 Dec 2025, 08:00'), new Date(2025, 11, 22, 8, 0).getTime());
    assert.ok(Number.isNaN(parseHevyDate('')));
  });

  it('groups sets into workouts and exercises, with set types, supersets, holds and runs', () => {
    const { workouts, format } = parseWorkoutCsv(HEVY, 'imperial');
    assert.equal(format, 'hevy');
    assert.equal(workouts.length, 2);
    const [push, run] = workouts;
    assert.equal(push.name, 'Push Day');
    assert.equal(push.notes, 'Felt strong');
    assert.equal(push.durationS, 65 * 60);
    assert.deepEqual(
      push.exercises.map((e) => [e.name, e.sets.length, e.supersetGroup ?? null]),
      [
        ['Bench Press (Barbell)', 3, null],
        ['Lateral Raise (Dumbbell)', 1, 1],
        ['Triceps Pushdown (Cable)', 1, 1],
        ['Plank', 1, null],
      ],
    );
    const bench = push.exercises[0];
    assert.equal(bench.notes, 'Paused');
    assert.deepEqual(
      bench.sets.map((s) => [s.setType, s.weight, s.reps, s.rpe]),
      [
        ['warmup', 60, 10, null],
        ['normal', 100, 5, 8.5],
        ['drop', 80, 8, null],
      ],
      'weight_kg is kg whatever the fallback unit',
    );
    assert.equal(push.exercises[2].sets[0].setType, 'failure');
    assert.deepEqual(push.exercises[3].sets[0], { setType: 'normal', weight: null, reps: null, durationS: 60, distanceM: null, rpe: null });
    assert.equal(run.exercises[0].sets[0].distanceM, 5200);
    assert.equal(run.exercises[0].sets[0].durationS, 1800);
  });

  it('converts weight_lbs files to kg', () => {
    const lbs = HEVY.replace('"weight_kg"', '"weight_lbs"');
    const w = parseWorkoutCsv(lbs, 'metric').workouts[0].exercises[0].sets[1].weight!;
    assert.ok(Math.abs(w - 100 * KG_PER_LB) < 1e-9);
  });
});

describe('FitNotes', () => {
  it('makes one workout per day, named after the body parts trained', () => {
    const { workouts, format } = parseWorkoutCsv(FITNOTES, 'metric');
    assert.equal(format, 'fitnotes');
    assert.deepEqual(
      workouts.map((w) => w.name),
      ['Chest & Triceps', 'Cardio & Legs'],
    );
    assert.equal(workouts[0].startedAt, new Date(2024, 4, 1, 12, 0).getTime());
    assert.equal(workouts[0].durationS, 0);
  });

  it('maps its built-in exercise names onto ours and keeps its categories for new ones', () => {
    const [day1, day2] = parseWorkoutCsv(FITNOTES, 'metric').workouts;
    assert.deepEqual(
      day1.exercises.map((e) => [e.name, e.sets.length, e.bodyPartHint]),
      [
        ['Bench Press (Barbell)', 2, 'Chest'],
        ['Rope Pushdown (Cable)', 1, 'Triceps'],
        ['Incline Hammer Strength Press', 1, 'Chest'],
      ],
    );
    const [run, squat, curl] = day2.exercises;
    assert.equal(run.sets[0].distanceM, 5000);
    assert.equal(run.sets[0].durationS, 1800);
    assert.equal(run.bodyPartHint, 'Cardio');
    assert.equal(squat.name, 'Squat (Barbell)');
    assert.ok(Math.abs(squat.sets[0].weight! - 225 * KG_PER_LB) < 1e-9, 'the unit column wins');
    assert.equal(curl.bodyPartHint, 'Hamstrings', '"Legs" defers to the name when it says more');
  });
});

describe('guessing equipment from names', () => {
  it('reads equipment words when there is no "(Equipment)" suffix', () => {
    assert.equal(guessExercise('Cable Lateral Raise', []).equipment, 'Cable');
    assert.equal(guessExercise('Incline Hammer Strength Press', []).equipment, 'Machine');
    assert.equal(guessExercise('EZ-Bar Curl', []).equipment, 'EZ Bar');
    assert.equal(guessExercise('Smith Machine Squat', []).equipment, 'Smith Machine');
    assert.equal(guessExercise('Bench Press (Dumbbell)', []).equipment, 'Dumbbell', 'the suffix still wins');
  });
});
