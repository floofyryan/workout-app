/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { newActiveSet, type ActiveWorkout } from './activeWorkout';
import {
  characterFrom,
  dungeonRooms,
  levelFromXp,
  monsterFor,
  nextEncounter,
  setXp,
  statShares,
  xpForLevel,
} from './rpg';
import type { SetData } from './types';

const set = (weight: number | null, reps: number | null, setType: SetData['setType'] = 'normal'): SetData => ({
  setType,
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

describe('setXp', () => {
  it('rewards heavier and longer sets', () => {
    assert.ok(setXp('weight_reps', set(100, 5)) > setXp('weight_reps', set(60, 5)));
    assert.ok(setXp('weight_reps', set(60, 10)) > setXp('weight_reps', set(60, 5)));
  });
  it('gives warm-ups less and failure sets more', () => {
    const normal = setXp('weight_reps', set(80, 5));
    assert.ok(setXp('weight_reps', set(80, 5, 'warmup')) < normal);
    assert.ok(setXp('weight_reps', set(80, 5, 'failure')) > normal);
  });
  it('scores holds by time', () => {
    assert.equal(setXp('duration', { ...set(null, null), durationS: 60 }), 20);
  });
  it('gives the base XP for an empty set', () => assert.equal(setXp('reps', set(null, null)), 10));
});

describe('levels', () => {
  it('starts at level 1', () => assert.deepEqual(levelFromXp(0), { level: 1, into: 0, span: 100 }));
  it('levels up exactly at the threshold', () => {
    for (const l of [2, 3, 10, 50]) {
      assert.equal(levelFromXp(xpForLevel(l)).level, l);
      assert.equal(levelFromXp(xpForLevel(l) - 1).level, l - 1);
    }
  });
  it('reports progress into the level', () => {
    const info = levelFromXp(xpForLevel(4) + 30);
    assert.equal(info.into, 30);
    assert.equal(info.span, xpForLevel(5) - xpForLevel(4));
  });
});

describe('character', () => {
  it('maps exercises to attributes', () => {
    assert.deepEqual(statShares({ type: 'weight_reps', bodyPart: 'Quads', category: 'strength' }), { CON: 1 });
    assert.deepEqual(statShares({ type: 'duration', bodyPart: 'Hamstrings', category: 'stretching' }), { WIS: 1 });
    assert.deepEqual(statShares({ type: 'distance_duration', bodyPart: 'Cardio', category: null }), { STA: 1 });
    assert.deepEqual(statShares({ type: 'weight_reps', bodyPart: 'Full Body', category: null }), { STR: 0.5, CON: 0.5 });
  });
  it('picks a class from the strongest attribute', () => {
    const c = characterFrom([
      { type: 'weight_reps', bodyPart: 'Chest', category: null, set: set(100, 5) },
      { type: 'weight_reps', bodyPart: 'Quads', category: null, set: set(60, 5) },
      { type: 'weight_reps', bodyPart: 'Chest', category: null, set: set(40, 10, 'warmup') },
    ]);
    assert.equal(c.className, 'Barbarian');
    assert.equal(c.title, 'Novice Barbarian');
    assert.equal(c.slain, 2);
    assert.ok(c.stats.STR.xp > c.stats.CON.xp);
    assert.equal(c.stats.WIS.value, 1);
  });
  it('is an adventurer before any training', () => {
    const c = characterFrom([]);
    assert.equal(c.className, 'Adventurer');
    assert.equal(c.level.level, 1);
  });
});

describe('monsterFor', () => {
  const squat = { type: 'weight_reps' as const, bodyPart: 'Quads' as const, category: 'strength' };
  const sets = [set(40, 10, 'warmup'), set(100, 5), set(100, 5), set(100, 5)];
  it('makes warm-ups slimes', () => assert.equal(monsterFor(squat, sets, 0).kind, 'slime'));
  it('uses the body part family', () => assert.equal(monsterFor(squat, sets, 1).kind, 'ogre'));
  it('crowns the last working set', () => {
    assert.equal(monsterFor(squat, sets, 2).elite, false);
    const last = monsterFor(squat, sets, 3);
    assert.equal(last.elite, true);
    assert.equal(last.name, 'Ogre Chieftain');
  });
  it('turns sets to failure into dragons', () => {
    const m = monsterFor(squat, [...sets, set(100, 8, 'failure')], 4);
    assert.equal(m.kind, 'dragon');
    assert.equal(m.boss, true);
  });
  it('fills blank planned values from last time', () => {
    assert.equal(monsterFor(squat, [set(null, null)], 0, [set(100, 5)]).xp, setXp('weight_reps', set(100, 5)));
  });
});

describe('nextEncounter', () => {
  const ex = (key: string, done: boolean[], supersetId: string | null = null) => ({
    key,
    exerciseId: 1,
    notes: '',
    restSeconds: null,
    supersetId,
    sets: done.map((completed, i) => ({ ...newActiveSet(), key: `${key}${i}`, completed })),
  });
  const workout = (exercises: ReturnType<typeof ex>[]): ActiveWorkout => ({
    name: '',
    notes: '',
    startedAt: 0,
    templateId: null,
    exercises,
  });

  it('goes room by room', () => {
    const w = workout([ex('a', [true, true]), ex('b', [true, false, false])]);
    const e = nextEncounter(w);
    assert.equal(e?.setKey, 'b1');
    assert.equal(e?.room, 2);
    assert.equal(e?.rooms, 2);
  });
  it('alternates within a superset', () => {
    const w = workout([ex('a', [true, false], 's'), ex('b', [false, false], 's'), ex('c', [false])]);
    assert.deepEqual(dungeonRooms(w), [[0, 1], [2]]);
    assert.equal(nextEncounter(w)?.setKey, 'b0');
    w.exercises[1].sets[0].completed = true;
    assert.equal(nextEncounter(w)?.setKey, 'a1');
  });
  it('is null when every set is done', () => {
    assert.equal(nextEncounter(workout([ex('a', [true])])), null);
    assert.equal(nextEncounter(workout([])), null);
  });
});
