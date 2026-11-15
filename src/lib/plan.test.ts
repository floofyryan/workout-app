/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildWeek, weekdayOf, weekProgress, type PlanEntry } from './plan';

// Monday 16 November 2026, local time.
const day = (offset: number, hour = 18) => new Date(2026, 10, 16 + offset, hour).getTime();

const PLAN: PlanEntry[] = [
  { weekday: 0, templateId: 1 }, // Mon: Push
  { weekday: 2, templateId: 2 }, // Wed: Pull
  { weekday: 4, templateId: 3 }, // Fri: Legs
];

describe('weekly plan', () => {
  test('weekdayOf counts from Monday', () => {
    assert.equal(weekdayOf(day(0)), 0);
    assert.equal(weekdayOf(day(6)), 6);
  });

  test('marks sessions done, missed, today and upcoming', () => {
    const week = buildWeek(PLAN, [{ startedAt: day(0), templateId: 1 }], day(4, 9));
    assert.equal(week.length, 7);
    assert.deepEqual(
      week.map((d) => d.sessions.map((s) => s.status)),
      [['done'], [], ['missed'], [], ['today'], [], []],
    );
    assert.ok(week[4].isToday);
    assert.deepEqual(weekProgress(week), { done: 1, total: 3 });
  });

  test('a session done on another day still counts', () => {
    // Wednesday's Pull done on Thursday instead.
    const week = buildWeek(PLAN, [{ startedAt: day(3), templateId: 2 }], day(5));
    assert.equal(week[2].sessions[0].status, 'done');
    assert.equal(week[3].extraWorkouts, 0);
  });

  test('unplanned workouts are counted as extras', () => {
    const week = buildWeek(
      PLAN,
      [
        { startedAt: day(1), templateId: null },
        { startedAt: day(0), templateId: 1 },
        { startedAt: day(0, 20), templateId: 1 },
      ],
      day(1),
    );
    assert.equal(week[0].sessions[0].status, 'done');
    assert.equal(week[0].extraWorkouts, 1);
    assert.equal(week[1].extraWorkouts, 1);
  });

  test('sessions before the plan started are inactive, not missed', () => {
    const week = buildWeek(PLAN, [], day(4, 9), day(3, 8));
    assert.deepEqual(
      week.flatMap((d) => d.sessions.map((s) => s.status)),
      ['inactive', 'inactive', 'today'],
    );
    assert.deepEqual(weekProgress(week), { done: 0, total: 1 });
  });

  test('ignores workouts from other weeks', () => {
    const week = buildWeek(PLAN, [{ startedAt: day(-7), templateId: 1 }, { startedAt: day(7), templateId: 1 }], day(2));
    assert.equal(week[0].sessions[0].status, 'missed');
    assert.equal(weekProgress(week).done, 0);
  });
});
