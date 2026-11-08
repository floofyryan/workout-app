/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeAchievements, newlyEarned, nextAchievement, type WorkoutStat } from './achievements';

const DAY = 86_400_000;
// Mondays at 18:00 local time, a week apart, starting 1 Jan 2024 (a Monday).
const monday = (week: number, hour = 18) => new Date(2024, 0, 1 + week * 7, hour).getTime();
const stat = (id: number, startedAt: number, volume = 1000, heaviest: number | null = 60): WorkoutStat => ({
  id,
  startedAt,
  volume,
  heaviest,
});
const byKey = (list: ReturnType<typeof computeAchievements>) => new Map(list.map((a) => [a.key, a]));

describe('achievements', () => {
  it('nothing is earned before the first workout, which is what to aim for', () => {
    const list = computeAchievements([], 'metric');
    const a = byKey(list);
    assert.ok(list.every((x) => x.earnedAt == null && x.progress === 0));
    assert.equal(a.get('first')?.progressText, '0 / 1 workouts');
    assert.equal(nextAchievement(list)?.key, 'first');
  });

  it('counts workouts, week streaks and total volume, dated when reached', () => {
    // Five weeks in a row, then a gap, then one more week with two workouts.
    const stats = [0, 1, 2, 3, 4, 6].map((w, i) => stat(i + 1, monday(w), 2500));
    stats.push(stat(7, monday(6) + DAY, 2500));
    const list = computeAchievements(stats, 'metric');
    const a = byKey(list);
    assert.equal(a.get('first')?.earnedAt, monday(0));
    assert.equal(a.get('workouts-10')?.earnedAt, null);
    assert.equal(a.get('workouts-10')?.progressText, '7 / 10 workouts');
    assert.equal(a.get('streak-4')?.earnedAt, monday(3), 'the fourth week in a row');
    assert.equal(a.get('streak-12')?.progressText, 'Best run: 5 / 12 weeks');
    assert.equal(a.get('volume-10t')?.earnedAt, monday(3), '4 × 2.5 t reaches 10 t');
    assert.equal(a.get('volume-10t')?.description, 'Lift 10 t in total (weight × reps, all workouts).');
    assert.equal(a.get('volume-100t')?.progressText, '17.5 t / 100 t');
    // 7 / 10 workouts is the furthest along of what's left.
    assert.equal(nextAchievement(list)?.key, 'workouts-10');
  });

  it('the strength club is 100 kg, or 225 lb in imperial', () => {
    const stats = [stat(1, monday(0), 500, 95), stat(2, monday(1), 500, 101)];
    const metric = byKey(computeAchievements(stats, 'metric')).get('club')!;
    assert.equal(metric.title, '100 kg club');
    assert.equal(metric.earnedAt, monday(1));
    const imperial = byKey(computeAchievements(stats, 'imperial')).get('club')!;
    assert.equal(imperial.title, '225 lb club');
    assert.equal(imperial.earnedAt, null, '101 kg is 222.7 lb');
    assert.ok(imperial.progress > 0.98 && imperial.progress < 1);
    assert.equal(imperial.progressText, 'Heaviest: 222.7 lb');
  });

  it('early and late starts, and what a single workout unlocked', () => {
    const stats = [stat(1, monday(0, 18)), stat(2, monday(1, 6)), stat(3, monday(2, 22))];
    const a = byKey(computeAchievements(stats, 'metric'));
    assert.equal(a.get('early-bird')?.earnedAt, monday(1, 6));
    assert.equal(a.get('night-owl')?.earnedAt, monday(2, 22));
    assert.deepEqual(
      newlyEarned(stats, 3, 'metric').map((x) => x.key),
      ['night-owl'],
    );
    assert.deepEqual(
      newlyEarned(stats, 1, 'metric').map((x) => x.key),
      [],
      'without the first, the second would have been the first workout',
    );
  });

  it('nothing is left to aim for once everything is earned', () => {
    const stats = Array.from({ length: 100 }, (_, i) => stat(i + 1, monday(i, i === 0 ? 6 : 22), 1000, 100));
    const list = computeAchievements(stats, 'metric');
    assert.ok(list.every((x) => x.earnedAt != null && x.progress === 1));
    assert.equal(nextAchievement(list), null);
  });
});
