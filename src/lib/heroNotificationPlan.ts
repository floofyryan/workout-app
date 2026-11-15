// Decides which quest and streak reminders to schedule. Pure (no Expo imports), so it runs under
// node:test; the scheduling itself lives in heroNotifications.ts.
import { startOfWeek } from './format';
import type { Progress } from './rpg';

/** Every hero reminder's identifier starts with this, so they can be told apart from timer alerts. */
export const HERO_NOTIFICATION_PREFIX = 'hero-';

export interface HeroNotification {
  /** Stable identifier, one per kind of reminder. */
  id: string;
  /** When to deliver it (ms since epoch). */
  at: number;
  title: string;
  body: string;
}

/** Streak reminders go out mid-morning at the weekend, the rest in the late afternoon. */
const STREAK_HOUR = 10;
const NUDGE_HOUR = 17;
/** The boss reminder starts this many days before the month ends. */
const BOSS_LAST_DAYS = 5;

/** `hour`:00 local time, `days` calendar days after the day containing `ts` (DST-safe). */
function atHour(ts: number, days: number, hour: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** The reminders worth scheduling for the hero as of `now`, all strictly in the future. */
export function planHeroNotifications(progress: Progress, now: number): HeroNotification[] {
  const plan: HeroNotification[] = [];
  const weekStart = startOfWeek(now);
  const weekEnd = atHour(weekStart, 7, 0);
  const showUp = progress.quests.find((q) => q.id === 'showUp');

  // (a) A streak with nothing logged this week: Saturday morning, or Sunday if that has passed.
  if (progress.streakWeeks >= 2 && (showUp?.progress ?? 0) === 0) {
    const saturday = atHour(weekStart, 5, STREAK_HOUR);
    const sunday = atHour(weekStart, 6, STREAK_HOUR);
    const at = saturday > now ? saturday : sunday;
    if (at > now) {
      plan.push({
        id: `${HERO_NOTIFICATION_PREFIX}streak`,
        at,
        title: `Your ${progress.streakWeeks}-week streak ends ${at === saturday ? 'Sunday' : 'tonight'}`,
        body:
          progress.streakTokens > 0
            ? 'Train to keep it going, or a streak token will save it this once.'
            : 'One workout this week keeps it alive.',
      });
    }
  }

  // (b) The weekly "Show up" quest is one workout away: tomorrow afternoon, if the week lasts.
  if (showUp && !showUp.done && showUp.target - showUp.progress === 1) {
    const at = atHour(now, 1, NUDGE_HOUR);
    if (at < weekEnd) {
      plan.push({
        id: `${HERO_NOTIFICATION_PREFIX}quest`,
        at,
        title: 'Quest almost complete',
        body: `One more workout completes ${showUp.title} (+${showUp.reward} XP)`,
      });
    }
  }

  // (c) The monthly boss is still standing with the month nearly over: tomorrow afternoon.
  if (progress.boss && !progress.boss.defeated) {
    const today = new Date(now);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const at = atHour(now, 1, NUDGE_HOUR);
    const sameMonth = new Date(at).getMonth() === today.getMonth();
    if (daysInMonth - today.getDate() < BOSS_LAST_DAYS && sameMonth) {
      // Days the boss has left on the day of the reminder, counting that day.
      const left = daysInMonth - new Date(at).getDate() + 1;
      plan.push({
        id: `${HERO_NOTIFICATION_PREFIX}boss`,
        at,
        title: left === 1 ? 'The boss escapes tonight' : `The boss escapes in ${left} days`,
        body: `Defeat this month's boss before it's gone (+${progress.boss.reward} XP)`,
      });
    }
  }

  return plan.filter((n) => n.at > now).sort((a, b) => a.at - b.at);
}

/** Changes exactly when the plan does, so callers can skip rescheduling an identical plan. */
export function heroPlanKey(plan: HeroNotification[]): string {
  return plan.map((n) => `${n.id}@${n.at}:${n.title}|${n.body}`).join('\n');
}
