import type { Exercise, SetData, TemplateExercise } from './types';

/**
 * Equipment the user can tick. Exercise equipment names map onto these; bench, pull-up bar and
 * dip bars aren't exercise equipment in the library but decide whether many movements are possible.
 */
export const GEAR = [
  'Barbell',
  'Dumbbell',
  'Kettlebell',
  'EZ Bar',
  'Trap Bar',
  'Bench',
  'Pull-up bar',
  'Dip bars',
  'Cable',
  'Machine',
  'Smith Machine',
  'Band',
] as const;
export type Gear = (typeof GEAR)[number];

export const GEAR_PRESETS: { label: string; gear: Gear[] }[] = [
  { label: 'Full gym', gear: [...GEAR] },
  { label: 'Home gym', gear: ['Barbell', 'Dumbbell', 'Bench', 'Pull-up bar'] },
  { label: 'Dumbbells', gear: ['Dumbbell', 'Bench'] },
  { label: 'Bodyweight', gear: [] },
];

export type Split = 'full_body' | 'upper_lower' | 'ppl';
export const SPLIT_LABELS: Record<Split, string> = {
  full_body: 'Full body',
  upper_lower: 'Upper / Lower',
  ppl: 'Push / Pull / Legs',
};

export type Goal = 'strength' | 'muscle' | 'general';
export const GOAL_LABELS: Record<Goal, string> = {
  strength: 'Strength',
  muscle: 'Muscle',
  general: 'General fitness',
};

/** The split that suits a number of training days. */
export function recommendedSplit(days: number): Split {
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'ppl';
}

type Candidate = [name: string, ...needs: Gear[]];

// Each movement pattern lists exercises from the built-in library, best first.
const PATTERNS = {
  squat: [
    ['Squat (Barbell)'],
    ['Hack Squat (Machine)'],
    ['Leg Press (Machine)'],
    ['Squat (Smith Machine)'],
    ['Goblet Squat (Dumbbell)'],
    ['Goblet Squat (Kettlebell)'],
    ['Bulgarian Split Squat (Dumbbell)', 'Bench'],
    ['Bulgarian Split Squat (Bodyweight)', 'Bench'],
    ['Squat (Bodyweight)'],
  ],
  quads: [
    ['Leg Press (Machine)'],
    ['Front Squat (Barbell)'],
    ['Bulgarian Split Squat (Dumbbell)', 'Bench'],
    ['Walking Lunge (Dumbbell)'],
    ['Leg Extension (Machine)'],
    ['Lunge (Barbell)'],
    ['Step Up (Dumbbell)', 'Bench'],
    ['Goblet Squat (Kettlebell)'],
    ['Bulgarian Split Squat (Bodyweight)', 'Bench'],
    ['Lunge (Bodyweight)'],
    ['Pistol Squat (Bodyweight)'],
  ],
  deadlift: [
    ['Deadlift (Barbell)'],
    ['Deadlift (Trap Bar)'],
    ['Romanian Deadlift (Dumbbell)'],
    ['Kettlebell Swing (Kettlebell)'],
    ['Single Leg Romanian Deadlift (Dumbbell)'],
    ['Glute Bridge (Bodyweight)'],
  ],
  hinge: [
    ['Romanian Deadlift (Barbell)'],
    ['Romanian Deadlift (Dumbbell)'],
    ['Deadlift (Trap Bar)'],
    ['Good Morning (Barbell)'],
    ['Kettlebell Swing (Kettlebell)'],
    ['Single Leg Romanian Deadlift (Dumbbell)'],
    ['Nordic Curl (Bodyweight)'],
    ['Glute Bridge (Bodyweight)'],
  ],
  legCurl: [
    ['Lying Leg Curl (Machine)'],
    ['Seated Leg Curl (Machine)'],
    ['Single Leg Romanian Deadlift (Dumbbell)'],
    ['Nordic Curl (Bodyweight)'],
  ],
  glutes: [
    ['Hip Thrust (Barbell)', 'Bench'],
    ['Hip Thrust (Machine)'],
    ['Glute Bridge (Barbell)'],
    ['Glute Kickback (Cable)'],
    ['Lateral Band Walk (Band)'],
    ['Glute Bridge (Bodyweight)'],
  ],
  calves: [
    ['Standing Calf Raise (Machine)'],
    ['Calf Raise (Smith Machine)'],
    ['Seated Calf Raise (Machine)'],
    ['Calf Raise (Dumbbell)'],
    ['Calf Raise (Bodyweight)'],
  ],
  press: [
    ['Bench Press (Barbell)', 'Bench'],
    ['Bench Press (Dumbbell)', 'Bench'],
    ['Chest Press (Machine)'],
    ['Bench Press (Smith Machine)', 'Bench'],
    ['Floor Press (Barbell)'],
    ['Push Up (Bodyweight)'],
  ],
  inclinePress: [
    ['Incline Bench Press (Dumbbell)', 'Bench'],
    ['Incline Bench Press (Barbell)', 'Bench'],
    ['Incline Chest Press (Machine)'],
    ['Incline Bench Press (Smith Machine)', 'Bench'],
    ['Chest Dip (Bodyweight)', 'Dip bars'],
    ['Decline Push Up (Bodyweight)'],
  ],
  chestFly: [
    ['Cable Crossover (Cable)'],
    ['Chest Fly (Machine)'],
    ['Chest Fly (Dumbbell)', 'Bench'],
    ['Low Cable Fly (Cable)'],
    ['Chest Dip (Bodyweight)', 'Dip bars'],
    ['Push Up (Bodyweight)'],
  ],
  overheadPress: [
    ['Overhead Press (Barbell)'],
    ['Seated Overhead Press (Dumbbell)', 'Bench'],
    ['Overhead Press (Dumbbell)'],
    ['Shoulder Press (Machine)'],
    ['Arnold Press (Dumbbell)'],
    ['Landmine Press (Barbell)'],
    ['Handstand Push Up (Bodyweight)'],
  ],
  lateralRaise: [['Lateral Raise (Dumbbell)'], ['Lateral Raise (Cable)'], ['Lateral Raise (Machine)']],
  rearDelt: [
    ['Face Pull (Cable)'],
    ['Reverse Fly (Machine)'],
    ['Reverse Fly (Dumbbell)'],
    ['Band Pull Apart (Band)'],
  ],
  verticalPull: [
    ['Pull Up (Bodyweight)', 'Pull-up bar'],
    ['Lat Pulldown (Cable)'],
    ['Lat Pulldown (Machine)'],
    ['Chin Up (Bodyweight)', 'Pull-up bar'],
    ['Pull Up (Assisted)'],
    ['Close Grip Lat Pulldown (Cable)'],
  ],
  row: [
    ['Bent Over Row (Barbell)'],
    ['Seated Row (Cable)'],
    ['Chest Supported Row (Dumbbell)', 'Bench'],
    ['Seated Row (Machine)'],
    ['Bent Over Row (Dumbbell)'],
    ['T Bar Row (Barbell)'],
    ['Single Arm Row (Cable)'],
    ['Inverted Row (Bodyweight)', 'Pull-up bar'],
  ],
  biceps: [
    ['Bicep Curl (Barbell)'],
    ['Bicep Curl (Dumbbell)'],
    ['Bicep Curl (EZ Bar)'],
    ['Bicep Curl (Cable)'],
    ['Bicep Curl (Machine)'],
    ['Chin Up (Bodyweight)', 'Pull-up bar'],
  ],
  biceps2: [
    ['Hammer Curl (Dumbbell)'],
    ['Incline Curl (Dumbbell)', 'Bench'],
    ['Hammer Curl (Cable)'],
    ['Preacher Curl (EZ Bar)', 'Bench'],
    ['Preacher Curl (Machine)'],
    ['Bicep Curl (Cable)'],
  ],
  triceps: [
    ['Triceps Pushdown (Cable)'],
    ['Skullcrusher (EZ Bar)', 'Bench'],
    ['Close Grip Bench Press (Barbell)', 'Bench'],
    ['Overhead Triceps Extension (Dumbbell)'],
    ['Triceps Extension (Machine)'],
    ['Triceps Dip (Bodyweight)', 'Dip bars'],
    ['Diamond Push Up (Bodyweight)'],
  ],
  triceps2: [
    ['Overhead Triceps Extension (Cable)'],
    ['Rope Pushdown (Cable)'],
    ['Overhead Triceps Extension (Dumbbell)'],
    ['Skullcrusher (Dumbbell)', 'Bench'],
    ['Triceps Kickback (Dumbbell)'],
    ['Bench Dip (Bodyweight)', 'Bench'],
    ['Diamond Push Up (Bodyweight)'],
  ],
  core: [
    ['Hanging Leg Raise (Bodyweight)', 'Pull-up bar'],
    ['Cable Crunch (Cable)'],
    ['Plank (Bodyweight)'],
    ['Pallof Press (Cable)'],
    ['Dead Bug (Bodyweight)'],
    ['Lying Leg Raise (Bodyweight)'],
    ['Side Plank (Bodyweight)'],
    ['Hollow Hold (Bodyweight)'],
  ],
} satisfies Record<string, Candidate[]>;
type Pattern = keyof typeof PATTERNS;

/** Main lifts get heavier, lower-rep work; the rest are accessories. */
const MAIN_LIFTS = new Set<Pattern>(['squat', 'deadlift', 'press', 'overheadPress']);

interface DayLayout {
  name: string;
  slots: Pattern[];
}

const LAYOUTS: Record<Split, DayLayout[]> = {
  full_body: [
    { name: 'Full Body A', slots: ['squat', 'press', 'row', 'hinge', 'lateralRaise', 'core'] },
    { name: 'Full Body B', slots: ['deadlift', 'overheadPress', 'verticalPull', 'quads', 'biceps', 'triceps'] },
    { name: 'Full Body C', slots: ['quads', 'inclinePress', 'row', 'glutes', 'rearDelt', 'core'] },
  ],
  upper_lower: [
    { name: 'Upper A', slots: ['press', 'row', 'overheadPress', 'verticalPull', 'biceps', 'triceps'] },
    { name: 'Lower A', slots: ['squat', 'hinge', 'quads', 'legCurl', 'calves', 'core'] },
    { name: 'Upper B', slots: ['inclinePress', 'verticalPull', 'row', 'lateralRaise', 'biceps2', 'triceps2'] },
    { name: 'Lower B', slots: ['deadlift', 'quads', 'glutes', 'legCurl', 'calves', 'core'] },
  ],
  ppl: [
    { name: 'Push', slots: ['press', 'overheadPress', 'inclinePress', 'chestFly', 'lateralRaise', 'triceps'] },
    { name: 'Pull', slots: ['verticalPull', 'row', 'row', 'rearDelt', 'biceps', 'biceps2'] },
    { name: 'Legs', slots: ['squat', 'hinge', 'quads', 'legCurl', 'calves', 'core'] },
  ],
};

interface Scheme {
  sets: number;
  reps: number;
  rest: number;
}
const SCHEMES: Record<Goal, { main: Scheme; accessory: Scheme; holdS: number }> = {
  strength: { main: { sets: 5, reps: 5, rest: 180 }, accessory: { sets: 3, reps: 8, rest: 90 }, holdS: 45 },
  muscle: { main: { sets: 3, reps: 8, rest: 120 }, accessory: { sets: 3, reps: 12, rest: 75 }, holdS: 45 },
  general: { main: { sets: 3, reps: 10, rest: 90 }, accessory: { sets: 3, reps: 15, rest: 60 }, holdS: 30 },
};

export interface GenerateOptions {
  gear: Gear[];
  split: Split;
  goal: Goal;
  /** Training days, 0 = Monday … 6 = Sunday. */
  weekdays: number[];
  /** Different seeds pick different (still suitable) exercises. 0 = the best match for each slot. */
  seed: number;
}

export interface GeneratedExercise extends TemplateExercise {
  name: string;
}

export interface GeneratedWorkout {
  name: string;
  exercises: GeneratedExercise[];
}

export interface GeneratedProgram {
  name: string;
  workouts: GeneratedWorkout[];
  /** Which workout (index into `workouts`) goes on which weekday. */
  schedule: { weekday: number; workout: number }[];
}

type LibraryExercise = Pick<Exercise, 'id' | 'name' | 'equipment' | 'type' | 'archived'>;

/** Whether an exercise can be done with the given gear (bodyweight always can). */
export function isAvailable(e: Pick<Exercise, 'equipment'>, needs: Gear[], gear: Set<Gear>): boolean {
  const own = e.equipment === 'Bodyweight' || gear.has(e.equipment as Gear);
  return own && needs.every((n) => gear.has(n));
}

/** Small seeded PRNG so a given seed always gives the same program. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSets(e: LibraryExercise, scheme: Scheme, holdS: number): SetData[] {
  const base: SetData = { setType: 'normal', weight: null, reps: null, durationS: null, distanceM: null, rpe: null };
  const set: SetData = e.type === 'duration' ? { ...base, durationS: holdS } : { ...base, reps: scheme.reps };
  return Array.from({ length: scheme.sets }, () => ({ ...set }));
}

/** Builds a training program from the exercise library for the user's gear, split and goal. */
export function generateProgram(opts: GenerateOptions, library: LibraryExercise[]): GeneratedProgram {
  const byName = new Map(library.filter((e) => !e.archived).map((e) => [e.name.toLowerCase(), e]));
  const gear = new Set(opts.gear);
  const rand = random(opts.seed);
  const weekdays = [...new Set(opts.weekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const layouts = LAYOUTS[opts.split];
  const count = Math.max(1, Math.min(layouts.length, weekdays.length));
  const scheme = SCHEMES[opts.goal];
  const usedInProgram = new Set<number>();

  const options = (pattern: Pattern) =>
    (PATTERNS[pattern] as Candidate[])
      .map(([name, ...needs]) => ({ e: byName.get(name.toLowerCase()), needs }))
      .filter((c): c is { e: LibraryExercise; needs: Gear[] } => !!c.e && isAvailable(c.e, c.needs, gear))
      .map((c) => c.e);

  const workouts = layouts.slice(0, count).map((layout) => {
    const usedToday = new Set<number>();
    const exercises: GeneratedExercise[] = [];
    for (const slot of layout.slots) {
      const all = options(slot).filter((e) => !usedToday.has(e.id));
      if (all.length === 0) continue;
      // Prefer exercises not used on another day, for variety across the week.
      const fresh = all.filter((e) => !usedInProgram.has(e.id));
      const pool = (fresh.length > 0 ? fresh : all).slice(0, opts.seed === 0 ? 1 : 3);
      const e = pool[Math.floor(rand() * pool.length)];
      usedToday.add(e.id);
      usedInProgram.add(e.id);
      const s = MAIN_LIFTS.has(slot) && exercises.length < 2 ? scheme.main : scheme.accessory;
      exercises.push({ exerciseId: e.id, name: e.name, restSeconds: s.rest, notes: '', sets: makeSets(e, s, scheme.holdS) });
    }
    return { name: layout.name, exercises };
  });

  return {
    name: SPLIT_LABELS[opts.split],
    workouts,
    schedule: weekdays.map((weekday, i) => ({ weekday, workout: i % workouts.length })),
  };
}
