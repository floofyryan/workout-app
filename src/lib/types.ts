export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Band',
  'Smith Machine',
  'EZ Bar',
  'Trap Bar',
  'Cardio',
  'Other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const BODY_PARTS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Neck',
  'Full Body',
  'Cardio',
  'Other',
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

/** Kind of exercise, independent of the body part it trains. */
export const EXERCISE_CATEGORIES = [
  'strength',
  'stretching',
  'cardio',
  'plyometrics',
  'olympic weightlifting',
  'strongman',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  stretching: 'Stretching',
  cardio: 'Cardio',
  plyometrics: 'Plyometrics',
  'olympic weightlifting': 'Olympic lifting',
  strongman: 'Strongman',
};

/**
 * The exercise's kind. free-exercise-db's "powerlifting" entries are barbell strength variants,
 * so they count as strength; exercises without a stored category fall back to their body part.
 */
export function exerciseCategory(e: { category: string | null; bodyPart: BodyPart }): ExerciseCategory {
  if (e.category && (EXERCISE_CATEGORIES as readonly string[]).includes(e.category)) {
    return e.category as ExerciseCategory;
  }
  return e.bodyPart === 'Cardio' ? 'cardio' : 'strength';
}

/** Determines which fields are tracked for each set of an exercise. */
export const EXERCISE_TYPES = [
  'weight_reps',
  'reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'duration',
  'distance_duration',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & reps',
  reps: 'Reps only',
  weighted_bodyweight: 'Weighted bodyweight (+weight)',
  assisted_bodyweight: 'Assisted bodyweight (−weight)',
  duration: 'Duration',
  distance_duration: 'Distance & duration',
};

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export interface Exercise {
  id: number;
  name: string;
  equipment: Equipment;
  bodyPart: BodyPart;
  type: ExerciseType;
  notes: string;
  isCustom: boolean;
  archived: boolean;
  restSeconds: number | null;
  /** free-exercise-db id when linked to it (supplies images and instructions). */
  sourceId: string | null;
  /** Image paths relative to the free-exercise-db image base URL. */
  images: string[];
  /** Step-by-step instructions (empty in list queries, which skip them). */
  instructions: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  level: string | null;
  category: string | null;
}

/** Values of a single set. Weight is always stored in kg, distance in metres. */
export interface SetData {
  setType: SetType;
  weight: number | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  rpe: number | null;
}

/**
 * How a template exercise's targets move on after each session.
 * - linear: when every set hits its target, add `increment` next time (kg for weighted exercises,
 *   reps for reps-only ones, seconds for timed holds); after `deloadAfter` misses in a row, take
 *   `deloadPercent` off. `misses` counts the misses so far.
 * - double: stay at a weight and add reps from `minReps` up to `maxReps`; once every set reaches
 *   `maxReps`, add `increment` kg and start again from `minReps`.
 */
export type Progression =
  | { kind: 'linear'; increment: number; deloadAfter: number; deloadPercent: number; misses?: number }
  | { kind: 'double'; minReps: number; maxReps: number; increment: number };

export interface TemplateExercise {
  exerciseId: number;
  restSeconds: number | null;
  notes: string;
  sets: SetData[];
  /** Exercises with the same number (next to each other) form a superset. */
  supersetGroup?: number | null;
  progression?: Progression | null;
}

export const TEMPLATE_KINDS = ['workout', 'stretch'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export interface Template {
  id: number;
  name: string;
  notes: string;
  /** Workout routines and stretch routines are listed separately. */
  kind: TemplateKind;
  /** Optional folder name for grouping templates on the Workout tab. */
  folder: string | null;
  /** The program this template is a workout of (programs are listed separately). */
  programId: number | null;
  lastUsedAt: number | null;
  exercises: TemplateExercise[];
}

/** Workouts done in rotation (A, B, A, …), usually with progression rules. */
export interface Program {
  id: number;
  name: string;
  notes: string;
  /** Its workouts, in rotation order. */
  templates: Template[];
  /** The workout due next: the one after the last one finished, or the first. */
  nextTemplateId: number | null;
}

export interface WorkoutSummary {
  id: number;
  name: string;
  notes: string;
  startedAt: number;
  endedAt: number;
  templateId: number | null;
}

export interface WorkoutExerciseDetail {
  id: number;
  exercise: Exercise;
  notes: string;
  sets: SetData[];
  supersetGroup: number | null;
}

export interface WorkoutDetail extends WorkoutSummary {
  exercises: WorkoutExerciseDetail[];
}

export type UnitSystem = 'metric' | 'imperial';

/** A place you train and the equipment it has. */
export interface Gym {
  id: string;
  name: string;
  equipment: Equipment[];
}

export interface Settings {
  units: UnitSystem;
  defaultRestSeconds: number;
  /** Bar weight in the user's display unit. */
  barWeight: number;
  /** Available plates (per side) in the user's display unit. */
  plates: number[];
  vibrateOnRestEnd: boolean;
  keepScreenOn: boolean;
  /** Notify when rest/hold timers end while the app is in the background or the screen is off. */
  timerNotifications: boolean;
  /** Which figure the exercise body map shows. */
  bodyMapFigure: 'goblin' | 'male' | 'female';
  gyms: Gym[];
  /** The gym you're training at: exercise lists and swaps stick to its equipment. Null = anywhere. */
  activeGymId: string | null;
}

export const MEASUREMENT_TYPES = [
  'bodyweight',
  'bodyfat',
  'neck',
  'shoulders',
  'chest',
  'waist',
  'hips',
  'left_bicep',
  'right_bicep',
  'left_forearm',
  'right_forearm',
  'left_thigh',
  'right_thigh',
  'left_calf',
  'right_calf',
] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

export interface Measurement {
  id: number;
  type: MeasurementType;
  /** kg for bodyweight, % for body fat, cm for lengths. */
  value: number;
  measuredAt: number;
}
