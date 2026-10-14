import type { BodyPart, Equipment, ExerciseType, SetData } from './types';
import { EQUIPMENT } from './types';

// Order matters: more specific patterns come first (e.g. "leg curl" before "curl").
const KEYWORDS: [RegExp, BodyPart][] = [
  [/running|\brun\b|cycling|bike|rowing|walking|swim|elliptical|cardio|stair|hiking/i, 'Cardio'],
  [/leg curl|romanian|stiff leg|good morning|nordic/i, 'Hamstrings'],
  [/squat|lunge|leg press|leg extension|step up/i, 'Quads'],
  [/calf/i, 'Calves'],
  [/crunch|plank|sit ?up|\bab\b|abs|core|twist|leg raise|knee raise/i, 'Core'],
  [/hip thrust|glute|abduct|adduct/i, 'Glutes'],
  [/bench|chest|fly|push ?up|pec|dip/i, 'Chest'],
  [/row|pull ?up|chin ?up|pulldown|deadlift|shrug|\blat\b|back/i, 'Back'],
  [/tricep|skull|pushdown|extension/i, 'Triceps'],
  [/curl/i, 'Biceps'],
  [/press|raise|delt|shoulder|face pull/i, 'Shoulders'],
];

/** Best guess at metadata for an exercise name we've never seen, e.g. from an import. */
export function guessExercise(
  name: string,
  sets: SetData[],
): { equipment: Equipment; bodyPart: BodyPart; type: ExerciseType } {
  const paren = /\(([^)]+)\)\s*$/.exec(name)?.[1]?.trim().toLowerCase() ?? '';
  let equipment: Equipment =
    EQUIPMENT.find((e) => e.toLowerCase() === paren) ??
    (paren === 'assisted' || paren === 'weighted' ? 'Bodyweight' : 'Other');

  const hasWeight = sets.some((s) => (s.weight ?? 0) > 0);
  const hasReps = sets.some((s) => (s.reps ?? 0) > 0);
  const hasDistance = sets.some((s) => (s.distanceM ?? 0) > 0);
  const hasDuration = sets.some((s) => (s.durationS ?? 0) > 0);

  let type: ExerciseType;
  if (paren === 'assisted') type = 'assisted_bodyweight';
  else if (paren === 'weighted') type = 'weighted_bodyweight';
  else if (hasDistance) type = 'distance_duration';
  else if (hasDuration && !hasReps) type = 'duration';
  else if (!hasWeight && hasReps) type = 'reps';
  else type = 'weight_reps';
  // Plain bodyweight movements are tracked as reps only.
  if (equipment === 'Bodyweight' && type === 'weight_reps') type = 'reps';

  const base = name.replace(/\([^)]*\)\s*$/, '');
  let bodyPart: BodyPart = 'Other';
  for (const [re, part] of KEYWORDS) {
    if (re.test(base)) {
      bodyPart = part;
      break;
    }
  }
  if (type === 'distance_duration' && bodyPart === 'Other') bodyPart = 'Cardio';
  if (bodyPart === 'Cardio' && equipment === 'Other') equipment = 'Cardio';
  return { equipment, bodyPart, type };
}
