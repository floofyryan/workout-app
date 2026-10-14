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
  'Full Body',
  'Cardio',
  'Other',
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

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

export interface TemplateExercise {
  exerciseId: number;
  restSeconds: number | null;
  notes: string;
  sets: SetData[];
}

export interface Template {
  id: number;
  name: string;
  notes: string;
  lastUsedAt: number | null;
  exercises: TemplateExercise[];
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
}

export interface WorkoutDetail extends WorkoutSummary {
  exercises: WorkoutExerciseDetail[];
}

export type UnitSystem = 'metric' | 'imperial';

export interface Settings {
  units: UnitSystem;
  defaultRestSeconds: number;
  /** Bar weight in the user's display unit. */
  barWeight: number;
  /** Available plates (per side) in the user's display unit. */
  plates: number[];
  vibrateOnRestEnd: boolean;
  keepScreenOn: boolean;
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
