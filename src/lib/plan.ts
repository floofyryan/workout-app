import { startOfDay, startOfWeek } from './format';

/** One template scheduled on a day of the week (0 = Monday … 6 = Sunday). */
export interface PlanEntry {
  weekday: number;
  templateId: number;
}

/** The part of a logged workout the plan needs. */
export interface PlanWorkout {
  startedAt: number;
  templateId: number | null;
}

/** `inactive`: on a day before the plan was set up, so it neither counts nor is missed. */
export type PlanStatus = 'done' | 'missed' | 'today' | 'upcoming' | 'inactive';

export interface PlannedSession {
  templateId: number;
  status: PlanStatus;
}

export interface PlanDay {
  weekday: number;
  /** Local midnight of this day. */
  date: number;
  isToday: boolean;
  sessions: PlannedSession[];
  /** Workouts logged this day that weren't part of the plan. */
  extraWorkouts: number;
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Day of the week with Monday = 0, in local time. */
export function weekdayOf(ts: number): number {
  return (new Date(ts).getDay() + 6) % 7;
}

/** Midnight of each day of the week containing `now` (DST-safe). */
function weekDates(now: number): number[] {
  const monday = new Date(startOfWeek(now));
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i).getTime(),
  );
}

/**
 * The plan laid out over the week containing `now`, with each planned session marked done if a
 * workout from that template was logged. A workout counts for its own day first; otherwise it
 * counts for the earliest still-open session of the same template that week, so moving a session
 * to another day still ticks it off. Open sessions on days before `planStart` are inactive.
 */
export function buildWeek(plan: PlanEntry[], workouts: PlanWorkout[], now: number, planStart: number | null = null): PlanDay[] {
  const firstDay = planStart == null ? -Infinity : startOfDay(planStart);
  const dates = weekDates(now);
  const today = startOfDay(now);
  const days = dates.map((date, weekday) => ({
    weekday,
    date,
    isToday: date === today,
    entries: plan.filter((p) => p.weekday === weekday).map((p) => ({ templateId: p.templateId, done: false })),
    workouts: [] as { templateId: number | null; used: boolean }[],
  }));
  const weekEnd = new Date(dates[6]);
  weekEnd.setDate(weekEnd.getDate() + 1);
  for (const w of workouts) {
    if (w.startedAt < dates[0] || w.startedAt >= weekEnd.getTime()) continue;
    days[weekdayOf(w.startedAt)].workouts.push({ templateId: w.templateId, used: false });
  }

  // Same-day matches first.
  for (const d of days) {
    for (const e of d.entries) {
      const w = d.workouts.find((x) => !x.used && x.templateId === e.templateId);
      if (w) {
        w.used = true;
        e.done = true;
      }
    }
  }
  // Then workouts done on another day.
  for (const d of days) {
    for (const w of d.workouts) {
      if (w.used || w.templateId == null) continue;
      const e = days.flatMap((x) => x.entries).find((x) => !x.done && x.templateId === w.templateId);
      if (e) {
        e.done = true;
        w.used = true;
      }
    }
  }

  return days.map((d) => ({
    weekday: d.weekday,
    date: d.date,
    isToday: d.isToday,
    sessions: d.entries.map((e) => ({
      templateId: e.templateId,
      status: e.done
        ? 'done'
        : d.date < firstDay
          ? 'inactive'
          : d.date < today
            ? 'missed'
            : d.date === today
              ? 'today'
              : 'upcoming',
    })),
    extraWorkouts: d.workouts.filter((w) => !w.used).length,
  }));
}

/** Planned sessions completed so far this week, out of the total. */
export function weekProgress(week: PlanDay[]): { done: number; total: number } {
  const sessions = week.flatMap((d) => d.sessions).filter((s) => s.status !== 'inactive');
  return { done: sessions.filter((s) => s.status === 'done').length, total: sessions.length };
}
