// Achievements: milestones worked out from workout history, each with the date it was reached (or
// progress towards it). Nothing is stored: deleting or importing workouts updates them. Pure.
import { formatNumber, startOfWeek } from './format';
import type { UnitSystem } from './types';
import { displayToKg, formatWeight, kgToDisplay, weightUnit } from './units';

/** One workout's numbers, as achievementStats() reads them. */
export interface WorkoutStat {
  id: number;
  startedAt: number;
  /** Weight × reps over its sets (kg), as in the workout's volume. */
  volume: number;
  /** Heaviest weight lifted for at least a rep in a weight & reps exercise (kg). */
  heaviest: number | null;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  /** Ionicons name for its badge. */
  icon: string;
  /** When it was earned, or null if not yet. */
  earnedAt: number | null;
  /** 0–1 towards earning it. */
  progress: number;
  /** E.g. "37 / 50 workouts". */
  progressText: string | null;
}

const WEEK = 7 * 86_400_000;

/** For each workout, the run of consecutive training weeks it's part of. */
function weekRuns(stats: WorkoutStat[]): number[] {
  const runs: number[] = [];
  let week = -Infinity;
  let run = 0;
  for (const s of stats) {
    const w = startOfWeek(s.startedAt);
    if (w !== week) {
      // Week starts shift by an hour across DST changes, so compare via startOfWeek.
      run = startOfWeek(w - WEEK / 2) === week ? run + 1 : 1;
      week = w;
    }
    runs.push(run);
  }
  return runs;
}

/** All achievements, earned or not, from workouts sorted oldest first. */
export function computeAchievements(stats: WorkoutStat[], units: UnitSystem): Achievement[] {
  const count = stats.length;
  const runs = weekRuns(stats);
  const longestRun = Math.max(0, ...runs);
  let cumulative = 0;
  const totals = stats.map((s) => (cumulative += s.volume));
  const total = cumulative;
  const heaviest = Math.max(0, ...stats.map((s) => s.heaviest ?? 0));
  const club = units === 'metric' ? 100 : displayToKg(225, 'imperial');
  const clubName = formatWeight(club, units);
  const tonnes = (kg: number) => {
    if (units !== 'metric') return `${formatNumber(kgToDisplay(kg, units))} ${weightUnit(units)}`;
    const t = kg / 1000;
    // One decimal below 100 t unless it's a whole number: "17.5 t", "10 t", "250 t".
    return `${formatNumber(t, t < 100 && Math.round(t * 10) % 10 !== 0 ? 1 : 0)} t`;
  };

  const workouts = (key: string, n: number, title: string, icon: string): Achievement => ({
    key,
    title,
    description: n === 1 ? 'Finish your first workout.' : `Finish ${n} workouts.`,
    icon,
    earnedAt: stats[n - 1]?.startedAt ?? null,
    progress: Math.min(1, count / n),
    progressText: `${Math.min(count, n)} / ${n} workouts`,
  });
  const streak = (key: string, n: number, title: string): Achievement => {
    const i = runs.findIndex((r) => r >= n);
    return {
      key,
      title,
      description: `Train every week for ${n} weeks in a row.`,
      icon: 'flame',
      earnedAt: i >= 0 ? stats[i].startedAt : null,
      progress: Math.min(1, longestRun / n),
      progressText: `Best run: ${Math.min(longestRun, n)} / ${n} weeks`,
    };
  };
  const volume = (key: string, kg: number, title: string): Achievement => {
    const i = totals.findIndex((t) => t >= kg);
    return {
      key,
      title,
      description: `Lift ${tonnes(kg)} in total (weight × reps, all workouts).`,
      icon: 'barbell',
      earnedAt: i >= 0 ? stats[i].startedAt : null,
      progress: Math.min(1, total / kg),
      progressText: `${tonnes(Math.min(total, kg))} / ${tonnes(kg)}`,
    };
  };
  const firstAt = (test: (s: WorkoutStat) => boolean) => stats.find(test)?.startedAt ?? null;
  const hour = (s: WorkoutStat) => new Date(s.startedAt).getHours();
  const clubAt = firstAt((s) => (s.heaviest ?? 0) >= club - 1e-6);

  return [
    workouts('first', 1, 'First workout', 'flag'),
    workouts('workouts-10', 10, 'Ten down', 'checkmark-done'),
    workouts('workouts-50', 50, 'Regular', 'ribbon'),
    workouts('workouts-100', 100, 'Centurion', 'trophy'),
    streak('streak-4', 4, 'Month strong'),
    streak('streak-12', 12, 'Unstoppable'),
    volume('volume-10t', 10_000, 'Heavy lifter'),
    volume('volume-100t', 100_000, 'Champion'),
    {
      key: 'club',
      title: `${clubName} club`,
      description: `Lift ${clubName} for at least one rep.`,
      icon: 'medal',
      earnedAt: clubAt,
      progress: Math.min(1, heaviest / club),
      progressText: `Heaviest: ${formatWeight(heaviest, units)}`,
    },
    {
      key: 'night-owl',
      title: 'Night owl',
      description: 'Start a workout at 9 pm or later.',
      icon: 'moon',
      earnedAt: firstAt((s) => hour(s) >= 21),
      progress: stats.some((s) => hour(s) >= 21) ? 1 : 0,
      progressText: null,
    },
    {
      key: 'early-bird',
      title: 'Early bird',
      description: 'Start a workout before 7 am.',
      icon: 'sunny',
      earnedAt: firstAt((s) => hour(s) < 7),
      progress: stats.some((s) => hour(s) < 7) ? 1 : 0,
      progressText: null,
    },
  ];
}

/** The closest achievement not earned yet (the furthest along; ties go to the list order). */
export function nextAchievement(achievements: Achievement[]): Achievement | null {
  let best: Achievement | null = null;
  for (const a of achievements) {
    if (a.earnedAt == null && (best == null || a.progress > best.progress)) best = a;
  }
  return best;
}

/** Achievements a workout earned: earned with it, but not without it. */
export function newlyEarned(stats: WorkoutStat[], workoutId: number, units: UnitSystem): Achievement[] {
  const before = new Set(
    computeAchievements(stats.filter((s) => s.id !== workoutId), units)
      .filter((a) => a.earnedAt != null)
      .map((a) => a.key),
  );
  return computeAchievements(stats, units).filter((a) => a.earnedAt != null && !before.has(a.key));
}
