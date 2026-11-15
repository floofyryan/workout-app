/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { newActiveSet, type ActiveWorkout } from './activeWorkout';
import { computeRecords } from './calc';
import {
  achievementsFrom,
  bestiaryCatalog,
  bestiaryFrom,
  heroFrom,
  questBonusXp,
  questDefsForWeek,
  QUEST_SLOTS,
  weeklyQuests,
  type AchievementEntry,
  characterFrom,
  gearTier,
  longestWeekStreak,
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

describe('record keeper', () => {
  const bench = { type: 'weight_reps' as const, bodyPart: 'Chest' as const, category: null };
  const records = computeRecords('weight_reps', [set(100, 5)]);
  it('guards a set that would beat a record', () => {
    const m = monsterFor(bench, [set(105, 5)], 0, [], records);
    assert.equal(m.kind, 'wraith');
    assert.equal(m.record, true);
    assert.equal(m.boss, true);
  });
  it('stays away from ordinary sets, warm-ups and new exercises', () => {
    assert.equal(monsterFor(bench, [set(90, 5)], 0, [], records).record, false);
    assert.equal(monsterFor(bench, [set(120, 5, 'warmup')], 0, [], records).kind, 'slime');
    assert.equal(monsterFor(bench, [set(120, 5)], 0, [], null).record, false);
  });
});

describe('gear', () => {
  it('upgrades with the rank levels', () => {
    assert.deepEqual([1, 4, 5, 9, 10, 20, 35, 80].map(gearTier), [0, 0, 1, 1, 2, 3, 4, 4]);
  });
});

describe('achievements', () => {
  const WEEK = 7 * 86_400_000;
  const monday = new Date(2026, 0, 5, 12).getTime();
  it('counts consecutive weeks', () => {
    assert.equal(longestWeekStreak([]), 0);
    assert.equal(longestWeekStreak([monday, monday + 86_400_000]), 1);
    assert.equal(longestWeekStreak([monday, monday + WEEK, monday + 3 * WEEK, monday + 4 * WEEK, monday + 5 * WEEK]), 3);
  });
  it('tracks progress and unlocks', () => {
    const entry = (workoutId: number, s: SetData) => ({
      type: 'weight_reps' as const,
      bodyPart: 'Quads' as const,
      category: null,
      set: s,
      workoutId,
      startedAt: monday + (workoutId - 1) * WEEK,
      exerciseId: 1,
      workoutExerciseId: workoutId,
    });
    const list = achievementsFrom([entry(1, set(80, 5)), entry(2, set(105, 3, 'failure')), entry(3, set(60, 5)), entry(4, set(60, 5))]);
    const get = (id: string) => list.find((a) => a.id === id)!;
    assert.equal(get('first').unlocked, true);
    assert.equal(get('dragon').unlocked, true);
    assert.equal(get('centurion').unlocked, true);
    assert.equal(get('streak').unlocked, true);
    assert.equal(get('hunter').unlocked, false);
    assert.equal(get('hunter').progress, 4);
    assert.equal(achievementsFrom([]).some((a) => a.unlocked), false);
  });
});

const monday = new Date(2026, 0, 5, 12).getTime();
let weId = 0;
/** Sets of one exercise in one workout, as history entries. */
function logged(
  workoutId: number,
  startedAt: number,
  source: { type: 'weight_reps' | 'duration' | 'reps'; bodyPart: AchievementEntry['bodyPart']; category: string | null },
  sets: SetData[],
  exerciseId = 1,
): AchievementEntry[] {
  const id = ++weId;
  return sets.map((set) => ({ ...source, set, workoutId, startedAt, exerciseId, workoutExerciseId: id }));
}
const squat = { type: 'weight_reps' as const, bodyPart: 'Quads' as const, category: 'strength' };

describe('weekly quests', () => {
  it('picks one quest per slot, the same for the whole week', () => {
    const q = questDefsForWeek(monday);
    assert.equal(q.length, QUEST_SLOTS.length);
    q.forEach((def, i) => assert.ok(QUEST_SLOTS[i].includes(def)));
    assert.deepEqual(questDefsForWeek(monday).map((d) => d.id), q.map((d) => d.id));
  });
  it('varies between weeks', () => {
    const ids = new Set(Array.from({ length: 12 }, (_, i) => questDefsForWeek(new Date(2026, 0, 5 + 7 * i).getTime()).map((d) => d.id).join()));
    assert.ok(ids.size > 3);
  });
  it('tracks progress within the week and rewards completion', () => {
    const week = new Date(2026, 0, 5).getTime();
    const defs = questDefsForWeek(week);
    assert.ok(weeklyQuests(week, []).every((q) => !q.done && q.progress === 0));
    // Plenty of everything in one week completes every quest.
    const many: AchievementEntry[] = [];
    for (let w = 1; w <= 4; w++) {
      const t = monday + w * 3_600_000;
      many.push(...logged(w, t, squat, [set(60, 5, 'warmup'), set(60, 5, 'warmup'), ...Array(10).fill(set(100, 8))]));
      many.push(...logged(w, t, { type: 'weight_reps', bodyPart: 'Chest', category: null }, Array(5).fill(set(80, 8))));
      many.push(...logged(w, t, { type: 'reps', bodyPart: 'Core', category: null }, Array(3).fill(set(null, 20))));
      many.push(...logged(w, t, { type: 'duration', bodyPart: 'Cardio', category: 'cardio' }, [{ ...set(null, null), durationS: 600 }]));
      many.push(...logged(w, t, { type: 'duration', bodyPart: 'Hamstrings', category: 'stretching' }, Array(2).fill({ ...set(null, null), durationS: 30 })));
    }
    const quests = weeklyQuests(week, many);
    assert.ok(quests.every((q) => q.done), JSON.stringify(quests));
    const bonus = defs.reduce((n, d) => n + d.reward, 0);
    assert.equal(questBonusXp(many), bonus);
    assert.equal(heroFrom(many).xp, characterFrom(many).xp + bonus);
    assert.equal(heroFrom(many).questXp, bonus);
  });
});

describe('bestiary', () => {
  it('lists every monster once', () => {
    const names = bestiaryCatalog().map((m) => m.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes('Record Keeper'));
  });
  it('counts kills, including record keepers from earlier bests', () => {
    const entries = [
      ...logged(1, monday, squat, [set(40, 10, 'warmup'), set(100, 5), set(100, 5)]),
      ...logged(2, monday + 86_400_000, squat, [set(100, 5), set(110, 5)]),
    ];
    const kills = Object.fromEntries(bestiaryFrom(entries).map((m) => [m.name, m.kills]));
    assert.equal(kills['Warm-up Slime'], 1);
    assert.equal(kills['Squat Ogre'], 2);
    assert.equal(kills['Ogre Chieftain'], 1);
    assert.equal(kills['Record Keeper'], 1);
    assert.equal(kills['Golem Quarry'], undefined);
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
