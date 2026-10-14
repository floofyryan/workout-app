import type { SQLiteDatabase } from 'expo-sqlite';

import { computeRecords, type Records } from '../lib/calc';
import { guessExercise } from '../lib/exerciseGuess';
import type { ImportedWorkout } from '../lib/strongCsv';
import type {
  BodyPart,
  Equipment,
  Exercise,
  ExerciseType,
  Measurement,
  MeasurementType,
  SetData,
  SetType,
  Settings,
  Template,
  TemplateExercise,
  TemplateKind,
  WorkoutDetail,
  WorkoutExerciseDetail,
  WorkoutSummary,
} from '../lib/types';

// ---------- Row types & mappers ----------

interface ExerciseRow {
  id: number;
  name: string;
  equipment: string;
  body_part: string;
  type: string;
  notes: string;
  is_custom: number;
  archived: number;
  rest_seconds: number | null;
  source_id: string | null;
  images: string;
  instructions?: string;
  primary_muscles: string;
  secondary_muscles: string;
  level: string | null;
  category: string | null;
}

function parseList(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Every exercise column except the (large) instructions, for list queries.
const EXERCISE_LIST_COLUMNS =
  'id, name, equipment, body_part, type, notes, is_custom, archived, rest_seconds, source_id, images, primary_muscles, secondary_muscles, level, category';

function toExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    equipment: r.equipment as Equipment,
    bodyPart: r.body_part as BodyPart,
    type: r.type as ExerciseType,
    notes: r.notes,
    isCustom: !!r.is_custom,
    archived: !!r.archived,
    restSeconds: r.rest_seconds,
    sourceId: r.source_id,
    images: parseList(r.images),
    instructions: parseList(r.instructions),
    primaryMuscles: parseList(r.primary_muscles),
    secondaryMuscles: parseList(r.secondary_muscles),
    level: r.level,
    category: r.category,
  };
}

interface SetRow {
  set_type: string;
  weight: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
}

function toSet(r: SetRow): SetData {
  return {
    setType: r.set_type as SetType,
    weight: r.weight,
    reps: r.reps,
    durationS: r.duration_s,
    distanceM: r.distance_m,
    rpe: r.rpe,
  };
}

interface WorkoutRow {
  id: number;
  name: string;
  notes: string;
  started_at: number;
  ended_at: number;
  template_id: number | null;
}

function toWorkoutSummary(r: WorkoutRow): WorkoutSummary {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    templateId: r.template_id,
  };
}

function placeholders(n: number) {
  return Array.from({ length: n }, () => '?').join(',');
}

// ---------- Key/value & settings ----------

export async function getKv(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setKv(db: SQLiteDatabase, key: string, value: string | null) {
  if (value == null) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  else await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  defaultRestSeconds: 120,
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  vibrateOnRestEnd: true,
  keepScreenOn: true,
  bodyMapGender: 'male',
};

export const DEFAULT_IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const raw = await getKv(db, 'settings');
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(db: SQLiteDatabase, settings: Settings) {
  await setKv(db, 'settings', JSON.stringify(settings));
}

// ---------- Exercises ----------

export async function listExercises(db: SQLiteDatabase, includeArchived = false): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT ${EXERCISE_LIST_COLUMNS} FROM exercises ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name COLLATE NOCASE`,
  );
  return rows.map(toExercise);
}

export async function getExercise(db: SQLiteDatabase, id: number): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? toExercise(row) : null;
}

export async function getExercisesByIds(db: SQLiteDatabase, ids: number[]): Promise<Map<number, Exercise>> {
  const map = new Map<number, Exercise>();
  if (ids.length === 0) return map;
  const unique = [...new Set(ids)];
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT ${EXERCISE_LIST_COLUMNS} FROM exercises WHERE id IN (${placeholders(unique.length)})`,
    unique,
  );
  for (const r of rows) map.set(r.id, toExercise(r));
  return map;
}

export async function findExerciseByName(db: SQLiteDatabase, name: string): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE name = ? COLLATE NOCASE', name.trim());
  return row ? toExercise(row) : null;
}

export interface ExerciseInput {
  name: string;
  equipment: Equipment;
  bodyPart: BodyPart;
  type: ExerciseType;
  notes: string;
  restSeconds: number | null;
  category: string | null;
}

export async function createExercise(db: SQLiteDatabase, e: ExerciseInput): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO exercises (name, equipment, body_part, type, notes, is_custom, rest_seconds, category) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    e.name.trim(),
    e.equipment,
    e.bodyPart,
    e.type,
    e.notes,
    e.restSeconds,
    e.category,
  );
  return res.lastInsertRowId;
}

export async function updateExercise(db: SQLiteDatabase, id: number, e: ExerciseInput) {
  await db.runAsync(
    'UPDATE exercises SET name = ?, equipment = ?, body_part = ?, type = ?, notes = ?, rest_seconds = ?, category = ? WHERE id = ?',
    e.name.trim(),
    e.equipment,
    e.bodyPart,
    e.type,
    e.notes,
    e.restSeconds,
    e.category,
    id,
  );
}

export async function setExerciseArchived(db: SQLiteDatabase, id: number, archived: boolean) {
  await db.runAsync('UPDATE exercises SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

export async function setExerciseRest(db: SQLiteDatabase, id: number, restSeconds: number | null) {
  await db.runAsync('UPDATE exercises SET rest_seconds = ? WHERE id = ?', restSeconds, id);
}

/** Number of workouts each exercise appears in. */
export async function exerciseUseCounts(db: SQLiteDatabase): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ exercise_id: number; n: number }>(
    'SELECT exercise_id, COUNT(DISTINCT workout_id) AS n FROM workout_exercises GROUP BY exercise_id',
  );
  return new Map(rows.map((r) => [r.exercise_id, r.n]));
}

// ---------- Templates ----------

interface TemplateRow {
  id: number;
  name: string;
  notes: string;
  kind: string;
  last_used_at: number | null;
}

const toKind = (k: string): TemplateKind => (k === 'stretch' ? 'stretch' : 'workout');

interface TemplateExerciseRow {
  template_id: number;
  exercise_id: number;
  rest_seconds: number | null;
  notes: string;
  sets_json: string;
}

function parseSets(json: string): SetData[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function listTemplates(db: SQLiteDatabase): Promise<Template[]> {
  const rows = await db.getAllAsync<TemplateRow>('SELECT * FROM templates ORDER BY position, id');
  const exRows = await db.getAllAsync<TemplateExerciseRow>('SELECT * FROM template_exercises ORDER BY template_id, position');
  const byTemplate = new Map<number, TemplateExercise[]>();
  for (const r of exRows) {
    const list = byTemplate.get(r.template_id) ?? [];
    list.push({ exerciseId: r.exercise_id, restSeconds: r.rest_seconds, notes: r.notes, sets: parseSets(r.sets_json) });
    byTemplate.set(r.template_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    kind: toKind(r.kind),
    lastUsedAt: r.last_used_at,
    exercises: byTemplate.get(r.id) ?? [],
  }));
}

export async function getTemplate(db: SQLiteDatabase, id: number): Promise<Template | null> {
  const r = await db.getFirstAsync<TemplateRow>('SELECT * FROM templates WHERE id = ?', id);
  if (!r) return null;
  const exRows = await db.getAllAsync<TemplateExerciseRow>(
    'SELECT * FROM template_exercises WHERE template_id = ? ORDER BY position',
    id,
  );
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    kind: toKind(r.kind),
    lastUsedAt: r.last_used_at,
    exercises: exRows.map((e) => ({
      exerciseId: e.exercise_id,
      restSeconds: e.rest_seconds,
      notes: e.notes,
      sets: parseSets(e.sets_json),
    })),
  };
}

export interface TemplateInput {
  name: string;
  notes: string;
  kind: TemplateKind;
  exercises: TemplateExercise[];
}

/** Creates (id = null) or replaces a template. Returns its id. */
export async function saveTemplate(db: SQLiteDatabase, id: number | null, t: TemplateInput): Promise<number> {
  let templateId = id;
  await db.withTransactionAsync(async () => {
    if (templateId == null) {
      const pos = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM templates');
      const res = await db.runAsync(
        'INSERT INTO templates (name, notes, kind, position, created_at) VALUES (?, ?, ?, ?, ?)',
        t.name.trim() || 'New Template',
        t.notes,
        t.kind,
        (pos?.p ?? -1) + 1,
        Date.now(),
      );
      templateId = res.lastInsertRowId;
    } else {
      await db.runAsync(
        'UPDATE templates SET name = ?, notes = ?, kind = ? WHERE id = ?',
        t.name.trim() || 'Template',
        t.notes,
        t.kind,
        templateId,
      );
      await db.runAsync('DELETE FROM template_exercises WHERE template_id = ?', templateId);
    }
    for (const [i, e] of t.exercises.entries()) {
      await db.runAsync(
        'INSERT INTO template_exercises (template_id, exercise_id, position, rest_seconds, notes, sets_json) VALUES (?, ?, ?, ?, ?, ?)',
        templateId,
        e.exerciseId,
        i,
        e.restSeconds,
        e.notes,
        JSON.stringify(e.sets),
      );
    }
  });
  return templateId!;
}

export async function deleteTemplate(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM templates WHERE id = ?', id);
}

export async function duplicateTemplate(db: SQLiteDatabase, id: number): Promise<number | null> {
  const t = await getTemplate(db, id);
  if (!t) return null;
  return saveTemplate(db, null, { name: `${t.name} (copy)`, notes: t.notes, kind: t.kind, exercises: t.exercises });
}

export async function markTemplateUsed(db: SQLiteDatabase, id: number, ts: number) {
  await db.runAsync('UPDATE templates SET last_used_at = ? WHERE id = ?', ts, id);
}

// ---------- Workouts ----------

export interface WorkoutInput {
  name: string;
  notes: string;
  startedAt: number;
  endedAt: number;
  templateId: number | null;
  exercises: { exerciseId: number; notes: string; sets: SetData[] }[];
}

async function insertWorkoutExercises(db: SQLiteDatabase, workoutId: number, exercises: WorkoutInput['exercises']) {
  for (const [i, e] of exercises.entries()) {
    const we = await db.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position, notes) VALUES (?, ?, ?, ?)',
      workoutId,
      e.exerciseId,
      i,
      e.notes,
    );
    for (const [j, s] of e.sets.entries()) {
      await db.runAsync(
        'INSERT INTO workout_sets (workout_exercise_id, position, set_type, weight, reps, duration_s, distance_m, rpe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        we.lastInsertRowId,
        j,
        s.setType,
        s.weight,
        s.reps,
        s.durationS,
        s.distanceM,
        s.rpe,
      );
    }
  }
}

/** Creates (id = null) or replaces a workout. Returns its id. */
export async function saveWorkout(db: SQLiteDatabase, id: number | null, w: WorkoutInput): Promise<number> {
  let workoutId = id;
  await db.withTransactionAsync(async () => {
    if (workoutId == null) {
      const res = await db.runAsync(
        'INSERT INTO workouts (name, notes, started_at, ended_at, template_id) VALUES (?, ?, ?, ?, ?)',
        w.name,
        w.notes,
        w.startedAt,
        w.endedAt,
        w.templateId,
      );
      workoutId = res.lastInsertRowId;
    } else {
      await db.runAsync(
        'UPDATE workouts SET name = ?, notes = ?, started_at = ?, ended_at = ?, template_id = ? WHERE id = ?',
        w.name,
        w.notes,
        w.startedAt,
        w.endedAt,
        w.templateId,
        workoutId,
      );
      await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId);
    }
    await insertWorkoutExercises(db, workoutId, w.exercises);
  });
  return workoutId!;
}

export async function deleteWorkout(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
}

/** Loads full exercise/set details for a list of workout rows. */
async function hydrateWorkouts(db: SQLiteDatabase, rows: WorkoutRow[]): Promise<WorkoutDetail[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const exRows = await db.getAllAsync<{ id: number; workout_id: number; exercise_id: number; notes: string }>(
    `SELECT id, workout_id, exercise_id, notes FROM workout_exercises WHERE workout_id IN (${placeholders(ids.length)}) ORDER BY workout_id, position`,
    ids,
  );
  const weIds = exRows.map((r) => r.id);
  const setRows =
    weIds.length === 0
      ? []
      : await db.getAllAsync<SetRow & { workout_exercise_id: number }>(
          `SELECT * FROM workout_sets WHERE workout_exercise_id IN (${placeholders(weIds.length)}) ORDER BY workout_exercise_id, position`,
          weIds,
        );
  const exercises = await getExercisesByIds(
    db,
    exRows.map((r) => r.exercise_id),
  );
  const setsByWe = new Map<number, SetData[]>();
  for (const s of setRows) {
    const list = setsByWe.get(s.workout_exercise_id) ?? [];
    list.push(toSet(s));
    setsByWe.set(s.workout_exercise_id, list);
  }
  const exByWorkout = new Map<number, WorkoutExerciseDetail[]>();
  for (const r of exRows) {
    const exercise = exercises.get(r.exercise_id);
    if (!exercise) continue;
    const list = exByWorkout.get(r.workout_id) ?? [];
    list.push({ id: r.id, exercise, notes: r.notes, sets: setsByWe.get(r.id) ?? [] });
    exByWorkout.set(r.workout_id, list);
  }
  return rows.map((r) => ({ ...toWorkoutSummary(r), exercises: exByWorkout.get(r.id) ?? [] }));
}

export async function listWorkouts(db: SQLiteDatabase, limit: number, offset = 0): Promise<WorkoutDetail[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts ORDER BY started_at DESC LIMIT ? OFFSET ?',
    limit,
    offset,
  );
  return hydrateWorkouts(db, rows);
}

export async function getWorkout(db: SQLiteDatabase, id: number): Promise<WorkoutDetail | null> {
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  if (!row) return null;
  return (await hydrateWorkouts(db, [row]))[0];
}

export async function workoutCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts');
  return row?.n ?? 0;
}

export async function workoutStartTimes(db: SQLiteDatabase, since: number): Promise<number[]> {
  const rows = await db.getAllAsync<{ started_at: number }>(
    'SELECT started_at FROM workouts WHERE started_at >= ? ORDER BY started_at',
    since,
  );
  return rows.map((r) => r.started_at);
}

/** Sets from the most recent workout (before `before`) that included this exercise. */
export async function getPreviousSets(db: SQLiteDatabase, exerciseId: number, before = Number.MAX_SAFE_INTEGER): Promise<SetData[]> {
  const we = await db.getFirstAsync<{ id: number }>(
    `SELECT we.id FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND w.started_at < ? ORDER BY w.started_at DESC, we.position DESC LIMIT 1`,
    exerciseId,
    before,
  );
  if (!we) return [];
  const rows = await db.getAllAsync<SetRow>('SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY position', we.id);
  return rows.map(toSet);
}

export interface ExerciseHistoryEntry {
  workoutId: number;
  workoutName: string;
  startedAt: number;
  sets: SetData[];
}

/** Every workout an exercise appears in, newest first. */
export async function getExerciseHistory(db: SQLiteDatabase, exerciseId: number): Promise<ExerciseHistoryEntry[]> {
  const rows = await db.getAllAsync<SetRow & { we_id: number; workout_id: number; name: string; started_at: number }>(
    `SELECT s.*, we.id AS we_id, w.id AS workout_id, w.name, w.started_at
     FROM workout_sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ?
     ORDER BY w.started_at DESC, we.position, s.position`,
    exerciseId,
  );
  const entries: ExerciseHistoryEntry[] = [];
  const byWorkout = new Map<number, ExerciseHistoryEntry>();
  for (const r of rows) {
    let e = byWorkout.get(r.workout_id);
    if (!e) {
      e = { workoutId: r.workout_id, workoutName: r.name, startedAt: r.started_at, sets: [] };
      byWorkout.set(r.workout_id, e);
      entries.push(e);
    }
    e.sets.push(toSet(r));
  }
  return entries;
}

/** Best records for an exercise across all workouts started before `before`, or null if none. */
export async function getRecordsBefore(
  db: SQLiteDatabase,
  exercise: Exercise,
  before: number,
): Promise<Records | null> {
  const rows = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM workout_sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND w.started_at < ?`,
    exercise.id,
    before,
  );
  if (rows.length === 0) return null;
  return computeRecords(exercise.type, rows.map(toSet));
}

// ---------- Measurements ----------

interface MeasurementRow {
  id: number;
  type: string;
  value: number;
  measured_at: number;
}

function toMeasurement(r: MeasurementRow): Measurement {
  return { id: r.id, type: r.type as MeasurementType, value: r.value, measuredAt: r.measured_at };
}

export async function listMeasurements(db: SQLiteDatabase, type: MeasurementType): Promise<Measurement[]> {
  const rows = await db.getAllAsync<MeasurementRow>(
    'SELECT * FROM measurements WHERE type = ? ORDER BY measured_at DESC',
    type,
  );
  return rows.map(toMeasurement);
}

export async function latestMeasurements(db: SQLiteDatabase): Promise<Map<MeasurementType, Measurement>> {
  const rows = await db.getAllAsync<MeasurementRow>(
    `SELECT m.* FROM measurements m
     JOIN (SELECT type, MAX(measured_at) AS t FROM measurements GROUP BY type) l
       ON l.type = m.type AND l.t = m.measured_at`,
  );
  return new Map(rows.map((r) => [r.type as MeasurementType, toMeasurement(r)]));
}

export async function addMeasurement(db: SQLiteDatabase, type: MeasurementType, value: number, measuredAt: number) {
  await db.runAsync('INSERT INTO measurements (type, value, measured_at) VALUES (?, ?, ?)', type, value, measuredAt);
}

export async function deleteMeasurement(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM measurements WHERE id = ?', id);
}

// ---------- Import / export ----------

export interface ImportSummary {
  workoutsImported: number;
  workoutsSkipped: number;
  exercisesCreated: number;
}

/** Imports parsed workouts, matching exercises by name and creating unknown ones. Skips duplicates. */
export async function importWorkouts(db: SQLiteDatabase, workouts: ImportedWorkout[]): Promise<ImportSummary> {
  const summary: ImportSummary = { workoutsImported: 0, workoutsSkipped: 0, exercisesCreated: 0 };
  const byName = new Map((await listExercises(db, true)).map((e) => [e.name.toLowerCase(), e.id]));

  await db.withTransactionAsync(async () => {
    for (const w of workouts) {
      const dup = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM workouts WHERE started_at = ? AND name = ?',
        w.startedAt,
        w.name,
      );
      if (dup) {
        summary.workoutsSkipped++;
        continue;
      }
      const exercises: WorkoutInput['exercises'] = [];
      for (const e of w.exercises) {
        let id = byName.get(e.name.toLowerCase());
        if (id == null) {
          const guess = guessExercise(e.name, e.sets);
          const res = await db.runAsync(
            'INSERT INTO exercises (name, equipment, body_part, type, is_custom) VALUES (?, ?, ?, ?, 1)',
            e.name,
            guess.equipment,
            guess.bodyPart,
            guess.type,
          );
          id = res.lastInsertRowId;
          byName.set(e.name.toLowerCase(), id);
          summary.exercisesCreated++;
        }
        exercises.push({ exerciseId: id, notes: e.notes, sets: e.sets });
      }
      const res = await db.runAsync(
        'INSERT INTO workouts (name, notes, started_at, ended_at, template_id) VALUES (?, ?, ?, ?, NULL)',
        w.name,
        w.notes,
        w.startedAt,
        w.startedAt + w.durationS * 1000,
      );
      await insertWorkoutExercises(db, res.lastInsertRowId, exercises);
      summary.workoutsImported++;
    }
  });
  return summary;
}

/** All workouts, oldest first, in the import/export shape. */
export async function exportWorkouts(db: SQLiteDatabase): Promise<ImportedWorkout[]> {
  const rows = await db.getAllAsync<WorkoutRow>('SELECT * FROM workouts ORDER BY started_at');
  const details = await hydrateWorkouts(db, rows);
  return details.map((w) => ({
    name: w.name,
    notes: w.notes,
    startedAt: w.startedAt,
    durationS: Math.round((w.endedAt - w.startedAt) / 1000),
    exercises: w.exercises.map((e) => ({ name: e.exercise.name, notes: e.notes, sets: e.sets })),
  }));
}

const BACKUP_TABLES = [
  'exercises',
  'templates',
  'template_exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'measurements',
  'kv',
] as const;

/** Full JSON dump of every table, for backups. */
export async function exportBackup(db: SQLiteDatabase): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    data[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  }
  return JSON.stringify({ app: 'workout-app', version: 1, exportedAt: Date.now(), data });
}

/** Replaces all data with the contents of a backup produced by exportBackup. */
export async function restoreBackup(db: SQLiteDatabase, json: string) {
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'workout-app' || typeof parsed.data !== 'object') {
    throw new Error('Not a backup file from this app.');
  }
  await db.withTransactionAsync(async () => {
    // Delete children first, insert parents first.
    for (const t of [...BACKUP_TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      const rows: Record<string, string | number | null>[] = parsed.data[t] ?? [];
      for (const row of rows) {
        const cols = Object.keys(row).filter((c) => /^[a-z_]+$/.test(c));
        await db.runAsync(
          `INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders(cols.length)})`,
          cols.map((c) => row[c]),
        );
      }
    }
  });
}

export async function deleteAllWorkouts(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM workouts');
}
