// Workout history exports from other apps: Strong (see strongCsv), Hevy and FitNotes. All of them
// become ImportedWorkout lists, which the database layer imports the same way.
import { parseCsv } from './csv';
import { guessExercise } from './exerciseGuess';
import { parseStrongCsv, parseStrongDuration, type ImportedExercise, type ImportedWorkout, type ImportResult } from './strongCsv';
import type { BodyPart, SetType, UnitSystem } from './types';
import { displayToKg, displayToMetres } from './units';

export type CsvFormat = 'strong' | 'hevy' | 'fitnotes';

export const CSV_FORMAT_LABELS: Record<CsvFormat, string> = { strong: 'Strong', hevy: 'Hevy', fitnotes: 'FitNotes' };

function header(text: string): string[] {
  return (parseCsv(text)[0] ?? []).map((h) => h.trim().toLowerCase());
}

/** Which app a CSV export came from, by its columns. */
export function detectCsvFormat(text: string): CsvFormat | null {
  const h = header(text);
  if (h.includes('exercise_title') && h.includes('start_time')) return 'hevy';
  if (h.includes('exercise name') && h.includes('date')) return 'strong';
  if (h.includes('exercise') && h.includes('date')) return 'fitnotes';
  return null;
}

/** Whether the file says which weight unit it uses (otherwise the user is asked). */
export function csvStatesWeightUnit(text: string): boolean {
  const h = header(text);
  return h.includes('weight_kg') || h.includes('weight_lbs') || h.includes('weight unit');
}

/** Parses an export from Strong, Hevy or FitNotes. `units` applies when the file doesn't say. */
export function parseWorkoutCsv(text: string, units: UnitSystem): ImportResult & { format: CsvFormat } {
  const format = detectCsvFormat(text);
  if (!format) {
    throw new Error("This doesn't look like a workout export from Strong, Hevy or FitNotes.");
  }
  const result =
    format === 'hevy' ? parseHevyCsv(text) : format === 'fitnotes' ? parseFitNotesCsv(text, units) : parseStrongCsv(text, units);
  return { ...result, format };
}

// ---------- Shared helpers ----------

function columns(rows: string[][]) {
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => h.indexOf(n)).find((i) => i >= 0) ?? -1;
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return { col, get };
}

/** A positive number, or null for blanks, zeros and junk (apps write 0 for "not used"). */
function positive(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

function distanceToMetres(value: number | null, unit: string, units: UnitSystem): number | null {
  if (value == null) return null;
  const u = unit.toLowerCase();
  if (u === 'm' || u.startsWith('metre') || u.startsWith('meter')) return value;
  if (u === 'km' || u.startsWith('kilomet')) return value * 1000;
  if (u.startsWith('mi')) return displayToMetres(value, 'imperial');
  if (u === 'ft' || u.startsWith('feet')) return value * 0.3048;
  if (u === 'yd' || u.startsWith('yard')) return value * 0.9144;
  return displayToMetres(value, units);
}

/** Adds a set to the workout's last exercise, or starts a new exercise when the name changes. */
function addSet(
  w: ImportedWorkout,
  name: string,
  set: ImportedExercise['sets'][number],
  extra: Partial<ImportedExercise> = {},
) {
  let ex = w.exercises[w.exercises.length - 1];
  if (!ex || ex.name !== name) {
    ex = { name, notes: '', sets: [], ...extra };
    w.exercises.push(ex);
  }
  ex.sets.push(set);
  return ex;
}

const sortedWorkouts = (byKey: Map<string, ImportedWorkout>) =>
  [...byKey.values()].filter((w) => w.exercises.length > 0).sort((a, b) => a.startedAt - b.startedAt);

// ---------- Hevy ----------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Hevy writes local times like "22 Dec 2025, 08:00". Returns NaN if it isn't a date. */
export function parseHevyDate(text: string): number {
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text.trim());
  if (m && MONTHS[m[2].toLowerCase()] != null) {
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  }
  return text.trim() ? new Date(text.trim()).getTime() : NaN;
}

const HEVY_SET_TYPES: Record<string, SetType> = { warmup: 'warmup', dropset: 'drop', drop: 'drop', failure: 'failure' };

/** Parses Hevy's "Export Workouts" CSV (one row per set; weights in kg or lb as the header says). */
export function parseHevyCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { workouts: [], skippedRows: 0 };
  const { col, get } = columns(rows);
  const c = {
    title: col('title'),
    start: col('start_time'),
    end: col('end_time'),
    description: col('description'),
    exercise: col('exercise_title'),
    superset: col('superset_id'),
    exerciseNotes: col('exercise_notes'),
    setType: col('set_type'),
    kg: col('weight_kg'),
    lbs: col('weight_lbs'),
    reps: col('reps'),
    km: col('distance_km'),
    miles: col('distance_miles'),
    seconds: col('duration_seconds'),
    rpe: col('rpe'),
  };
  const byKey = new Map<string, ImportedWorkout>();
  let skippedRows = 0;
  for (const r of rows.slice(1)) {
    const name = get(r, c.exercise);
    const startedAt = parseHevyDate(get(r, c.start));
    if (!name || Number.isNaN(startedAt)) {
      skippedRows++;
      continue;
    }
    const title = get(r, c.title) || 'Workout';
    const key = `${startedAt}|${title}`;
    let w = byKey.get(key);
    if (!w) {
      const endedAt = parseHevyDate(get(r, c.end));
      w = {
        name: title,
        notes: get(r, c.description),
        startedAt,
        durationS: endedAt > startedAt ? Math.round((endedAt - startedAt) / 1000) : 0,
        exercises: [],
      };
      byKey.set(key, w);
    }
    const lbs = positive(get(r, c.lbs));
    const kg = positive(get(r, c.kg));
    const reps = positive(get(r, c.reps));
    const superset = get(r, c.superset);
    const ex = addSet(
      w,
      name,
      {
        setType: HEVY_SET_TYPES[get(r, c.setType).toLowerCase()] ?? 'normal',
        weight: kg ?? (lbs != null ? displayToKg(lbs, 'imperial') : null),
        reps: reps == null ? null : Math.round(reps),
        durationS: positive(get(r, c.seconds)),
        distanceM: distanceToMetres(positive(get(r, c.km)), 'km', 'metric') ?? distanceToMetres(positive(get(r, c.miles)), 'mi', 'metric'),
        rpe: positive(get(r, c.rpe)),
      },
      // Hevy numbers supersets from 0; here 0 would read as "none".
      { supersetGroup: superset !== '' && Number.isFinite(Number(superset)) ? Number(superset) + 1 : null },
    );
    const note = get(r, c.exerciseNotes);
    if (note && !ex.notes.includes(note)) ex.notes = ex.notes ? `${ex.notes}\n${note}` : note;
  }
  return { workouts: sortedWorkouts(byKey), skippedRows };
}

// ---------- FitNotes ----------

const FITNOTES_CATEGORIES: Record<string, BodyPart> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  legs: 'Quads',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Core',
  core: 'Core',
  cardio: 'Cardio',
};

/**
 * FitNotes' built-in exercise names that are clearly one of ours, so their history joins the
 * built-in exercise instead of a new custom one. Ambiguous ones (e.g. "Preacher Curl") are left out.
 */
const FITNOTES_NAMES: Record<string, string> = {
  'flat barbell bench press': 'Bench Press (Barbell)',
  'incline barbell bench press': 'Incline Bench Press (Barbell)',
  'decline barbell bench press': 'Decline Bench Press (Barbell)',
  'flat dumbbell bench press': 'Bench Press (Dumbbell)',
  'incline dumbbell bench press': 'Incline Bench Press (Dumbbell)',
  'decline dumbbell bench press': 'Decline Bench Press (Dumbbell)',
  'flat dumbbell fly': 'Chest Fly (Dumbbell)',
  'incline dumbbell fly': 'Incline Chest Fly (Dumbbell)',
  'cable crossover': 'Cable Crossover (Cable)',
  'close grip barbell bench press': 'Close Grip Bench Press (Barbell)',
  'barbell squat': 'Squat (Barbell)',
  'barbell front squat': 'Front Squat (Barbell)',
  'leg press': 'Leg Press (Machine)',
  'leg extension machine': 'Leg Extension (Machine)',
  'lying leg curl machine': 'Lying Leg Curl (Machine)',
  'seated leg curl machine': 'Seated Leg Curl (Machine)',
  'romanian deadlift': 'Romanian Deadlift (Barbell)',
  'stiff-legged deadlift': 'Stiff Leg Deadlift (Barbell)',
  deadlift: 'Deadlift (Barbell)',
  'barbell row': 'Bent Over Row (Barbell)',
  'lat pulldown': 'Lat Pulldown (Cable)',
  'seated cable row': 'Seated Row (Cable)',
  'pull up': 'Pull Up (Bodyweight)',
  'chin up': 'Chin Up (Bodyweight)',
  'overhead press': 'Overhead Press (Barbell)',
  'seated dumbbell press': 'Seated Overhead Press (Dumbbell)',
  'lateral dumbbell raise': 'Lateral Raise (Dumbbell)',
  'front dumbbell raise': 'Front Raise (Dumbbell)',
  'barbell shrug': 'Shrug (Barbell)',
  'dumbbell shrug': 'Shrug (Dumbbell)',
  'barbell curl': 'Bicep Curl (Barbell)',
  'dumbbell curl': 'Bicep Curl (Dumbbell)',
  'ez-bar curl': 'Bicep Curl (EZ Bar)',
  'hammer curl': 'Hammer Curl (Dumbbell)',
  'ez-bar skullcrusher': 'Skullcrusher (EZ Bar)',
  'dumbbell skullcrusher': 'Skullcrusher (Dumbbell)',
  'cable overhead triceps extension': 'Overhead Triceps Extension (Cable)',
  'parallel bar triceps dip': 'Triceps Dip (Bodyweight)',
  'rope push down': 'Rope Pushdown (Cable)',
  'v-bar push down': 'Triceps Pushdown (Cable)',
  'standing calf raise machine': 'Standing Calf Raise (Machine)',
  'seated calf raise machine': 'Seated Calf Raise (Machine)',
  'dumbbell calf raise': 'Calf Raise (Dumbbell)',
  'barbell glute bridge': 'Glute Bridge (Barbell)',
  'cable crunch': 'Cable Crunch (Cable)',
  crunch: 'Crunch (Bodyweight)',
  'hanging leg raise': 'Hanging Leg Raise (Bodyweight)',
  plank: 'Plank (Bodyweight)',
  'ab-wheel rollout': 'Ab Wheel Rollout (Bodyweight)',
  'dumbbell lunges': 'Lunge (Dumbbell)',
  'push up': 'Push Up (Bodyweight)',
  'rowing machine': 'Rowing (Machine)',
  'elliptical trainer': 'Elliptical (Machine)',
  'stationary bike': 'Cycling (Indoor)',
};

/** Exercise name in this app for a FitNotes exercise name. */
export function fitNotesExerciseName(name: string): string {
  return FITNOTES_NAMES[name.trim().toLowerCase()] ?? name.trim();
}

const LEG_PARTS: readonly BodyPart[] = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];

/**
 * Body part for a FitNotes exercise: its category (the user's own filing), except that "Legs"
 * covers several parts, so there the name decides when it can ("Leg Curl" → Hamstrings).
 */
function fitNotesBodyPart(category: string, name: string): BodyPart | undefined {
  const part = FITNOTES_CATEGORIES[category.toLowerCase()];
  if (part !== 'Quads') return part;
  const guessed = guessExercise(name, []).bodyPart;
  return LEG_PARTS.includes(guessed) ? guessed : part;
}

/** Workout name from the body parts trained, e.g. "Chest & Triceps". */
function nameFromCategories(categories: string[]): string {
  const unique = [...new Set(categories.filter(Boolean))];
  if (unique.length === 0) return 'Workout';
  return unique.length > 3 ? 'Full Body' : unique.join(' & ');
}

/**
 * Parses FitNotes' CSV export: one row per set with a date but no time, so each day becomes one
 * workout (placed at noon, with no recorded length).
 */
export function parseFitNotesCsv(text: string, units: UnitSystem): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { workouts: [], skippedRows: 0 };
  const { col, get } = columns(rows);
  const c = {
    date: col('date'),
    exercise: col('exercise'),
    category: col('category'),
    weight: col('weight', 'weight (kgs)', 'weight (lbs)'),
    weightUnit: col('weight unit'),
    reps: col('reps'),
    distance: col('distance'),
    distanceUnit: col('distance unit'),
    time: col('time'),
    comment: col('comment', 'notes'),
  };
  const byDay = new Map<string, { workout: ImportedWorkout; categories: string[] }>();
  let skippedRows = 0;
  for (const r of rows.slice(1)) {
    const name = get(r, c.exercise);
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(get(r, c.date));
    if (!name || !day) {
      skippedRows++;
      continue;
    }
    let entry = byDay.get(day[0]);
    if (!entry) {
      const startedAt = new Date(+day[1], +day[2] - 1, +day[3], 12, 0, 0).getTime();
      entry = { workout: { name: '', notes: '', startedAt, durationS: 0, exercises: [] }, categories: [] };
      byDay.set(day[0], entry);
    }
    const category = get(r, c.category);
    entry.categories.push(category);
    const unit = get(r, c.weightUnit).toLowerCase();
    const weightUnits: UnitSystem = unit.startsWith('kg') ? 'metric' : unit.startsWith('lb') ? 'imperial' : units;
    const weight = positive(get(r, c.weight));
    const reps = positive(get(r, c.reps));
    const time = get(r, c.time);
    const ex = addSet(
      entry.workout,
      fitNotesExerciseName(name),
      {
        setType: 'normal',
        weight: weight == null ? null : displayToKg(weight, weightUnits),
        reps: reps == null ? null : Math.round(reps),
        durationS: time ? parseStrongDuration(time) || null : null,
        distanceM: distanceToMetres(positive(get(r, c.distance)), get(r, c.distanceUnit), units),
        rpe: null,
      },
      { bodyPartHint: fitNotesBodyPart(category, name) },
    );
    const comment = get(r, c.comment);
    if (comment && !ex.notes.includes(comment)) ex.notes = ex.notes ? `${ex.notes}\n${comment}` : comment;
  }
  for (const { workout, categories } of byDay.values()) workout.name = nameFromCategories(categories);
  return { workouts: sortedWorkouts(new Map([...byDay].map(([k, v]) => [k, v.workout]))), skippedRows };
}
