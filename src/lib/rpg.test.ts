/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  BOSS,
  XP,
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
    // Monday 2 June 2025 is a "weak point" day and a newcomer's weakest stat is Might, so the
    // daily quest pays too; and muscles that were never trained are rested (10% of set XP).
    assert.deepEqual(r.bonuses, [
      { label: 'Daily quest: Weak point', xp: 30 },
      { label: 'Rested muscles', xp: 5 },
    ]);
    assert.equal(r.total, 135);
    assert.deepEqual([r.xpBefore, r.xpAfter], [0, 135]);
    assert.deepEqual([r.levelBefore, r.levelAfter], [1, 2]);
    assert.equal(p.xp, 135);
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
    assert.equal(r.xpBefore, 135);
    // sets 50 + record 25 + workout 50 + the "Break a limit" quest 50; Might was trained a day
    // ago so there is no rested bonus, and Tuesday's daily quest is about stretching.
    assert.deepEqual(r.bonuses, []);
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
    // Quest XP goes to the hero, not to any stat. Bonuses: Monday's daily quest (30) and rested
    // muscles (4), rested legs and core on Tuesday (4), and Might rested again by Wednesday (1).
    assert.equal(p.xp, (40 + 50 + 34) + (40 + 50 + 75 + 4) + (10 + 50 + 100 + 1));
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
    // A whole week missed: the tokens earned at weeks 4 and 8 would still bridge it…
    assert.equal(computeProgress(weeks, MONDAY + 9 * 7 * DAY).streakWeeks, 8);
    // …but not two missed weeks: it's gone, and the next workout starts over.
    assert.equal(computeProgress(weeks, MONDAY + 10 * 7 * DAY).streakWeeks, 0);
    const later = benchDay(MONDAY + 10 * 7 * DAY, 60, 10);
    const p2 = computeProgress([...weeks, later], MONDAY + 10 * 7 * DAY + 1000);
    assert.equal(p2.rewards.get(later.id)!.streakXp, 0);
    assert.equal(p2.streakWeeks, 1);
    assert.equal(p2.bestStreak, 8);
    assert.equal(p2.streakTokens, 2, 'a reset keeps the tokens');
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

// ---------- Bosses, daily quests, streak tokens, recovery, timeline ----------

const PULLUP: ExerciseKind = { type: 'reps', bodyPart: 'Back', category: 'strength' };
const JUMP: ExerciseKind = { type: 'reps', bodyPart: 'Quads', category: 'plyometrics' };
const HOUR = 3_600_000;
const WEEK = 7 * DAY;
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();
const single = (startedAt: number, exerciseId: number, kind: ExerciseKind, weight: number, extra: Partial<SetData> = {}) =>
  workout(startedAt, [[exerciseId, kind, [set(weight, 1, extra)]]]);
const bonus = (p: ReturnType<typeof computeProgress>, w: ProgressWorkout, label: string) =>
  p.rewards.get(w.id)!.bonuses.filter((b) => b.label.startsWith(label)).reduce((n, b) => n + b.xp, 0);
/** Noon of the first day on or after `from` whose daily quest is of the given kind. */
const dayOfKind = (kind: string, from = MONDAY): number => {
  for (let t = from; ; t += DAY) if (computeProgress([], t).daily.id === kind) return t;
};

describe('boss fights', () => {
  // Bench (1) in three May workouts, squat (3) in one.
  const may = () => [
    single(at(2025, 5, 5), 1, BENCH, 100),
    single(at(2025, 5, 12), 1, BENCH, 100),
    workout(at(2025, 5, 19), [
      [1, BENCH, [set(90, 1)]],
      [3, SQUAT, [set(150, 1)]],
    ]),
  ];

  test('no boss without lifting history from before the month', () => {
    assert.equal(computeProgress([], MONDAY).boss, null);
    const list = may();
    const p = computeProgress(list, at(2025, 5, 20));
    assert.equal(p.boss, null, 'the first month has no baseline');
    assert.equal(p.bossesDefeated, 0);
    // Lifts without an est. 1RM never make a boss.
    const other = [
      workout(at(2025, 5, 5), [
        [5, PULLUP, [set(null, 10)]],
        [6, RUN, [set(null, null, { durationS: 600 })]],
      ]),
    ];
    assert.equal(computeProgress(other, at(2025, 6, 10)).boss, null);
  });

  test('the boss is the most-trained lift, 2.5% above its best est. 1RM', () => {
    const p = computeProgress(may(), at(2025, 6, 10));
    assert.deepEqual(p.boss, {
      exerciseId: 1,
      month: at(2025, 6, 1, 0),
      targetE1rm: 100 * (1 + BOSS.step),
      baselineE1rm: 100,
      bestE1rm: 0,
      reward: 200,
      defeated: false,
    });
    assert.equal(XP.boss, 200);
    assert.equal(BOSS.step, 0.025);
  });

  test('ties go to the lower exercise id, and only the last 60 days count', () => {
    const tie = [
      workout(at(2025, 5, 5), [
        [2, ROW, [set(80, 1)]],
        [1, BENCH, [set(100, 1)]],
      ]),
    ];
    assert.equal(computeProgress(tie, at(2025, 6, 10)).boss!.exerciseId, 1);
    const more = [...tie, single(at(2025, 5, 7), 2, ROW, 80)];
    assert.equal(computeProgress(more, at(2025, 6, 10)).boss!.exerciseId, 2);

    // Squats were frequent in March, but only the bench press falls inside the 60 days before June.
    const old = [3, 5, 7].map((d) => single(at(2025, 3, d), 3, SQUAT, 150));
    const recent = single(at(2025, 5, 20), 1, BENCH, 100);
    assert.equal(computeProgress([...old, recent], at(2025, 6, 10)).boss!.exerciseId, 1);
    // With nothing in the window at all (a long break), there is no boss.
    assert.equal(computeProgress(old, at(2025, 6, 10)).boss, null);
  });

  test('the first workout to reach the target defeats the boss, once', () => {
    const close = single(at(2025, 6, 3), 1, BENCH, 102);
    const warmup = single(at(2025, 6, 4), 1, BENCH, 120, { setType: 'warmup' });
    const wrongLift = single(at(2025, 6, 5), 3, SQUAT, 200);
    const win = single(at(2025, 6, 6), 1, BENCH, 102.5);
    const again = single(at(2025, 6, 9), 1, BENCH, 110);
    const list = [...may(), close, warmup, wrongLift, win, again];

    const before = computeProgress([...may(), close, warmup, wrongLift], at(2025, 6, 5, 18));
    assert.equal(before.boss!.defeated, false);
    assert.equal(before.boss!.bestE1rm, 102);
    assert.equal(before.bossesDefeated, 0);

    const p = computeProgress(list, at(2025, 6, 10));
    for (const w of [close, warmup, wrongLift, again]) assert.equal(bonus(p, w, 'Boss defeated'), 0);
    assert.deepEqual(p.rewards.get(win.id)!.bonuses.filter((b) => b.label === 'Boss defeated'), [{ label: 'Boss defeated', xp: 200 }]);
    assert.equal(p.boss!.defeated, true);
    assert.equal(p.boss!.bestE1rm, 110);
    assert.equal(p.boss!.baselineE1rm, 100, 'the baseline is fixed at the start of the month');
    assert.equal(p.bossesDefeated, 1);

    // The 200 XP go to the hero only: the stat gets the set and the record bonus.
    const r = p.rewards.get(win.id)!;
    assert.deepEqual(r.stats.map((x) => [x.stat, x.xp]), [['might', 10 + 25]]);
    assert.equal(r.total, r.setXp + r.recordXp + r.workoutXp + r.streakXp + r.questXp + r.bonuses.reduce((n, b) => n + b.xp, 0));
    assert.equal(r.xpAfter - r.xpBefore, r.total);

    const byId = new Map(p.achievements.map((a) => [a.id, a]));
    assert.equal(byId.get('b1')!.unlocked, true);
    assert.deepEqual([byId.get('b5')!.value, byId.get('b5')!.unlocked], [1, false]);
  });

  test('reps count through the est. 1RM formula', () => {
    // 90 × 5 → 105 est. 1RM, above the 102.5 target.
    const win = workout(at(2025, 6, 3), [[1, BENCH, [set(90, 5)]]]);
    const p = computeProgress([...may(), win], at(2025, 6, 10));
    assert.equal(bonus(p, win, 'Boss defeated'), 200);
    assert.equal(p.boss!.bestE1rm, 105);
  });

  test('month boundaries: each month gets a fresh boss from what came before it', () => {
    const lastNight = single(at(2025, 5, 31, 23, 30), 1, BENCH, 104);
    const firstMorning = single(at(2025, 6, 1, 0, 30), 1, BENCH, 106);
    const list = [...may(), lastNight, firstMorning];
    const june = computeProgress(list, at(2025, 6, 2));
    assert.equal(june.boss!.month, at(2025, 6, 1, 0));
    assert.equal(june.boss!.baselineE1rm, 104, "31 May counts toward June's baseline");
    assert.equal(june.boss!.bestE1rm, 106);
    assert.equal(june.boss!.defeated, false, '106 is short of 104 × 1.025 = 106.6');
    assert.equal(bonus(june, lastNight, 'Boss defeated'), 0, 'May had no boss');

    // July has no workouts yet: its boss builds on June's best.
    const july = computeProgress(list, at(2025, 7, 3));
    assert.equal(july.boss!.month, at(2025, 7, 1, 0));
    assert.equal(july.boss!.baselineE1rm, 106);
    assert.equal(july.boss!.targetE1rm, 106 * 1.025);
    assert.equal(july.boss!.bestE1rm, 0);
    assert.equal(july.bossesDefeated, 0);

    const juneWin = single(at(2025, 6, 20), 1, BENCH, 107);
    const julyWin = single(at(2025, 7, 1, 0, 10), 1, BENCH, 110);
    const p = computeProgress([...list, juneWin, julyWin], at(2025, 7, 3));
    assert.equal(bonus(p, juneWin, 'Boss defeated'), 200);
    assert.equal(bonus(p, julyWin, 'Boss defeated'), 200);
    assert.equal(p.bossesDefeated, 2);
    assert.equal(p.boss!.baselineE1rm, 107);
    // Looking back from June, only June's boss is the current one.
    assert.equal(computeProgress([...list, juneWin], at(2025, 6, 25)).bossesDefeated, 1);
  });
});

describe('daily quest', () => {
  test('rotates through the four kinds, one per day', () => {
    const kinds = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => computeProgress([], MONDAY + d * DAY).daily.id);
    assert.deepEqual(new Set(kinds.slice(0, 4)), new Set(['sets', 'weakest', 'mobility', 'cardio']));
    assert.deepEqual(kinds.slice(4), kinds.slice(0, 4));
    // The same day always gives the same quest.
    assert.deepEqual(computeProgress([], MONDAY + 3 * HOUR).daily, computeProgress([], MONDAY).daily);
    const d = computeProgress([], dayOfKind('sets')).daily;
    assert.deepEqual(d, { id: 'sets', title: 'Daily training', description: 'Finish 10 sets today', reward: 30, progress: 0, target: 10, done: false, stat: null });
  });

  test('sets: progress adds up over the day and pays once', () => {
    const day = dayOfKind('sets');
    const a = workout(day - 2 * HOUR, [[1, BENCH, [set(20, 10, { setType: 'warmup' }), ...Array.from({ length: 5 }, () => set(60, 5)), set(60, null)]]]);
    const b = benchDay(day, 60, 4);
    const c = benchDay(day + 2 * HOUR, 60, 12);
    const mid = computeProgress([a], day - HOUR);
    assert.deepEqual([mid.daily.progress, mid.daily.target, mid.daily.done], [6, 10, false], 'warm-ups count, empty sets do not');
    assert.equal(bonus(mid, a, 'Daily quest'), 0);

    const p = computeProgress([a, b, c], day + 3 * HOUR);
    assert.equal(bonus(p, a, 'Daily quest'), 0);
    assert.deepEqual(p.rewards.get(b.id)!.bonuses.filter((x) => x.label.startsWith('Daily')), [{ label: 'Daily quest: Daily training', xp: 30 }]);
    assert.equal(bonus(p, c, 'Daily quest'), 0, 'paid once');
    assert.deepEqual([p.daily.progress, p.daily.done], [10, true], 'progress is clamped to the target');

    // The next day starts a new quest from zero.
    const next = computeProgress([a, b, c], day + DAY);
    assert.notEqual(next.daily.id, 'sets');
    assert.deepEqual([next.daily.progress, next.daily.done], [0, false]);
  });

  test('weakest stat: fixed at the start of the day, ties by stat order', () => {
    const day = dayOfKind('weakest');
    assert.equal(computeProgress([], day).daily.stat, 'might');

    // After a bench-only history the first of the untouched stats is Grip.
    const earlier = benchDay(day - 3 * DAY);
    const start = computeProgress([earlier], day);
    assert.deepEqual(
      [start.daily.id, start.daily.title, start.daily.description, start.daily.stat, start.daily.target],
      ['weakest', 'Weak point', 'Earn 20 Grip XP today', 'grip', 20],
    );

    const a = workout(day, [[2, ROW, [set(60, 5)]]]);
    const b = workout(day + HOUR, [
      [2, ROW, [set(50, 5)]],
      [1, BENCH, [set(60, 5)]],
    ]);
    const mid = computeProgress([earlier, a], day + 1000);
    assert.deepEqual([mid.daily.stat, mid.daily.progress, mid.daily.done], ['grip', 10, false], 'still Grip after training it');
    const p = computeProgress([earlier, a, b], day + 2 * HOUR);
    assert.equal(bonus(p, a, 'Daily quest'), 0);
    assert.equal(bonus(p, b, 'Daily quest: Weak point'), 30);
    assert.deepEqual([p.daily.stat, p.daily.progress, p.daily.done], ['grip', 20, true]);
    // Daily XP is hero XP only.
    assert.equal(p.stats.grip.xp, 20);
  });

  test('mobility: two stretching sets', () => {
    const day = dayOfKind('mobility');
    const stretch = (t: number, n: number) => workout(t, [[9, STRETCH, Array.from({ length: n }, () => set(null, null, { durationS: 30 }))]]);
    const lifting = benchDay(day - HOUR, 60, 12);
    const a = stretch(day, 1);
    const b = stretch(day + HOUR, 1);
    const p = computeProgress([lifting, a, b], day + 2 * HOUR);
    assert.equal(bonus(p, lifting, 'Daily quest'), 0);
    assert.equal(bonus(p, a, 'Daily quest'), 0);
    assert.equal(bonus(p, b, 'Daily quest: Limber up'), 30);
    assert.deepEqual([p.daily.id, p.daily.stat, p.daily.progress, p.daily.target, p.daily.done], ['mobility', 'agility', 2, 2, true]);
    // Yesterday's stretching does not count for today.
    const y = stretch(day - DAY, 3);
    assert.equal(computeProgress([y, a], day + HOUR).daily.progress, 1);
  });

  test('cardio: ten minutes, with distance-only sets counted at 5 min per km', () => {
    const day = dayOfKind('cardio');
    const run = (t: number, extra: Partial<SetData>) => workout(t, [[6, RUN, [set(null, null, extra)]]]);
    const a = run(day, { durationS: 6 * 60 + 30 });
    const b = run(day + HOUR, { durationS: 4 * 60 });
    const mid = computeProgress([a], day + 1000);
    assert.deepEqual([mid.daily.id, mid.daily.stat, mid.daily.progress, mid.daily.target, mid.daily.done], ['cardio', 'stamina', 6, 10, false]);
    const p = computeProgress([a, b], day + 2 * HOUR);
    assert.equal(bonus(p, a, 'Daily quest'), 0);
    assert.equal(bonus(p, b, 'Daily quest: Get moving'), 30);
    assert.equal(p.daily.done, true);

    const far = run(day, { distanceM: 2000 });
    assert.equal(bonus(computeProgress([far], day + 1000), far, 'Daily quest'), 30);
    const near = run(day, { distanceM: 1900 });
    assert.equal(bonus(computeProgress([near], day + 1000), near, 'Daily quest'), 0);
  });

  test('completed daily quests count toward achievements', () => {
    const first = dayOfKind('sets');
    const list = [0, 4, 8, 12, 16, 20, 24].map((d) => benchDay(first + d * DAY, 60, 10));
    const p = computeProgress(list, first + 25 * DAY);
    for (const w of list) assert.equal(bonus(p, w, 'Daily quest'), 30);
    const d7 = p.achievements.find((a) => a.id === 'd7')!;
    assert.deepEqual([d7.value, d7.unlocked], [7, true]);
  });
});

describe('streak tokens', () => {
  const weekly = (weeks: number[]) => weeks.map((n) => benchDay(MONDAY + n * WEEK, 60, 10));
  const flags = (p: ReturnType<typeof computeProgress>, list: ProgressWorkout[]) =>
    list.map((w) => {
      const r = p.rewards.get(w.id)!;
      return (r.tokenEarned ? 'E' : '') + (r.tokenUsed ? 'U' : '') || '-';
    });

  test('one token per four weeks of streak, on the workout that gets there', () => {
    const list = weekly([0, 1, 2, 3]);
    const extra = benchDay(MONDAY + 3 * WEEK + DAY);
    const p = computeProgress([...list, extra], MONDAY + 3 * WEEK + 2 * DAY);
    assert.deepEqual(flags(p, [...list, extra]), ['-', '-', '-', 'E', '-']);
    assert.equal(p.streakTokens, 1);
    assert.equal(computeProgress(list.slice(0, 3), MONDAY + 2 * WEEK + DAY).streakTokens, 0);
  });

  test('at most two are held', () => {
    const list = weekly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const p = computeProgress(list, MONDAY + 11 * WEEK + DAY);
    assert.deepEqual(flags(p, list), ['-', '-', '-', 'E', '-', '-', '-', 'E', '-', '-', '-', '-']);
    assert.equal(p.streakTokens, 2);
    assert.equal(p.streakWeeks, 12);
  });

  test('a token bridges exactly one missed week', () => {
    const list = weekly([0, 1, 2, 3, 5, 6]);
    const p = computeProgress(list, MONDAY + 6 * WEEK + DAY);
    assert.deepEqual(flags(p, list), ['-', '-', '-', 'E', 'U', '-']);
    assert.deepEqual(list.map((w) => p.rewards.get(w.id)!.streakWeeks), [1, 2, 3, 4, 5, 6], 'the missed week adds nothing');
    assert.equal(p.rewards.get(list[4].id)!.streakXp, 20, '100 set XP × 5% × 4 earlier weeks');
    assert.equal(p.streakTokens, 0);
    assert.equal(p.streakWeeks, 6);
    assert.equal(p.bestStreak, 6);

    // With the token gone, the next missed week resets the streak.
    const after = benchDay(MONDAY + 8 * WEEK, 60, 10);
    const p2 = computeProgress([...list, after], MONDAY + 8 * WEEK + DAY);
    assert.deepEqual([p2.rewards.get(after.id)!.streakWeeks, p2.rewards.get(after.id)!.tokenUsed], [1, false]);
    assert.equal(p2.bestStreak, 6);
  });

  test('two missed weeks reset the streak and keep the token', () => {
    const list = weekly([0, 1, 2, 3, 6]);
    const p = computeProgress(list, MONDAY + 6 * WEEK + DAY);
    assert.deepEqual(flags(p, list), ['-', '-', '-', 'E', '-']);
    assert.equal(p.rewards.get(list[4].id)!.streakWeeks, 1);
    assert.equal(p.rewards.get(list[4].id)!.streakXp, 0);
    assert.equal(p.streakWeeks, 1);
    assert.equal(p.streakTokens, 1);
  });

  test('without a token one missed week resets the streak', () => {
    const list = weekly([0, 1, 2, 4]);
    const p = computeProgress(list, MONDAY + 4 * WEEK + DAY);
    assert.deepEqual(flags(p, list), ['-', '-', '-', '-']);
    assert.equal(p.streakWeeks, 1);
  });

  test('a bridged week can itself earn the next token', () => {
    const list = weekly([0, 1, 2, 3, 4, 5, 6, 8]);
    const p = computeProgress(list, MONDAY + 8 * WEEK + DAY);
    assert.deepEqual(flags(p, list), ['-', '-', '-', 'E', '-', '-', '-', 'EU']);
    assert.equal(p.streakWeeks, 8);
    assert.equal(p.streakTokens, 1);
  });

  test('alive at now: a held token covers one missed week without being spent', () => {
    const list = weekly([0, 1, 2, 3]);
    const p = (weeksLater: number) => computeProgress(list, MONDAY + weeksLater * WEEK + DAY);
    assert.deepEqual([p(4).streakWeeks, p(4).streakTokens], [4, 1]);
    assert.deepEqual([p(5).streakWeeks, p(5).streakTokens], [4, 1], 'week 4 was missed, the token would bridge it');
    assert.deepEqual([p(6).streakWeeks, p(6).streakTokens], [0, 1], 'two missed weeks');
    // No token, no grace.
    const short = weekly([0, 1, 2]);
    assert.equal(computeProgress(short, MONDAY + 3 * WEEK + DAY).streakWeeks, 3);
    assert.equal(computeProgress(short, MONDAY + 4 * WEEK + DAY).streakWeeks, 0);
  });
});

describe('rested bonus and recovery', () => {
  const rested = (p: ReturnType<typeof computeProgress>, w: ProgressWorkout) => bonus(p, w, 'Rested muscles');

  test('10% of set XP when the stat rested 48 hours or was never trained', () => {
    const a = benchDay(MONDAY);
    const b = benchDay(MONDAY + 47 * HOUR);
    const c = benchDay(MONDAY + 47 * HOUR + 48 * HOUR);
    const p = computeProgress([a, b, c], MONDAY + 5 * DAY);
    assert.deepEqual([rested(p, a), rested(p, b), rested(p, c)], [5, 0, 5]);
    assert.equal(XP.restedStep, 0.1);
    // Hero XP only.
    assert.equal(p.stats.might.xp, 150);
  });

  test('judged per exercise by its main stat, summed and rounded per workout', () => {
    const a = benchDay(MONDAY);
    const b = workout(MONDAY + DAY, [
      [1, BENCH, [set(60, 5), set(60, 5), set(60, 5)]],
      [3, SQUAT, [set(20, 5, { setType: 'warmup' }), set(80, 5), set(80, 5)]],
      [4, PLANK, [set(null, null, { durationS: 30 })]],
    ]);
    const p = computeProgress([a, b], MONDAY + 2 * DAY);
    // Bench is not rested; squat 23 XP and plank 5 XP are: 2.8 → 3.
    assert.equal(rested(p, b), 3);

    // Plyometrics split evenly between Drive and Stamina: Drive comes first, so it decides.
    const legs = workout(MONDAY, [[3, SQUAT, [set(80, 5), set(80, 5)]]]);
    const jumps = workout(MONDAY + DAY, [[7, JUMP, [set(null, 10), set(null, 10)]]]);
    const p2 = computeProgress([legs, jumps], MONDAY + 2 * DAY);
    assert.equal(rested(p2, legs), 2);
    assert.equal(rested(p2, jumps), 0);
  });

  test('a stat only counts as trained from 20 XP in one workout', () => {
    const light = benchDay(MONDAY, 60, 1);
    const next = benchDay(MONDAY + DAY, 60, 2);
    const third = benchDay(MONDAY + 2 * DAY, 60, 2);
    const p = computeProgress([light, next, third], MONDAY + 2 * DAY + 1000);
    assert.deepEqual([rested(p, light), rested(p, next), rested(p, third)], [1, 2, 0]);
    assert.equal(p.recovery.might.lastTrainedAt, third.startedAt);
    assert.equal(computeProgress([light], MONDAY + 1000).recovery.might.lastTrainedAt, null);
  });

  test('recovery state relative to now', () => {
    const a = workout(MONDAY, [
      [1, BENCH, [set(60, 5), set(60, 5)]],
      [2, ROW, [set(60, 5)]],
    ]);
    const state = (after: number) => computeProgress([a], MONDAY + after).recovery;
    assert.deepEqual(state(HOUR).might, { lastTrainedAt: MONDAY, state: 'fatigued' });
    assert.equal(state(24 * HOUR - 1).might.state, 'fatigued');
    assert.equal(state(24 * HOUR).might.state, 'recovering');
    assert.equal(state(48 * HOUR - 1).might.state, 'recovering');
    assert.equal(state(48 * HOUR).might.state, 'rested');
    assert.deepEqual(state(HOUR).grip, { lastTrainedAt: null, state: 'rested' }, 'one set is not enough');
    assert.deepEqual(state(HOUR).agility, { lastTrainedAt: null, state: 'rested' });
    assert.deepEqual(Object.keys(state(0)), ['might', 'grip', 'drive', 'fortitude', 'stamina', 'agility']);
  });
});

describe('timeline and totals', () => {
  const history = () => {
    const list: ProgressWorkout[] = [];
    for (let d = 0; d < 120; d += 2) {
      const t = at(2025, 3, 3) + d * DAY;
      list.push(
        workout(t, [
          [1, BENCH, [set(20, 5, { setType: 'warmup' }), set(60 + d / 4, 5), set(60 + d / 4, 5)]],
          [d % 3 === 0 ? 3 : 2, d % 3 === 0 ? SQUAT : ROW, [set(80 + d / 2, 3), set(80, 8)]],
          ...(d % 8 === 0 ? [[6, RUN, [set(null, null, { durationS: 900 })]] as [number, ExerciseKind, SetData[]]] : []),
          ...(d % 6 === 0 ? [[9, STRETCH, [set(null, null, { durationS: 45 }), set(null, null, { durationS: 45 })]] as [number, ExerciseKind, SetData[]]] : []),
        ]),
      );
    }
    list.push(workout(at(2025, 7, 10), [[1, BENCH, [set(null, null)]]]));
    return list;
  };

  test('timeline is the running XP after every workout, oldest first', () => {
    const list = history();
    const p = computeProgress([...list].reverse(), at(2025, 7, 11));
    assert.equal(p.timeline.length, list.length);
    assert.deepEqual(p.timeline, list.map((w) => ({ at: w.startedAt, xp: p.rewards.get(w.id)!.xpAfter })));
    assert.equal(p.timeline[p.timeline.length - 1].xp, p.xp);
    assert.deepEqual(computeProgress([], MONDAY).timeline, []);
  });

  test('every reward adds up, bonuses included, and the hero XP is their sum', () => {
    const list = history();
    const p = computeProgress(list, at(2025, 7, 11));
    let xp = 0;
    const labels = new Set<string>();
    for (const w of list) {
      const r = p.rewards.get(w.id)!;
      const bonusXp = r.bonuses.reduce((n, b) => n + b.xp, 0);
      for (const b of r.bonuses) {
        labels.add(b.label.split(':')[0]);
        assert.ok(b.xp > 0);
      }
      assert.equal(r.total, r.setXp + r.recordXp + r.workoutXp + r.streakXp + r.questXp + bonusXp);
      assert.equal(r.xpBefore, xp);
      assert.equal(r.xpAfter, xp + r.total);
      assert.equal(r.levelAfter, heroLevel(r.xpAfter).level);
      xp += r.total;
    }
    assert.equal(p.xp, xp);
    assert.deepEqual([...labels].sort(), ['Boss defeated', 'Daily quest', 'Rested muscles']);
    assert.ok(p.bossesDefeated >= 1);
    // The empty workout at the end earns nothing at all.
    const last = p.rewards.get(list[list.length - 1].id)!;
    assert.deepEqual([last.total, last.bonuses.length], [0, 0]);
  });

  test('pure: the same history and time always give the same hero', () => {
    const list = history();
    const now = at(2025, 7, 11);
    assert.deepEqual(computeProgress(list, now), computeProgress([...list].reverse(), now));
  });
});
