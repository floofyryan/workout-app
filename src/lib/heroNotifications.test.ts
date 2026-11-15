/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

// The planner lives in its own module so these tests never load expo-notifications.
import { HERO_NOTIFICATION_PREFIX, heroPlanKey, planHeroNotifications } from './heroNotificationPlan';
import { computeProgress, type BossStatus, type Progress } from './rpg';

/** Local time; months are 1-based here. November 2026 starts on a Sunday, so Mon 9 – Sun 15 is a week. */
const at = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

function hero(now: number, over: Partial<Progress> & { showUp?: number } = {}): Progress {
  const { showUp = 0, ...rest } = over;
  const base = computeProgress([], now);
  return {
    ...base,
    boss: null,
    streakTokens: 0,
    quests: base.quests.map((q) => (q.id === 'showUp' ? { ...q, progress: showUp, done: showUp >= q.target } : q)),
    ...rest,
  };
}

const boss = (over: Partial<BossStatus> = {}): BossStatus => ({
  exerciseId: 1,
  month: at(11, 1, 0),
  targetE1rm: 105,
  baselineE1rm: 100,
  bestE1rm: 0,
  reward: 300,
  defeated: false,
  ...over,
});

const only = (p: Progress, now: number, id: string) => planHeroNotifications(p, now).find((n) => n.id === HERO_NOTIFICATION_PREFIX + id);

describe('streak reminder', () => {
  test('goes out on Saturday at 10:00 when nothing is logged this week', () => {
    const now = at(11, 11);
    const n = only(hero(now, { streakWeeks: 6 }), now, 'streak');
    assert.equal(n?.at, at(11, 14, 10));
    assert.equal(n?.title, 'Your 6-week streak ends Sunday');
    assert.doesNotMatch(n?.body ?? '', /token/);
  });

  test('falls back to Sunday at 10:00 once Saturday morning has passed', () => {
    for (const now of [at(11, 14, 10), at(11, 14, 18), at(11, 15, 9, 59)]) {
      const n = only(hero(now, { streakWeeks: 3 }), now, 'streak');
      assert.equal(n?.at, at(11, 15, 10));
      assert.equal(n?.title, 'Your 3-week streak ends tonight');
    }
  });

  test('is still planned just before Saturday 10:00', () => {
    const now = at(11, 14, 9, 59);
    assert.equal(only(hero(now, { streakWeeks: 2 }), now, 'streak')?.at, at(11, 14, 10));
  });

  test('is dropped once Sunday morning has passed', () => {
    for (const now of [at(11, 15, 10), at(11, 15, 20)]) {
      assert.equal(only(hero(now, { streakWeeks: 6 }), now, 'streak'), undefined);
    }
  });

  test('needs a streak of at least two weeks', () => {
    const now = at(11, 11);
    assert.equal(only(hero(now, { streakWeeks: 1 }), now, 'streak'), undefined);
    assert.equal(only(hero(now, { streakWeeks: 0 }), now, 'streak'), undefined);
  });

  test('is not sent once a workout is logged this week', () => {
    const now = at(11, 11);
    assert.equal(only(hero(now, { streakWeeks: 6, showUp: 1 }), now, 'streak'), undefined);
  });

  test('mentions the streak token when one is held', () => {
    const now = at(11, 11);
    const n = only(hero(now, { streakWeeks: 6, streakTokens: 1 }), now, 'streak');
    assert.match(n?.body ?? '', /streak token will save it this once/);
  });
});

describe('weekly quest reminder', () => {
  test('goes out the next day at 17:00 when Show up is one workout away', () => {
    const now = at(11, 11, 20);
    const n = only(hero(now, { showUp: 2 }), now, 'quest');
    assert.equal(n?.at, at(11, 12, 17));
    assert.equal(n?.body, 'One more workout completes Show up (+100 XP)');
  });

  test('is not sent when further away, or already done', () => {
    const now = at(11, 11);
    for (const showUp of [0, 1, 3]) assert.equal(only(hero(now, { showUp }), now, 'quest'), undefined);
  });

  test('is not sent when the next day is in a new week', () => {
    const sunday = at(11, 15, 8);
    assert.equal(only(hero(sunday, { showUp: 2 }), sunday, 'quest'), undefined);
    const saturday = at(11, 14, 23);
    assert.equal(only(hero(saturday, { showUp: 2 }), saturday, 'quest')?.at, at(11, 15, 17));
  });
});

describe('boss reminder', () => {
  test('goes out the next day at 17:00 in the last five days of the month', () => {
    const now = at(11, 26);
    const n = only(hero(now, { boss: boss() }), now, 'boss');
    assert.equal(n?.at, at(11, 27, 17));
    assert.equal(n?.title, 'The boss escapes in 4 days');
    assert.match(n?.body ?? '', /\+300 XP/);
  });

  test('says tonight on the last day', () => {
    const now = at(11, 29);
    assert.equal(only(hero(now, { boss: boss() }), now, 'boss')?.title, 'The boss escapes tonight');
  });

  test('is not sent earlier in the month', () => {
    const now = at(11, 25, 23);
    assert.equal(only(hero(now, { boss: boss() }), now, 'boss'), undefined);
  });

  test('is not sent on the last day, when tomorrow is a new month', () => {
    const now = at(11, 30, 8);
    assert.equal(only(hero(now, { boss: boss() }), now, 'boss'), undefined);
  });

  test('is not sent without a boss or once it is defeated', () => {
    const now = at(11, 27);
    assert.equal(only(hero(now), now, 'boss'), undefined);
    assert.equal(only(hero(now, { boss: boss({ defeated: true }) }), now, 'boss'), undefined);
  });

  test('handles February', () => {
    const now = at(2, 24);
    assert.equal(only(hero(now, { boss: boss() }), now, 'boss')?.at, at(2, 25, 17));
    assert.equal(only(hero(at(2, 23), { boss: boss() }), at(2, 23), 'boss'), undefined);
  });
});

describe('planHeroNotifications', () => {
  test('plans nothing for a new hero', () => {
    const now = at(11, 11);
    assert.deepEqual(planHeroNotifications(computeProgress([], now), now), []);
  });

  test('everything is in the future, prefixed, uniquely identified and in order', () => {
    for (let day = 1; day <= 30; day++) {
      for (const hour of [0, 9, 10, 16, 17, 23]) {
        for (const showUp of [0, 2]) {
          const now = at(11, day, hour);
          const plan = planHeroNotifications(hero(now, { streakWeeks: 4, streakTokens: 1, showUp, boss: boss() }), now);
          assert.equal(new Set(plan.map((n) => n.id)).size, plan.length);
          plan.forEach((n, i) => {
            assert.ok(n.at > now);
            assert.ok(n.id.startsWith(HERO_NOTIFICATION_PREFIX));
            assert.ok(i === 0 || plan[i - 1].at <= n.at);
          });
        }
      }
    }
  });

  test('the plan key is stable through the day and changes with the plan', () => {
    const morning = at(11, 11, 8);
    const evening = at(11, 11, 21);
    const key = (now: number, streakWeeks: number) => heroPlanKey(planHeroNotifications(hero(now, { streakWeeks }), now));
    assert.equal(key(morning, 6), key(evening, 6));
    assert.notEqual(key(morning, 6), key(morning, 7));
    assert.equal(key(morning, 0), '');
  });
});
