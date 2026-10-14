import { estimate1RM } from './calc';
import { formatClock } from './format';
import type { ExerciseType, SetData, UnitSystem } from './types';
import { formatDistance, formatWeight } from './units';

/** Human readable set, e.g. "100 kg × 5", "+20 kg × 8", "12 reps", "5 km · 25:00". */
export function formatSet(type: ExerciseType, s: SetData, units: UnitSystem): string {
  switch (type) {
    case 'weight_reps':
      return `${formatWeight(s.weight ?? 0, units)} × ${s.reps ?? 0}`;
    case 'weighted_bodyweight':
      return s.weight ? `+${formatWeight(s.weight, units)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
    case 'assisted_bodyweight':
      return s.weight ? `−${formatWeight(s.weight, units)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
    case 'reps':
      return `${s.reps ?? 0} reps`;
    case 'duration':
      return formatClock(s.durationS ?? 0);
    case 'distance_duration': {
      const parts = [];
      if (s.distanceM) parts.push(formatDistance(s.distanceM, units));
      if (s.durationS) parts.push(formatClock(s.durationS));
      return parts.join(' · ') || '–';
    }
  }
}

/** The "best" set of a list (highest est. 1RM, most reps, longest...). */
export function bestSet(type: ExerciseType, sets: SetData[]): SetData | null {
  const working = sets.filter((s) => s.setType !== 'warmup');
  const pool = working.length ? working : sets;
  let best: SetData | null = null;
  let bestScore = -Infinity;
  for (const s of pool) {
    let score: number;
    switch (type) {
      case 'weight_reps':
      case 'weighted_bodyweight':
        score = estimate1RM(s.weight ?? 0, s.reps ?? 0) * 1000 + (s.reps ?? 0);
        break;
      case 'assisted_bodyweight':
        // Less assistance is better, then more reps.
        score = (s.reps ?? 0) - (s.weight ?? 0) * 1000;
        break;
      case 'reps':
        score = s.reps ?? 0;
        break;
      case 'duration':
        score = s.durationS ?? 0;
        break;
      case 'distance_duration':
        score = (s.distanceM ?? 0) * 1000 + (s.durationS ?? 0);
        break;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export const SET_TYPE_LABEL = { normal: '', warmup: 'W', drop: 'D', failure: 'F' } as const;
