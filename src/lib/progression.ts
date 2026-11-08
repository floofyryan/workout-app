// Progression rules: how a template exercise's targets move on after each session. Pure logic,
// so it can be unit tested.
import { roundTo, usesWeight } from './calc';
import { formatClock } from './format';
import { formatSet } from './setFormat';
import type { ExerciseType, Progression, SetData, UnitSystem } from './types';
import { clean, displayToKg, formatWeight, kgToDisplay, weightUnit } from './units';

/** What happened to an exercise's targets after a session. */
export type ProgressionOutcome = 'start' | 'up' | 'reps' | 'same' | 'deload';

export interface ProgressionResult {
  outcome: ProgressionOutcome;
  /** Targets for next time. Warm-up sets are left as they were. */
  sets: SetData[];
  /** The rule, with its miss count brought up to date. */
  progression: Progression;
}

/** Which rules suit an exercise type (double progression needs a weight to add). */
export function progressionKinds(type: ExerciseType): Progression['kind'][] {
  if (type === 'distance_duration') return [];
  return usesWeight(type) ? ['linear', 'double'] : ['linear'];
}

/** The usual weight step: 2.5 kg, or 5 lb. Stored in kg like every weight. */
export function weightStep(units: UnitSystem): number {
  return units === 'metric' ? 2.5 : displayToKg(5, 'imperial');
}

/** Starting settings for a new rule. */
export function defaultProgression(kind: Progression['kind'], type: ExerciseType, units: UnitSystem): Progression {
  if (kind === 'double') return { kind, minReps: 8, maxReps: 12, increment: weightStep(units) };
  const increment = usesWeight(type) ? weightStep(units) : type === 'duration' ? 5 : 1;
  return { kind, increment, deloadAfter: 3, deloadPercent: 10 };
}

type Field = 'weight' | 'reps' | 'durationS';

/** The value a linear rule moves: the weight, or reps / time for exercises without one. */
function progressedField(type: ExerciseType): Field {
  if (usesWeight(type)) return 'weight';
  return type === 'duration' ? 'durationS' : 'reps';
}

const isWork = (s: SetData) => s.setType !== 'warmup';
// Weights converted from pounds carry float noise, so compare with a little slack.
const EPS = 1e-6;

/** Whether the weight of a done set is at least the target (for assisted, at most). */
function weightOk(type: ExerciseType, target: SetData, done: SetData): boolean {
  if (!usesWeight(type) || target.weight == null) return true;
  const w = done.weight ?? 0;
  return type === 'assisted_bodyweight' ? w <= target.weight + EPS : w >= target.weight - EPS;
}

/** Whether a done set met its target. */
function hit(type: ExerciseType, target: SetData, done: SetData | undefined): boolean {
  if (!done) return false;
  if (type === 'duration') return (done.durationS ?? 0) >= (target.durationS ?? 0);
  return (done.reps ?? 0) >= (target.reps ?? 0) && weightOk(type, target, done);
}

/** The heavier (for assisted: lighter) of target and done weight, plus one step. */
function nextWeight(type: ExerciseType, target: SetData, done: SetData | undefined, step: number): number {
  if (type === 'assisted_bodyweight') {
    return Math.max(0, Math.min(target.weight ?? 0, done?.weight ?? Infinity) - step);
  }
  return Math.max(target.weight ?? 0, done?.weight ?? 0) + step;
}

/**
 * Next session's targets for an exercise with a progression rule, judged on the sets done today
 * (completed sets with values). Returns null when none of its sets were done, which leaves the
 * exercise as it was rather than counting a miss.
 */
export function progress(
  rule: Progression,
  type: ExerciseType,
  targets: SetData[],
  done: SetData[],
): ProgressionResult | null {
  const doneWork = done.filter(isWork);
  const targetWork = targets.filter(isWork);
  if (doneWork.length === 0 || targetWork.length === 0) return null;
  // Builds next time's sets: each working target set, in order, with the done set it was matched to.
  const mapWork = (fn: (target: SetData, done: SetData | undefined) => SetData) => {
    let j = 0;
    return targets.map((t) => (isWork(t) ? fn(t, doneWork[j++]) : t));
  };
  const field: Field = rule.kind === 'double' ? 'weight' : progressedField(type);
  const resetMisses = rule.kind === 'linear' ? { ...rule, misses: 0 } : rule;

  // No targets yet (e.g. a newly added program): today's sets become the starting point. Added
  // weight and assistance can genuinely be none, so for those a blank means zero, not "not set".
  const optional = type === 'weighted_bodyweight' || type === 'assisted_bodyweight';
  if (!(field === 'weight' && optional) && targetWork.every((t) => t[field] == null)) {
    const last = doneWork[doneWork.length - 1];
    return { outcome: 'start', sets: mapWork((t, d) => ({ ...t, [field]: (d ?? last)[field] })), progression: resetMisses };
  }
  const allHit = (adjust: (t: SetData) => SetData = (t) => t) => targetWork.every((t, j) => hit(type, adjust(t), doneWork[j]));

  if (rule.kind === 'double') {
    const { minReps, maxReps } = rule;
    if (allHit((t) => ({ ...t, reps: maxReps }))) {
      return {
        outcome: 'up',
        sets: mapWork((t, d) => ({ ...t, weight: nextWeight(type, t, d, rule.increment), reps: minReps })),
        progression: rule,
      };
    }
    // Not at the top of the range yet: aim for one more rep than last time on each set that made
    // its goal (at the target weight), up to the top.
    let more = false;
    const sets = mapWork((t, d) => {
      const goal = t.reps ?? minReps;
      if (!d || (d.reps ?? 0) < goal || !weightOk(type, t, d)) return { ...t, reps: goal };
      const next = Math.min(maxReps, Math.max(minReps, (d.reps ?? 0) + 1));
      if (next > goal) more = true;
      return { ...t, reps: next };
    });
    return { outcome: more ? 'reps' : 'same', sets, progression: rule };
  }

  if (allHit()) {
    // Weights go up from the heavier of target and lift (going heavier than planned counts);
    // reps and times go up from the target, one step per session.
    const sets = mapWork((t, d) =>
      field === 'weight'
        ? { ...t, weight: nextWeight(type, t, d, rule.increment) }
        : { ...t, [field]: (t[field] ?? 0) + rule.increment },
    );
    return { outcome: 'up', sets, progression: resetMisses };
  }
  const misses = (rule.misses ?? 0) + 1;
  if (misses < rule.deloadAfter) return { outcome: 'same', sets: targets, progression: { ...rule, misses } };
  const factor = type === 'assisted_bodyweight' && field === 'weight' ? 1 + rule.deloadPercent / 100 : 1 - rule.deloadPercent / 100;
  const deload = (v: number) =>
    field === 'weight' ? Math.max(0, roundTo(v * factor, rule.increment)) : Math.max(1, Math.round(v * factor));
  return {
    outcome: 'deload',
    sets: mapWork((t) => (t[field] == null ? t : { ...t, [field]: deload(t[field]!) })),
    progression: resetMisses,
  };
}

// ---------- Descriptions ----------

function weightStepText(increment: number, units: UnitSystem): string {
  return `${clean(kgToDisplay(increment, units), 2)} ${weightUnit(units)}`;
}

/** One-line summary of a rule, e.g. "+2.5 kg when every set hits its reps · −10% after 3 misses". */
export function describeProgression(rule: Progression, type: ExerciseType, units: UnitSystem): string {
  const assisted = type === 'assisted_bodyweight';
  if (rule.kind === 'double') {
    const step = weightStepText(rule.increment, units);
    return `${rule.minReps}–${rule.maxReps} reps, then ${assisted ? `${step} less assistance` : `+${step}`}`;
  }
  const field = progressedField(type);
  const step =
    field === 'weight'
      ? assisted
        ? `${weightStepText(rule.increment, units)} less assistance`
        : `+${weightStepText(rule.increment, units)}`
      : field === 'reps'
        ? `+${rule.increment} rep${rule.increment === 1 ? '' : 's'}`
        : `+${rule.increment} s`;
  const when = field === 'durationS' ? 'every hold lasts its time' : 'every set hits its reps';
  return `${step} when ${when} · −${rule.deloadPercent}% after ${rule.deloadAfter} misses`;
}

/** Working-set targets in a compact form, e.g. "100 kg × 5" or "60 kg × 10, 9, 9". */
export function formatTargets(sets: SetData[], type: ExerciseType, units: UnitSystem): string {
  const work = sets.filter(isWork);
  if (work.length === 0) return '';
  const first = work[0];
  if (type === 'weight_reps' && first.weight != null && work.every((s) => s.weight === first.weight)) {
    const reps = work.map((s) => s.reps ?? 0);
    return `${formatWeight(first.weight, units)} × ${reps.every((r) => r === reps[0]) ? reps[0] : reps.join(', ')}`;
  }
  const parts = work.map((s) => formatSet(type, s, units));
  return parts.every((p) => p === parts[0]) ? parts[0] : parts.join(', ');
}

/** Sets, reps and weight at a glance, e.g. "5 × 5 · 100 kg", "3 × 0:30". */
export function summarizeTargets(sets: SetData[], type: ExerciseType, units: UnitSystem): string {
  const work = sets.filter(isWork);
  if (work.length === 0) return '';
  const first = work[0];
  const each =
    type === 'duration' ? formatClock(first.durationS ?? 0) : type === 'distance_duration' ? '' : String(first.reps ?? '–');
  const weight = usesWeight(type) && first.weight != null ? ` · ${formatWeight(first.weight, units)}` : '';
  return each ? `${work.length} × ${each}${weight}` : `${work.length} set${work.length === 1 ? '' : 's'}`;
}

/** What a session did to an exercise's targets, for the workout summary. */
export function describeOutcome(result: ProgressionResult, type: ExerciseType, units: UnitSystem): string {
  const targets = formatTargets(result.sets, type, units);
  switch (result.outcome) {
    case 'start':
      return `Starting point: ${targets}`;
    case 'up':
      return `Up to ${targets}`;
    case 'reps':
      return `Aim for ${targets}`;
    case 'deload':
      return `Deload to ${targets}`;
    case 'same': {
      const p = result.progression;
      const misses = p.kind === 'linear' && p.misses ? ` (${p.misses} of ${p.deloadAfter} misses before a deload)` : '';
      return `Same again: ${targets}${misses}`;
    }
  }
}

/** A line of the "Next time" card on the workout summary. */
export interface NextTimeLine {
  name: string;
  outcome: ProgressionOutcome;
  text: string;
}

const OUTCOMES: readonly ProgressionOutcome[] = ['start', 'up', 'reps', 'same', 'deload'];

/** Reads the "Next time" lines passed to the summary screen (ignores anything malformed). */
export function parseNextTime(json: string | undefined): NextTimeLine[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (l): l is NextTimeLine =>
        l && typeof l.name === 'string' && typeof l.text === 'string' && OUTCOMES.includes(l.outcome),
    );
  } catch {
    return [];
  }
}

/** Parses a stored rule, or null when it's missing or not one we understand. */
export function parseProgression(json: string | null | undefined): Progression | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
    if (v?.kind === 'linear' && num(v.increment) && num(v.deloadAfter) && num(v.deloadPercent)) {
      return {
        kind: 'linear',
        increment: v.increment,
        deloadAfter: v.deloadAfter,
        deloadPercent: v.deloadPercent,
        misses: num(v.misses) ? v.misses : 0,
      };
    }
    if (v?.kind === 'double' && num(v.minReps) && num(v.maxReps) && num(v.increment)) {
      return { kind: 'double', minReps: v.minReps, maxReps: v.maxReps, increment: v.increment };
    }
  } catch {
    // Fall through: an unreadable rule is treated as none.
  }
  return null;
}
