import type { ExerciseType, SetData } from './types';

/** Estimated one-rep max using the Epley formula. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Percentage of 1RM that can typically be lifted for a given number of reps (inverse Epley). */
export function percentOf1RM(reps: number): number {
  if (reps <= 1) return 1;
  return 1 / (1 + reps / 30);
}

export function usesWeight(type: ExerciseType): boolean {
  return type === 'weight_reps' || type === 'weighted_bodyweight' || type === 'assisted_bodyweight';
}

export function usesReps(type: ExerciseType): boolean {
  return type !== 'duration' && type !== 'distance_duration';
}

/** Volume (kg × reps) of a set. Assisted and unweighted movements contribute none. */
export function setVolume(type: ExerciseType, set: SetData): number {
  if (type !== 'weight_reps' && type !== 'weighted_bodyweight') return 0;
  return (set.weight ?? 0) * (set.reps ?? 0);
}

export function totalVolume(type: ExerciseType, sets: SetData[]): number {
  return sets.reduce((sum, s) => sum + setVolume(type, s), 0);
}

export interface Records {
  e1rm: number;
  maxWeight: number;
  maxSetVolume: number;
  maxReps: number;
  maxDuration: number;
  maxDistance: number;
}

export const EMPTY_RECORDS: Records = {
  e1rm: 0,
  maxWeight: 0,
  maxSetVolume: 0,
  maxReps: 0,
  maxDuration: 0,
  maxDistance: 0,
};

/** Best values across a list of sets. Warm-up sets are ignored. */
export function computeRecords(type: ExerciseType, sets: SetData[]): Records {
  const r = { ...EMPTY_RECORDS };
  for (const s of sets) {
    if (s.setType === 'warmup') continue;
    const w = s.weight ?? 0;
    const reps = s.reps ?? 0;
    if (type === 'weight_reps' || type === 'weighted_bodyweight') {
      r.e1rm = Math.max(r.e1rm, estimate1RM(w, reps));
      if (reps > 0) r.maxWeight = Math.max(r.maxWeight, w);
      r.maxSetVolume = Math.max(r.maxSetVolume, w * reps);
    }
    if (usesReps(type)) r.maxReps = Math.max(r.maxReps, reps);
    r.maxDuration = Math.max(r.maxDuration, s.durationS ?? 0);
    r.maxDistance = Math.max(r.maxDistance, s.distanceM ?? 0);
  }
  return r;
}

export type RecordKey = keyof Records;

export const RECORD_LABELS: Record<RecordKey, string> = {
  e1rm: 'Est. 1RM',
  maxWeight: 'Heaviest weight',
  maxSetVolume: 'Best set volume',
  maxReps: 'Most reps',
  maxDuration: 'Longest duration',
  maxDistance: 'Longest distance',
};

/** Which record keys are meaningful for an exercise type. */
export function recordKeysFor(type: ExerciseType): RecordKey[] {
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return ['e1rm', 'maxWeight', 'maxSetVolume', 'maxReps'];
    case 'reps':
    case 'assisted_bodyweight':
      return ['maxReps'];
    case 'duration':
      return ['maxDuration'];
    case 'distance_duration':
      return ['maxDistance', 'maxDuration'];
  }
}

/** Records in `current` that beat `previous`. Nothing counts as a PR without previous history. */
export function newRecords(type: ExerciseType, previous: Records | null, current: Records): RecordKey[] {
  if (!previous) return [];
  return recordKeysFor(type).filter((k) => current[k] > 0 && current[k] > previous[k] + 1e-9);
}

/** Heaviest weight lifted for each rep count from 1 to maxReps. */
export function repMaxes(sets: SetData[], maxReps = 12): (number | null)[] {
  const best: (number | null)[] = Array.from({ length: maxReps }, () => null);
  for (const s of sets) {
    if (s.setType === 'warmup' || !s.reps || s.weight == null) continue;
    // A set of N reps also proves you can do fewer reps at that weight.
    for (let r = 1; r <= Math.min(s.reps, maxReps); r++) {
      const cur = best[r - 1];
      if (cur == null || s.weight > cur) best[r - 1] = s.weight;
    }
  }
  return best;
}

export interface PlateResult {
  perSide: number[];
  /** Weight that could not be loaded with the available plates. */
  remainder: number;
  achieved: number;
}

/** Greedy plate loading. All values in the same unit. */
export function calculatePlates(target: number, barWeight: number, plates: number[]): PlateResult {
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let perSideRemaining = (target - barWeight) / 2;
  const perSide: number[] = [];
  if (perSideRemaining <= 0) {
    return { perSide, remainder: Math.max(0, target - barWeight), achieved: barWeight };
  }
  for (const p of sorted) {
    while (perSideRemaining + 1e-9 >= p) {
      perSide.push(p);
      perSideRemaining -= p;
    }
  }
  const loaded = perSide.reduce((a, b) => a + b, 0);
  const achieved = barWeight + loaded * 2;
  return { perSide, remainder: Math.max(0, Math.round((target - achieved) * 1000) / 1000), achieved };
}

export function roundTo(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

/**
 * Warm-up ramp toward a working weight (display units). Returns weight/reps pairs:
 * empty bar ×10, then ~40% ×5, ~60% ×3, ~80% ×2, skipping steps that are not above the bar.
 */
export function warmupSets(
  workingWeight: number,
  barWeight: number,
  increment: number,
): { weight: number; reps: number }[] {
  if (workingWeight <= barWeight) return [];
  const result: { weight: number; reps: number }[] = [{ weight: barWeight, reps: 10 }];
  for (const [pct, reps] of [
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ] as const) {
    const w = roundTo(workingWeight * pct, increment);
    const last = result[result.length - 1].weight;
    if (w > last && w < workingWeight) result.push({ weight: w, reps });
  }
  return result;
}
