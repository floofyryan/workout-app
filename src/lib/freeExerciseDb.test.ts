/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { SEED_EXERCISES, SEED_STRETCH_TEMPLATES } from '../data/exercises';
import { FREE_EXERCISE_DB_LINKS } from '../data/freeExerciseDbMap';
import { holdDuration, newActiveExercise, newActiveSet } from './activeWorkout';
import { guessExercise } from './exerciseGuess';
import { displayName, toBodyPart, toEquipment, toExerciseType, type FreeExercise } from './freeExerciseDb';
import { exerciseCategory } from './types';

const data: FreeExercise[] = JSON.parse(
  readFileSync(new URL('../data/freeExerciseDb.json', import.meta.url), 'utf8'),
);
const byId = new Map(data.map((e) => [e.id, e]));

describe('free-exercise-db links', () => {
  it('only reference built-in exercises and existing dataset ids', () => {
    const seedNames = new Set(SEED_EXERCISES.map((s) => s.name));
    for (const [name, id] of Object.entries(FREE_EXERCISE_DB_LINKS)) {
      assert.ok(seedNames.has(name), `unknown built-in exercise "${name}"`);
      assert.ok(byId.has(id), `unknown dataset id "${id}"`);
    }
  });

  it('every plain bodyweight built-in is tracked as reps only', () => {
    for (const s of SEED_EXERCISES) {
      if (s.equipment !== 'Bodyweight' || /\((Weighted|Assisted)\)/.test(s.name)) continue;
      assert.ok(s.type === 'reps' || s.type === 'duration', `${s.name} is ${s.type}`);
    }
  });

  it('starter stretch routines only use stretches from the dataset', () => {
    const stretches = new Set(data.filter((e) => e.category === 'stretching').map(displayName));
    for (const t of SEED_STRETCH_TEMPLATES) {
      for (const e of t.exercises) assert.ok(stretches.has(e.name), `${t.name}: unknown stretch "${e.name}"`);
    }
  });

  it('imported names do not collide with each other or built-ins', () => {
    const linked = new Set(Object.values(FREE_EXERCISE_DB_LINKS));
    const seen = new Set(SEED_EXERCISES.map((s) => s.name.toLowerCase()));
    for (const e of data) {
      if (linked.has(e.id)) continue;
      const n = displayName(e).toLowerCase();
      assert.ok(!seen.has(n), `duplicate name ${n}`);
      seen.add(n);
    }
  });
});

describe('free-exercise-db conversion', () => {
  const base: FreeExercise = {
    id: 'x',
    name: 'Hammer Curl',
    equipment: 'dumbbell',
    category: 'strength',
    level: 'beginner',
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    instructions: [],
    images: [],
  };
  it('maps equipment, body part and naming', () => {
    assert.equal(toEquipment(base), 'Dumbbell');
    assert.equal(toBodyPart(base), 'Biceps');
    assert.equal(toExerciseType(base), 'weight_reps');
    assert.equal(displayName(base), 'Hammer Curl (Dumbbell)');
    assert.equal(displayName({ ...base, name: 'Dumbbell Shrug' }), 'Dumbbell Shrug');
  });
  it('puts Olympic lifts and strongman events under Full Body, neck work under Neck', () => {
    assert.equal(toBodyPart({ ...base, category: 'olympic weightlifting', primaryMuscles: ['quadriceps'] }), 'Full Body');
    assert.equal(toBodyPart({ ...base, category: 'strongman', primaryMuscles: ['forearms'] }), 'Full Body');
    assert.equal(toBodyPart({ ...base, primaryMuscles: ['neck'] }), 'Neck');
    assert.equal(toBodyPart({ ...base, category: 'stretching', primaryMuscles: ['hamstrings'] }), 'Hamstrings');
  });
  it('derives the exercise type used by the type filter', () => {
    assert.equal(exerciseCategory({ category: 'stretching', bodyPart: 'Hamstrings' }), 'stretching');
    assert.equal(exerciseCategory({ category: 'powerlifting', bodyPart: 'Chest' }), 'strength');
    assert.equal(exerciseCategory({ category: null, bodyPart: 'Cardio' }), 'cardio');
    assert.equal(exerciseCategory({ category: null, bodyPart: 'Back' }), 'strength');
  });
  it('tracks bodyweight movements as reps and stretches as time', () => {
    assert.equal(toExerciseType({ ...base, equipment: 'body only' }), 'reps');
    assert.equal(toExerciseType({ ...base, equipment: null }), 'reps');
    assert.equal(toExerciseType({ ...base, equipment: null, category: 'stretching' }), 'duration');
  });
  it('guesses reps only for imported bodyweight exercises', () => {
    const set = { setType: 'normal' as const, weight: 10, reps: 8, durationS: null, distanceM: null, rpe: null };
    assert.equal(guessExercise('Dragon Flag (Bodyweight)', [set]).type, 'reps');
    assert.equal(guessExercise('Dip (Weighted)', [set]).type, 'weighted_bodyweight');
  });
});

describe('holdDuration', () => {
  it('uses the target, then last time, then the set above, then one minute', () => {
    const ex = newActiveExercise(1, 0);
    ex.sets = [newActiveSet({ durationS: 45 }), newActiveSet(), newActiveSet()];
    assert.equal(holdDuration(ex, 0), 45);
    const last = (durationS: number) => ({ setType: 'normal' as const, weight: null, reps: null, durationS, distanceM: null, rpe: null });
    assert.equal(holdDuration(ex, 1, [last(30), last(90)]), 90);
    assert.equal(holdDuration(ex, 1), 45);
    assert.equal(holdDuration(ex, 2), 60);
  });
});
