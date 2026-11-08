import { usesWeight } from '../lib/calc';
import { weightStep } from '../lib/progression';
import type { ExerciseType, Progression, SetData, TemplateExercise, UnitSystem } from '../lib/types';

export interface ProgramExerciseDef {
  /** Built-in exercise name. */
  name: string;
  sets: number;
  /** Target reps (the bottom of the range when `maxReps` is set). */
  reps: number;
  /** Top of the rep range: weighted exercises then use double progression. */
  maxReps?: number;
  /** Target time for timed holds, in seconds. */
  seconds?: number;
  /** Big lower-body lifts go up two steps at a time (5 kg / 10 lb). */
  bigStep?: boolean;
  rest?: number;
}

export interface ProgramDef {
  key: string;
  name: string;
  /** How often it's run, e.g. "3 days a week". */
  schedule: string;
  notes: string;
  /** Run as a training block of this many weeks (the last a deload). */
  blockWeeks?: number;
  workouts: { name: string; exercises: ProgramExerciseDef[] }[];
}

const MAIN = 180;
const ACCESSORY = 90;
const SMALL = 60;

/** Built-in programs. Workouts start without weights: the first session sets them. */
export const PROGRAMS: ProgramDef[] = [
  {
    key: '5x5',
    name: '5×5 Beginner',
    schedule: '3 days a week, alternating A and B',
    notes:
      'Three big barbell lifts per session, 5 sets of 5. Every time you get all your reps the weight goes up; after three misses in a row it drops 10% so you can build back up. Start light.',
    workouts: [
      {
        name: '5×5 A',
        exercises: [
          { name: 'Squat (Barbell)', sets: 5, reps: 5, rest: MAIN },
          { name: 'Bench Press (Barbell)', sets: 5, reps: 5, rest: MAIN },
          { name: 'Bent Over Row (Barbell)', sets: 5, reps: 5, rest: MAIN },
        ],
      },
      {
        name: '5×5 B',
        exercises: [
          { name: 'Squat (Barbell)', sets: 5, reps: 5, rest: MAIN },
          { name: 'Overhead Press (Barbell)', sets: 5, reps: 5, rest: MAIN },
          { name: 'Deadlift (Barbell)', sets: 1, reps: 5, bigStep: true, rest: MAIN },
        ],
      },
    ],
  },
  {
    key: 'upper-lower',
    name: 'Upper / Lower',
    schedule: '4 days a week',
    notes:
      'A heavy main lift that adds weight each session, then accessories in a rep range: add reps until you reach the top of the range, then add weight.',
    workouts: [
      {
        name: 'Upper A',
        exercises: [
          { name: 'Bench Press (Barbell)', sets: 3, reps: 5, rest: MAIN },
          { name: 'Bent Over Row (Barbell)', sets: 3, reps: 5, rest: MAIN },
          { name: 'Overhead Press (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Lat Pulldown (Cable)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Bicep Curl (Dumbbell)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Triceps Pushdown (Cable)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          { name: 'Squat (Barbell)', sets: 3, reps: 5, rest: MAIN },
          { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Leg Press (Machine)', sets: 3, reps: 10, maxReps: 15, rest: ACCESSORY },
          { name: 'Lying Leg Curl (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Standing Calf Raise (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          { name: 'Overhead Press (Barbell)', sets: 3, reps: 5, rest: MAIN },
          { name: 'Pull Up (Bodyweight)', sets: 3, reps: 6, rest: ACCESSORY },
          { name: 'Incline Bench Press (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Seated Row (Cable)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Lateral Raise (Dumbbell)', sets: 3, reps: 12, maxReps: 20, rest: SMALL },
          { name: 'Hammer Curl (Dumbbell)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          { name: 'Deadlift (Barbell)', sets: 1, reps: 5, bigStep: true, rest: MAIN },
          { name: 'Bulgarian Split Squat (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Hip Thrust (Barbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Leg Extension (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Hanging Leg Raise (Bodyweight)', sets: 3, reps: 8, rest: SMALL },
        ],
      },
    ],
  },
  {
    key: 'ppl',
    name: 'Push / Pull / Legs',
    schedule: '3 or 6 days a week',
    notes:
      'Chest, shoulders and triceps; back and biceps; legs. One heavy lift per day that adds weight each session, the rest in rep ranges.',
    workouts: [
      {
        name: 'Push',
        exercises: [
          { name: 'Bench Press (Barbell)', sets: 3, reps: 5, rest: MAIN },
          { name: 'Overhead Press (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Incline Bench Press (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Lateral Raise (Dumbbell)', sets: 3, reps: 12, maxReps: 20, rest: SMALL },
          { name: 'Triceps Pushdown (Cable)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          { name: 'Deadlift (Barbell)', sets: 1, reps: 5, bigStep: true, rest: MAIN },
          { name: 'Lat Pulldown (Cable)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Seated Row (Cable)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Face Pull (Cable)', sets: 3, reps: 12, maxReps: 20, rest: SMALL },
          { name: 'Bicep Curl (Barbell)', sets: 3, reps: 8, maxReps: 12, rest: SMALL },
        ],
      },
      {
        name: 'Legs',
        exercises: [
          { name: 'Squat (Barbell)', sets: 3, reps: 5, rest: MAIN },
          { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Leg Press (Machine)', sets: 3, reps: 10, maxReps: 15, rest: ACCESSORY },
          { name: 'Lying Leg Curl (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Standing Calf Raise (Machine)', sets: 4, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
    ],
  },
  {
    key: 'muscle-block',
    name: 'Muscle Building Block',
    schedule: '4 days a week, 5-week blocks',
    notes:
      'Upper / lower for building muscle, run in 5-week blocks: each week you push a little closer to failure, then a lighter deload week. After each workout, say how each exercise felt and next week gets a set more or less.',
    blockWeeks: 5,
    workouts: [
      {
        name: 'Upper 1',
        exercises: [
          { name: 'Incline Bench Press (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Seated Row (Cable)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Shoulder Press (Machine)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Lat Pulldown (Cable)', sets: 3, reps: 10, maxReps: 15, rest: ACCESSORY },
          { name: 'Lateral Raise (Cable)', sets: 2, reps: 12, maxReps: 20, rest: SMALL },
          { name: 'Bicep Curl (Dumbbell)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Lower 1',
        exercises: [
          { name: 'Hack Squat (Machine)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Romanian Deadlift (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Leg Extension (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Seated Leg Curl (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Seated Calf Raise (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Upper 2',
        exercises: [
          { name: 'Chest Press (Machine)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Chest Supported Row (Dumbbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Chest Fly (Machine)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Reverse Fly (Machine)', sets: 2, reps: 12, maxReps: 20, rest: SMALL },
          { name: 'Overhead Triceps Extension (Cable)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Hammer Curl (Dumbbell)', sets: 2, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
      {
        name: 'Lower 2',
        exercises: [
          { name: 'Leg Press (Machine)', sets: 3, reps: 10, maxReps: 15, rest: ACCESSORY },
          { name: 'Hip Thrust (Barbell)', sets: 3, reps: 8, maxReps: 12, rest: ACCESSORY },
          { name: 'Walking Lunge (Dumbbell)', sets: 2, reps: 10, maxReps: 15, rest: ACCESSORY },
          { name: 'Lying Leg Curl (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
          { name: 'Standing Calf Raise (Machine)', sets: 3, reps: 10, maxReps: 15, rest: SMALL },
        ],
      },
    ],
  },
  {
    key: 'bodyweight',
    name: 'Bodyweight Basics',
    schedule: '3 days a week, alternating A and B — no equipment',
    notes:
      'Done at home with no equipment (a sturdy table or bar for rows and chin-ups). Each exercise adds a rep, or 5 seconds on holds, whenever you hit every set.',
    workouts: [
      {
        name: 'Bodyweight A',
        exercises: [
          { name: 'Push Up (Bodyweight)', sets: 3, reps: 8, rest: ACCESSORY },
          { name: 'Inverted Row (Bodyweight)', sets: 3, reps: 8, rest: ACCESSORY },
          { name: 'Squat (Bodyweight)', sets: 3, reps: 15, rest: SMALL },
          { name: 'Glute Bridge (Bodyweight)', sets: 3, reps: 12, rest: SMALL },
          { name: 'Plank (Bodyweight)', sets: 3, reps: 0, seconds: 30, rest: SMALL },
        ],
      },
      {
        name: 'Bodyweight B',
        exercises: [
          { name: 'Diamond Push Up (Bodyweight)', sets: 3, reps: 6, rest: ACCESSORY },
          { name: 'Chin Up (Bodyweight)', sets: 3, reps: 4, rest: ACCESSORY },
          { name: 'Bulgarian Split Squat (Bodyweight)', sets: 3, reps: 8, rest: ACCESSORY },
          { name: 'Calf Raise (Bodyweight)', sets: 3, reps: 15, rest: SMALL },
          { name: 'Side Plank (Bodyweight)', sets: 2, reps: 0, seconds: 20, rest: SMALL },
        ],
      },
    ],
  },
];

/** A program exercise as a template exercise, with the rule that suits its type. */
export function programExercise(
  x: ProgramExerciseDef,
  exerciseId: number,
  type: ExerciseType,
  units: UnitSystem,
): TemplateExercise {
  const timed = type === 'duration';
  const sets: SetData[] = Array.from({ length: x.sets }, () => ({
    setType: 'normal',
    weight: null,
    reps: timed ? null : x.reps,
    durationS: timed ? (x.seconds ?? 30) : null,
    distanceM: null,
    rpe: null,
  }));
  const step = weightStep(units) * (x.bigStep ? 2 : 1);
  const progression: Progression =
    x.maxReps && usesWeight(type)
      ? { kind: 'double', minReps: x.reps, maxReps: x.maxReps, increment: step }
      : { kind: 'linear', increment: usesWeight(type) ? step : timed ? 5 : 1, deloadAfter: 3, deloadPercent: 10, misses: 0 };
  return { exerciseId, restSeconds: x.rest ?? null, notes: '', sets, supersetGroup: null, progression };
}
