// Training blocks: a program run for a set number of weeks that get harder (fewer reps in reserve)
// and end with a lighter deload week, then start again. Weeks count completed rotations of the
// program, so a missed week doesn't skip ahead. Pure logic.
import type { SetData } from './types';

/** Where a program is in its block. */
export interface BlockWeek {
  /** 1-based week within the block. */
  week: number;
  weeks: number;
  /** Which block this is (1 for the first). */
  block: number;
  /** Reps to leave in reserve on each set this week (null in the deload week). */
  rir: number | null;
  deload: boolean;
}

export const BLOCK_LENGTHS = [4, 5, 6];
/** Most working sets feedback can build an exercise up to. */
export const MAX_FEEDBACK_SETS = 8;

/** Reps in reserve for a build week: from 3 in the first week down to 0 in the last. */
export function targetRir(week: number, buildWeeks: number): number {
  if (buildWeeks <= 1) return 2;
  return Math.round(3 - (3 * (week - 1)) / (buildWeeks - 1));
}

/** The week a program is in, given how many of its workouts were done since the block started. */
export function blockWeek(weeks: number, sessionsDone: number, workoutsPerRotation: number): BlockWeek {
  const rotations = Math.floor(sessionsDone / Math.max(1, workoutsPerRotation));
  const week = (rotations % weeks) + 1;
  const deload = weeks > 1 && week === weeks;
  return {
    week,
    weeks,
    block: Math.floor(rotations / weeks) + 1,
    rir: deload ? null : targetRir(week, weeks - 1),
    deload,
  };
}

export function describeBlockWeek(b: BlockWeek): string {
  if (b.deload) return `Deload week (${b.week} of ${b.weeks}): half the sets, keep it easy`;
  const effort = b.rir === 0 ? 'push close to failure' : `stop about ${b.rir} rep${b.rir === 1 ? '' : 's'} short of failure`;
  return `Week ${b.week} of ${b.weeks}: ${effort}`;
}

const isWork = (s: SetData) => s.setType !== 'warmup';

/** The deload version of an exercise's sets: warm-ups plus half the working sets (rounded up). */
export function deloadSets<T extends SetData>(sets: T[]): T[] {
  const keep = Math.ceil(sets.filter(isWork).length / 2);
  let kept = 0;
  return sets.filter((s) => !isWork(s) || kept++ < keep);
}

/** Adds working sets (copies of the last one) or takes them off the end, keeping at least one. */
export function adjustWorkingSets(sets: SetData[], delta: number, max = MAX_FEEDBACK_SETS): SetData[] {
  const work = sets.filter(isWork).length;
  const target = Math.max(1, Math.min(max, work + delta));
  if (target > work) {
    const last = [...sets].reverse().find(isWork) ?? sets[sets.length - 1];
    return last ? [...sets, ...Array.from({ length: target - work }, () => ({ ...last }))] : sets;
  }
  let toDrop = work - target;
  const out = [...sets];
  for (let i = out.length - 1; i >= 0 && toDrop > 0; i--) {
    if (isWork(out[i])) {
      out.splice(i, 1);
      toDrop--;
    }
  }
  return out;
}

/** How an exercise felt, and what that does to next week's sets. */
export const FEEDBACK = [
  { key: 'easy', label: 'Too easy', delta: 1 },
  { key: 'right', label: 'Just right', delta: 0 },
  { key: 'hard', label: 'Too much', delta: -1 },
] as const;
export type FeedbackKey = (typeof FEEDBACK)[number]['key'];
