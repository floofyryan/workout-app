// Conversion rules for entries from free-exercise-db (https://github.com/yuhonas/free-exercise-db,
// public domain). Kept free of React Native imports so it can be unit tested.
import type { BodyPart, Equipment, ExerciseType } from './types';

export interface FreeExercise {
  id: string;
  name: string;
  equipment: string | null;
  category: string;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

export const FREE_EXERCISE_DB_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export function imageUrl(path: string): string {
  return FREE_EXERCISE_DB_IMAGE_BASE + path;
}

const EQUIPMENT_MAP: Record<string, Equipment> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  'body only': 'Bodyweight',
  kettlebells: 'Kettlebell',
  bands: 'Band',
  'e-z curl bar': 'EZ Bar',
};

const MUSCLE_MAP: Record<string, BodyPart> = {
  abdominals: 'Core',
  abductors: 'Glutes',
  adductors: 'Glutes',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Back',
  'lower back': 'Back',
  'middle back': 'Back',
  neck: 'Neck',
  quadriceps: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Back',
  triceps: 'Triceps',
};

export function toEquipment(e: FreeExercise): Equipment {
  if (e.category === 'cardio') return 'Cardio';
  // Entries without equipment are bodyweight movements or stretches.
  if (e.equipment == null) return e.category === 'stretching' ? 'Other' : 'Bodyweight';
  return EQUIPMENT_MAP[e.equipment] ?? 'Other';
}

export function toBodyPart(e: FreeExercise): BodyPart {
  if (e.category === 'cardio') return 'Cardio';
  // Olympic lifts and strongman events work the whole body, whatever muscle is listed first.
  if (e.category === 'olympic weightlifting' || e.category === 'strongman') return 'Full Body';
  return MUSCLE_MAP[e.primaryMuscles[0]] ?? 'Other';
}

export function toExerciseType(e: FreeExercise): ExerciseType {
  if (e.category === 'stretching') return 'duration';
  if (e.category === 'cardio') {
    return /running|walking|bicycling|rowing|trail/i.test(e.id) ? 'distance_duration' : 'duration';
  }
  // Bodyweight movements are tracked as reps only (no weight column).
  if (toEquipment(e) === 'Bodyweight' || e.category === 'plyometrics') return 'reps';
  return 'weight_reps';
}

const SUFFIX_WORDS: Partial<Record<Equipment, RegExp>> = {
  Barbell: /barbell/i,
  Dumbbell: /dumbbell|\bdb\b/i,
  Cable: /cable|pulley/i,
  Machine: /machine|leverage|smith/i,
  Kettlebell: /kettlebell/i,
  Band: /band/i,
  'EZ Bar': /ez|e-z/i,
  Bodyweight: /body ?weight|body only/i,
};

/** "Alternate Hammer Curl" → "Alternate Hammer Curl (Dumbbell)", matching the built-in naming style. */
export function displayName(e: FreeExercise): string {
  const equipment = toEquipment(e);
  const re = SUFFIX_WORDS[equipment];
  if (e.category === 'stretching' || e.category === 'cardio' || !re || re.test(e.name)) return e.name;
  return `${e.name} (${equipment})`;
}
