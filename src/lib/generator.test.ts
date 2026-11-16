/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SEED_EXERCISES } from '../data/exercises';
import { GEAR, generateProgram, recommendedSplit, type GenerateOptions } from './generator';
import type { Exercise } from './types';

const library = SEED_EXERCISES.map((e, i) => ({ id: i + 1, name: e.name, equipment: e.equipment, type: e.type, archived: false }));
const byId = new Map(library.map((e) => [e.id, e]));

const opts = (o: Partial<GenerateOptions> = {}): GenerateOptions => ({
  gear: [...GEAR],
  split: 'ppl',
  goal: 'muscle',
  weekdays: [0, 2, 4],
  seed: 0,
  ...o,
});

describe('workout generator', () => {
  test('every exercise it can pick exists in the built-in library', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('./generator.ts', import.meta.url), 'utf8'));
    const block = src.slice(src.indexOf('const PATTERNS'), src.indexOf('satisfies Record'));
    const names = [...block.matchAll(/\['([^']+)'/g)].map((m) => m[1]);
    assert.ok(names.length > 50);
    const known = new Set(SEED_EXERCISES.map((e) => e.name));
    assert.deepEqual(names.filter((n) => !known.has(n)), []);
  });

  test('full gym push/pull/legs fills every slot without repeats in a day', () => {
    const p = generateProgram(opts(), library);
    assert.deepEqual(p.workouts.map((w) => w.name), ['Push', 'Pull', 'Legs']);
    for (const w of p.workouts) {
      assert.equal(w.exercises.length, 6, w.name);
      assert.equal(new Set(w.exercises.map((e) => e.exerciseId)).size, 6);
    }
    assert.equal(p.workouts[0].exercises[0].name, 'Bench Press (Barbell)');
    assert.deepEqual(p.schedule, [
      { weekday: 0, workout: 0 },
      { weekday: 2, workout: 1 },
      { weekday: 4, workout: 2 },
    ]);
  });

  test('bodyweight only picks bodyweight exercises that need no extra gear', () => {
    const p = generateProgram(opts({ gear: [], split: 'full_body' }), library);
    const picked = p.workouts.flatMap((w) => w.exercises.map((e) => byId.get(e.exerciseId)!));
    assert.ok(picked.length >= 10);
    for (const e of picked) assert.equal(e.equipment, 'Bodyweight', e.name);
    for (const banned of ['Pull Up (Bodyweight)', 'Bench Dip (Bodyweight)', 'Hanging Leg Raise (Bodyweight)']) {
      assert.ok(!picked.some((e) => e.name === banned), banned);
    }
  });

  test('dumbbells and a bench never need a barbell or machine', () => {
    const p = generateProgram(opts({ gear: ['Dumbbell', 'Bench'], split: 'upper_lower', weekdays: [0, 1, 3, 4] }), library);
    assert.equal(p.workouts.length, 4);
    const picked = p.workouts.flatMap((w) => w.exercises.map((e) => byId.get(e.exerciseId)!));
    for (const e of picked) assert.ok(['Dumbbell', 'Bodyweight'].includes(e.equipment), e.name);
  });

  test('goal decides sets, reps and timed holds', () => {
    const strength = generateProgram(opts({ goal: 'strength', split: 'full_body' }), library);
    const squat = strength.workouts[0].exercises[0];
    assert.equal(squat.name, 'Squat (Barbell)');
    assert.equal(squat.sets.length, 5);
    assert.equal(squat.sets[0].reps, 5);
    const plank = generateProgram(opts({ gear: [], split: 'full_body' }), library)
      .workouts.flatMap((w) => w.exercises)
      .find((e) => (byId.get(e.exerciseId) as Pick<Exercise, 'type'>).type === 'duration');
    assert.ok(plank?.sets[0].durationS);
  });

  test('fewer days than workouts uses the first ones; more days cycle', () => {
    assert.equal(generateProgram(opts({ split: 'upper_lower', weekdays: [1, 4] }), library).workouts.length, 2);
    const six = generateProgram(opts({ weekdays: [0, 1, 2, 3, 4, 5] }), library);
    assert.deepEqual(six.schedule.map((s) => s.workout), [0, 1, 2, 0, 1, 2]);
  });

  test('the same seed gives the same program, others can differ', () => {
    const a = generateProgram(opts({ seed: 7 }), library);
    assert.deepEqual(generateProgram(opts({ seed: 7 }), library), a);
    const names = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(generateProgram(opts({ seed }), library).workouts.map((w) => w.exercises.map((e) => e.name)))),
    );
    assert.ok(names.size > 1);
  });

  test('recommended split by days per week', () => {
    assert.deepEqual([2, 3, 4, 5, 6].map(recommendedSplit), ['full_body', 'full_body', 'upper_lower', 'ppl', 'ppl']);
  });
});
