/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  computeProgress,
  heroClass,
  heroLevel,
  rankFor,
  setXp,
  statLevel,
  statWeights,
  xpForHeroLevel,
  type ExerciseKind,
  type ProgressWorkout,
} from './rpg';
import type { SetData } from './types';

const set = (weight: number | null, reps: number | null, extra: Partial<SetData> = {}): SetData => ({
  setType: 'normal',
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
  ...extra,
});

const BENCH: ExerciseKind = { type: 'weight_reps', bodyPart: 'Chest', category: 'strength' };
const ROW: ExerciseKind = { type: 'weight_reps', bodyPart: 'Back', category: 'strength' };
const SQUAT: ExerciseKind = { type: 'weight_reps', bodyPart: 'Quads', category: 'strength' };
const PLANK: ExerciseKind = { type: 'duration', bodyPart: 'Core', category: 'strength' };
const RUN: ExerciseKind = { type: 'distance_duration', bodyPart: 'Cardio', category: 'cardio' };
const STRETCH: ExerciseKind = { type: 'duration', bodyPart: 'Hamstrings', category: 'stretching' };

// Monday 2 June 2025, noon local time; weeks start on Monday.
const MONDAY = new Date(2025, 5, 2, 12).getTime();
const DAY = 86_400_000;

let nextId = 1;
const workout = (startedAt: number, exercises: [number, ExerciseKind, SetData[]][]): ProgressWorkout => ({
  id: nextId++,
  startedAt,
  exercises: exercises.map(([exerciseId, kind, sets]) => ({ exerciseId, ...kind, sets })),
});
const benchDay = (startedAt: number, weight = 60, sets = 5) =>
  workout(startedAt, [[1, BENCH, Array.from({ length: sets }, () => set(weight, 5))]]);

describe('setXp', () => {
  test('rep sets earn a flat amount, warm-ups less, empty sets nothing', () => {
    assert.equal(setXp(BENCH, set(100, 5)), 10);
    assert.equal(setXp(BENCH, set(20, 10, { setType: 'warmup' })), 3);
    assert.equal(setXp(BENCH, set(100, null)), 0);
    assert.equal(setXp(BENCH, set(100, 0)), 0);
  });

  test('holds scale with time between a floor and a cap', () => {
    assert.equal(setXp(PLANK, set(null, null, { durationS: 60 })), 10);
    assert.equal(setXp(PLANK, set(null, null, { durationS: 10 })), 4);
    assert.equal(setXp(PLANK, set(null, null, { durationS: 600 })), 20);
    assert.equal(setXp(PLANK, set(null, null)), 0);
  });

  test('cardio earns per minute, or per km when only distance is logged', () => {
    assert.equal(setXp(RUN, set(null, null, { durationS: 30 * 60, distanceM: 5000 })), 120);
    assert.equal(setXp(RUN, set(null, null, { distanceM: 5000 })), 100);
    assert.equal(setXp(RUN, set(null, null, { durationS: 5 * 3600 })), 360);
  });
});

describe('statWeights', () => {
  test('category wins over body part, and weights add up to 1', () => {
    assert.deepEqual(statWeights(STRETCH), { agility: 1 });
    assert.deepEqual(statWeights(RUN), { stamina: 1 });
    assert.deepEqual(statWeights(BENCH), { might: 1 });
    for (const kind of [BENCH, RUN, STRETCH, { type: 'weight_reps', bodyPart: 'Full Body', category: 'strongman' } as ExerciseKind]) {
      const sum = Object.values(statWeights(kind)).reduce((a, b) => a + b, 0);
      assert.equal(sum, 1);
    }
  });
});

describe('levels', () => {
  test('hero level thresholds', () => {
    assert.equal(heroLevel(0).level, 1);
    assert.equal(heroLevel(99).level, 1);
    assert.equal(heroLevel(100).level, 2);
    assert.equal(heroLevel(299).level, 2);
    assert.equal(heroLevel(300).level, 3);
    for (const l of [2, 5, 10, 37, 99]) {
      assert.equal(heroLevel(xpForHeroLevel(l)).level, l);
      assert.equal(heroLevel(xpForHeroLevel(l) - 1).level, l - 1);
    }
  });

  test('progress within a level, and the cap', () => {
    const info = heroLevel(200);
    assert.deepEqual([info.level, info.into, info.span, info.progress], [2, 100, 200, 0.5]);
    const max = heroLevel(10_000_000);
    assert.deepEqual([max.level, max.progress], [99, 1]);
    assert.equal(statLevel(40).level, 2);
  });

  test('ranks follow level', () => {
    assert.equal(rankFor(1).letter, 'E');
    assert.equal(rankFor(9).letter, 'D');
    assert.equal(rankFor(10).letter, 'C');
    assert.equal(rankFor(99).letter, 'SSS');
  });

  test('class follows the strongest stat, or Paragon when balanced', () => {
    const zero = { might: 0, grip: 0, drive: 0, fortitude: 0, stamina: 0, agility: 0 };
    assert.equal(heroClass(zero).name, 'Newcomer');
    assert.equal(heroClass({ ...zero, drive: 500 }).name, 'Juggernaut');
    assert.equal(heroClass({ might: 400, grip: 420, drive: 450, fortitude: 300, stamina: 300, agility: 280 }).name, 'Paragon');
  });
});

describe('computeProgress', () => {
  test('a first workout earns set XP plus the workout bonus, and levels up', () => {
    const w = benchDay(MONDAY);
    const p = computeProgress([w], MONDAY + 1000);
    const r = p.rewards.get(w.id)!;
    assert.equal(r.setXp, 50);
    assert.equal(r.workoutXp, 50);
    assert.equal(r.records, 0, 'nothing is a record without history');
    assert.equal(r.streakXp, 0);
    assert.equal(r.total, 100);
    assert.deepEqual([r.levelBefore, r.levelAfter], [1, 2]);
    assert.equal(p.xp, 100);
    assert.equal(p.level.level, 2);
    assert.equal(p.stats.might.xp, 50);
    assert.deepEqual(r.stats, [{ stat: 'might', xp: 50, levelBefore: 1, levelAfter: 2 }]);
    assert.equal(p.heroClass.name, 'Vanguard');
  });

  test('beating records pays a bonus to the hero and the stat, once per exercise', () => {
    const a = benchDay(MONDAY, 60);
    const b = benchDay(MONDAY + DAY, 70);
    const p = computeProgress([b, a], MONDAY + 2 * DAY);
    const r = p.rewards.get(b.id)!;
    // 70 × 5 beats the est. 1RM, heaviest weight and best set volume: still one bonus.
    assert.equal(r.records, 1);
    assert.equal(r.recordXp, 25);
    assert.equal(r.xpBefore, 100);
    // sets 50 + record 25 + workout 50 + the "Break a limit" quest 50
    assert.equal(r.total, 175);
    assert.deepEqual(r.quests.map((q) => q.id), ['record']);
    assert.equal(p.stats.might.xp, 50 + 50 + 25);
    assert.equal(p.records, 1);
  });

  test('the same exercise twice in a workout is compared against earlier workouts only', () => {
    const a = benchDay(MONDAY, 60);
    const b = workout(MONDAY + DAY, [
      [1, BENCH, [set(70, 5)]],
      [1, BENCH, [set(70, 5)]],
    ]);
    assert.equal(computeProgress([a, b], MONDAY + 2 * DAY).rewards.get(b.id)!.records, 1);
  });

  test('weekly quests: three workouts, and four stats', () => {
    const w1 = workout(MONDAY, [
      [1, BENCH, [set(60, 5), set(60, 5)]],
      [2, ROW, [set(60, 5), set(60, 5)]],
    ]);
    const w2 = workout(MONDAY + DAY, [
      [3, SQUAT, [set(80, 5), set(80, 5)]],
      [4, PLANK, [set(null, null, { durationS: 60 }), set(null, null, { durationS: 60 })]],
    ]);
    const w3 = benchDay(MONDAY + 2 * DAY, 60, 1);
    const p = computeProgress([w1, w2, w3], MONDAY + 3 * DAY);
    assert.deepEqual(p.rewards.get(w1.id)!.quests, []);
    assert.deepEqual(p.rewards.get(w2.id)!.quests, [{ id: 'rounded', title: 'Well-rounded', reward: 75 }]);
    assert.deepEqual(p.rewards.get(w3.id)!.quests.map((q) => q.id), ['showUp']);
    assert.deepEqual(
      p.quests.map((q) => [q.id, q.progress, q.done]),
      [
        ['showUp', 3, true],
        ['record', 0, false],
        ['rounded', 4, true],
      ],
    );
    // Quest XP goes to the hero, not to any stat.
    assert.equal(p.xp, (40 + 50) + (40 + 50 + 75) + (10 + 50 + 100));
    assert.equal(p.stats.might.xp, 30);
  });

  test('quests reset each week, and a quest pays out once', () => {
    const list = [0, 1, 2, 3].map((d) => benchDay(MONDAY + d * DAY, 60, 1));
    const p = computeProgress(list, MONDAY + 7 * DAY);
    assert.equal([...p.rewards.values()].filter((r) => r.quests.length > 0).length, 1);
    assert.deepEqual(p.quests.map((q) => q.progress), [0, 0, 0]);
  });

  test('streak: consecutive weeks add up to 25% to set XP and reset after a missed week', () => {
    const weeks = [0, 1, 2, 3, 4, 5, 6, 7].map((w) => benchDay(MONDAY + w * 7 * DAY, 60, 10));
    const p = computeProgress(weeks, MONDAY + 7 * 7 * DAY + 1000);
    assert.deepEqual(
      weeks.map((w) => p.rewards.get(w.id)!.streakXp),
      [0, 5, 10, 15, 20, 25, 25, 25],
    );
    assert.equal(p.rewards.get(weeks[7].id)!.streakWeeks, 8);
    assert.equal(p.streakWeeks, 8);

    // The next week has no workout yet: the streak is still alive.
    assert.equal(computeProgress(weeks, MONDAY + 8 * 7 * DAY).streakWeeks, 8);
    // A whole week missed: it's gone, and the next workout starts over.
    assert.equal(computeProgress(weeks, MONDAY + 9 * 7 * DAY).streakWeeks, 0);
    const later = benchDay(MONDAY + 9 * 7 * DAY, 60, 10);
    const p2 = computeProgress([...weeks, later], MONDAY + 9 * 7 * DAY + 1000);
    assert.equal(p2.rewards.get(later.id)!.streakXp, 0);
    assert.equal(p2.streakWeeks, 1);
    assert.equal(p2.bestStreak, 8);
  });

  test('empty history and empty workouts', () => {
    const p = computeProgress([], MONDAY);
    assert.equal(p.level.level, 1);
    assert.equal(p.rank.letter, 'E');
    assert.equal(p.heroClass.name, 'Newcomer');
    assert.equal(p.achievements.filter((a) => a.unlocked).length, 0);

    const empty = workout(MONDAY, [[1, BENCH, [set(null, null)]]]);
    const p2 = computeProgress([empty], MONDAY + 1000);
    assert.equal(p2.rewards.get(empty.id)!.total, 0);
    assert.equal(p2.workouts, 0);
  });

  test('achievements unlock from totals', () => {
    const p = computeProgress([benchDay(MONDAY, 100, 3)], MONDAY + 1000);
    const byId = new Map(p.achievements.map((a) => [a.id, a]));
    assert.equal(byId.get('w1')!.unlocked, true);
    assert.equal(byId.get('w10')!.value, 1);
    assert.equal(byId.get('v1')!.unlocked, true, '3 × 100 kg × 5 = 1,500 kg');
    assert.equal(byId.get('r1')!.unlocked, false);
  });
});
