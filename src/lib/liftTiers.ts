import { colors } from './theme';

// Strength tiers ("skill tree") for the main lifts: the best estimated 1RM relative to body
// weight, or the best rep count for bodyweight lifts, earns a tier from Bronze to Diamond.

export type TierId = 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Tier {
  id: TierId;
  name: string;
  color: string;
}

/** Lowest to highest. Index 0 is Unranked; index i (1–5) is earned at `thresholds[i - 1]`. */
export const TIERS: readonly Tier[] = [
  { id: 'unranked', name: 'Unranked', color: colors.faint },
  { id: 'bronze', name: 'Bronze', color: '#CD7F32' },
  { id: 'silver', name: 'Silver', color: '#C0C7D1' },
  { id: 'gold', name: 'Gold', color: colors.xp },
  { id: 'platinum', name: 'Platinum', color: '#5EEAD4' },
  { id: 'diamond', name: 'Diamond', color: '#A78BFA' },
];

export type LiftId = 'squat' | 'bench' | 'deadlift' | 'overheadPress' | 'row' | 'pullUp';

/** 'ratio' lifts are ranked by est. 1RM ÷ body weight, 'reps' lifts by their best rep count. */
export type LiftKind = 'ratio' | 'reps';

export interface LiftDef {
  id: LiftId;
  name: string;
  kind: LiftKind;
  /** Exercise names that count toward this lift (case-insensitive); the first is the canonical one. */
  exerciseNames: readonly string[];
  /** Bronze, Silver, Gold, Platinum, Diamond: × body weight for ratio lifts, reps otherwise. */
  thresholds: readonly [number, number, number, number, number];
}

export const KEY_LIFTS: readonly LiftDef[] = [
  {
    id: 'squat',
    name: 'Squat',
    kind: 'ratio',
    exerciseNames: ['Squat (Barbell)', 'Back Squat (Barbell)', 'Squat'],
    thresholds: [0.75, 1.0, 1.5, 2.0, 2.5],
  },
  {
    id: 'bench',
    name: 'Bench Press',
    kind: 'ratio',
    exerciseNames: ['Bench Press (Barbell)', 'Bench Press'],
    thresholds: [0.5, 0.75, 1.0, 1.25, 1.5],
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    kind: 'ratio',
    exerciseNames: ['Deadlift (Barbell)', 'Sumo Deadlift (Barbell)', 'Deadlift'],
    thresholds: [1.0, 1.5, 2.0, 2.5, 3.0],
  },
  {
    id: 'overheadPress',
    name: 'Overhead Press',
    kind: 'ratio',
    exerciseNames: ['Overhead Press (Barbell)', 'Military Press (Barbell)', 'Overhead Press'],
    thresholds: [0.35, 0.5, 0.65, 0.8, 1.0],
  },
  {
    id: 'row',
    name: 'Barbell Row',
    kind: 'ratio',
    exerciseNames: ['Bent Over Row (Barbell)', 'Pendlay Row (Barbell)', 'Barbell Row'],
    thresholds: [0.5, 0.7, 0.9, 1.1, 1.3],
  },
  {
    id: 'pullUp',
    name: 'Pull Up',
    kind: 'reps',
    exerciseNames: ['Pull Up (Bodyweight)', 'Chin Up (Bodyweight)', 'Pull Up (Weighted)', 'Pull Up'],
    thresholds: [1, 5, 10, 15, 20],
  },
];

/** A lift's best efforts across all workouts (warm-ups excluded). Null or 0 means never done. */
export interface LiftBest {
  e1rmKg?: number | null;
  maxReps?: number | null;
}

export type LiftBests = Partial<Record<LiftId, LiftBest>>;

/**
 * - 'ranked': trained and measurable (may still be the Unranked tier, below Bronze).
 * - 'untrained': no qualifying set logged yet (locked).
 * - 'needs_bodyweight': a ratio lift was trained but no body weight is known.
 */
export type LiftStatus = 'ranked' | 'untrained' | 'needs_bodyweight';

export interface LiftStanding {
  lift: LiftDef;
  status: LiftStatus;
  tier: Tier;
  /** Index of `tier` in TIERS. */
  tierIndex: number;
  unit: 'kg' | 'reps';
  /** Best est. 1RM in kg, or best reps. Null when untrained. */
  value: number | null;
  /** value ÷ body weight for ratio lifts when both are known. */
  ratio: number | null;
  /** The tier to earn next. Null at Diamond, or when body weight is needed to tell. */
  nextTier: Tier | null;
  /** What `value` must reach for the next tier: kg at the user's body weight, or reps. */
  nextTarget: number | null;
  /** nextTarget − value, in kg or reps. Always > 0 when set. */
  toNext: number | null;
  /** 0–1 from the current tier's threshold toward the next one; 1 at Diamond. */
  progress: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Index into TIERS for a ratio or rep count measured against a lift's thresholds. */
export function tierIndexFor(thresholds: readonly number[], measure: number): number {
  let index = 0;
  // The epsilon keeps e.g. 100 kg at 80 kg × 1.25 from missing its tier to floating point noise.
  while (index < thresholds.length && measure >= thresholds[index] - 1e-9) index++;
  return index;
}

/** One lift's tier, next step and progress. `bodyWeightKg` only matters for ratio lifts. */
export function liftStanding(lift: LiftDef, best: LiftBest | undefined, bodyWeightKg: number | null): LiftStanding {
  const isReps = lift.kind === 'reps';
  const unit = isReps ? 'reps' : 'kg';
  const raw = (isReps ? best?.maxReps : best?.e1rmKg) ?? 0;
  const value = raw > 0 ? raw : null;
  const bw = bodyWeightKg != null && bodyWeightKg > 0 ? bodyWeightKg : null;
  // What one threshold unit is worth in `value` units: body weight for ratio lifts, 1 for reps.
  const scale = isReps ? 1 : bw;

  const base = { lift, unit, value, ratio: null, tier: TIERS[0], tierIndex: 0, progress: 0 } as const;

  if (scale == null) {
    return {
      ...base,
      status: value == null ? 'untrained' : 'needs_bodyweight',
      nextTier: null,
      nextTarget: null,
      toNext: null,
    };
  }

  const measure = (value ?? 0) / scale;
  const tierIndex = tierIndexFor(lift.thresholds, measure);
  const atTop = tierIndex >= lift.thresholds.length;
  const floor = tierIndex === 0 ? 0 : lift.thresholds[tierIndex - 1];
  const ceiling = atTop ? null : lift.thresholds[tierIndex];
  const nextTarget = ceiling == null ? null : ceiling * scale;

  return {
    ...base,
    status: value == null ? 'untrained' : 'ranked',
    tier: TIERS[tierIndex],
    tierIndex,
    ratio: isReps || value == null ? null : measure,
    nextTier: atTop ? null : TIERS[tierIndex + 1],
    nextTarget,
    toNext: nextTarget == null ? null : nextTarget - (value ?? 0),
    progress: ceiling == null ? 1 : clamp01((measure - floor) / (ceiling - floor)),
  };
}

/** Standing for every key lift, in KEY_LIFTS order. */
export function liftStandings(bests: LiftBests, bodyWeightKg: number | null): LiftStanding[] {
  return KEY_LIFTS.map((lift) => liftStanding(lift, bests[lift.id], bodyWeightKg));
}
