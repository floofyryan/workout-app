import { parseCsv, toCsv } from './csv';
import type { SetData, SetType, UnitSystem } from './types';
import { displayToKg, displayToMetres, kgToDisplay, metresToDisplay, clean } from './units';

export interface ImportedExercise {
  name: string;
  notes: string;
  sets: SetData[];
}

export interface ImportedWorkout {
  name: string;
  notes: string;
  startedAt: number;
  durationS: number;
  exercises: ImportedExercise[];
}

export interface ImportResult {
  workouts: ImportedWorkout[];
  skippedRows: number;
}

/** Parses "1h 5m", "45m", "30s", "1:05:00" or plain seconds into seconds. */
export function parseStrongDuration(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d+(:\d+){1,2}$/.test(t)) return t.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*([hms])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    total += unit === 'h' ? n * 3600 : unit === 'm' ? n * 60 : n;
  }
  return Math.round(total);
}

/** Parses "2023-01-15 08:30:00" (local time) and ISO variants. Returns NaN if invalid. */
export function parseStrongDate(text: string): number {
  const t = text.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  }
  return new Date(t).getTime();
}

function num(text: string | undefined): number | null {
  if (text == null) return null;
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function setTypeFromOrder(order: string): SetType {
  switch (order.trim().toUpperCase()) {
    case 'W':
      return 'warmup';
    case 'D':
      return 'drop';
    case 'F':
      return 'failure';
    default:
      return 'normal';
  }
}

/**
 * Parses a workout export from the Strong app (or this app's own CSV export).
 * `units` is the unit the weights/distances in the file are in, used when the
 * file has no explicit unit columns.
 */
export function parseStrongCsv(text: string, units: UnitSystem): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { workouts: [], skippedRows: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = {
    date: col('date'),
    workoutName: col('workout name'),
    duration: col('duration', 'workout duration'),
    exercise: col('exercise name'),
    setOrder: col('set order'),
    weight: col('weight'),
    weightUnit: col('weight unit'),
    reps: col('reps'),
    distance: col('distance'),
    distanceUnit: col('distance unit'),
    seconds: col('seconds'),
    notes: col('notes'),
    workoutNotes: col('workout notes'),
    rpe: col('rpe'),
  };
  if (c.date < 0 || c.exercise < 0) {
    throw new Error('This does not look like a Strong export: missing "Date" or "Exercise Name" column.');
  }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  const byKey = new Map<string, ImportedWorkout>();
  let skippedRows = 0;

  for (const r of rows.slice(1)) {
    const exerciseName = get(r, c.exercise);
    const order = get(r, c.setOrder);
    const startedAt = parseStrongDate(get(r, c.date));
    if (!exerciseName || Number.isNaN(startedAt) || order.toLowerCase() === 'rest timer') {
      skippedRows++;
      continue;
    }
    const workoutName = get(r, c.workoutName) || 'Workout';
    const key = `${startedAt}|${workoutName}`;
    let w = byKey.get(key);
    if (!w) {
      w = {
        name: workoutName,
        notes: get(r, c.workoutNotes),
        startedAt,
        durationS: parseStrongDuration(get(r, c.duration)),
        exercises: [],
      };
      byKey.set(key, w);
    }

    let ex = w.exercises[w.exercises.length - 1];
    if (!ex || ex.name !== exerciseName) {
      ex = { name: exerciseName, notes: '', sets: [] };
      w.exercises.push(ex);
    }
    const setNote = get(r, c.notes);
    if (setNote && !ex.notes.includes(setNote)) ex.notes = ex.notes ? `${ex.notes}\n${setNote}` : setNote;

    const wUnit = get(r, c.weightUnit).toLowerCase();
    const weightUnits: UnitSystem = wUnit === 'kg' ? 'metric' : wUnit.startsWith('lb') ? 'imperial' : units;
    const dUnit = get(r, c.distanceUnit).toLowerCase();
    const weight = num(get(r, c.weight));
    const distance = num(get(r, c.distance));
    let distanceM: number | null = null;
    if (distance != null && distance > 0) {
      if (dUnit === 'm') distanceM = distance;
      else if (dUnit === 'km') distanceM = distance * 1000;
      else if (dUnit.startsWith('mi')) distanceM = displayToMetres(distance, 'imperial');
      else if (dUnit === 'ft') distanceM = distance * 0.3048;
      else distanceM = displayToMetres(distance, units);
    }
    const reps = num(get(r, c.reps));
    const seconds = num(get(r, c.seconds));
    const rpe = num(get(r, c.rpe));

    ex.sets.push({
      setType: setTypeFromOrder(order),
      weight: weight != null && weight !== 0 ? displayToKg(weight, weightUnits) : null,
      reps: reps != null && reps !== 0 ? Math.round(reps) : null,
      durationS: seconds != null && seconds !== 0 ? Math.round(seconds) : null,
      distanceM,
      rpe: rpe != null && rpe !== 0 ? rpe : null,
    });
  }

  const workouts = [...byKey.values()]
    .map((w) => ({ ...w, exercises: w.exercises.filter((e) => e.sets.length > 0) }))
    .filter((w) => w.exercises.length > 0)
    .sort((a, b) => a.startedAt - b.startedAt);
  return { workouts, skippedRows };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatStrongDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

function formatStrongDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Exports workouts in a Strong-compatible CSV layout (so it can be re-imported here or elsewhere). */
export function workoutsToStrongCsv(workouts: ImportedWorkout[], units: UnitSystem): string {
  const rows: (string | number | null)[][] = [
    ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Weight Unit', 'Reps', 'Distance', 'Distance Unit', 'Seconds', 'Notes', 'Workout Notes', 'RPE'],
  ];
  const wUnit = units === 'metric' ? 'kg' : 'lbs';
  const dUnit = units === 'metric' ? 'km' : 'mi';
  for (const w of workouts) {
    for (const ex of w.exercises) {
      let n = 0;
      for (const s of ex.sets) {
        const order =
          s.setType === 'warmup' ? 'W' : s.setType === 'drop' ? 'D' : s.setType === 'failure' ? 'F' : String(++n);
        rows.push([
          formatStrongDate(w.startedAt),
          w.name,
          formatStrongDuration(w.durationS),
          ex.name,
          order,
          s.weight != null ? clean(kgToDisplay(s.weight, units), 2) : 0,
          wUnit,
          s.reps ?? 0,
          s.distanceM != null ? clean(metresToDisplay(s.distanceM, units), 3) : 0,
          dUnit,
          s.durationS ?? 0,
          ex.notes,
          w.notes,
          s.rpe ?? '',
        ]);
      }
    }
  }
  return toCsv(rows);
}
