import type { SQLiteDatabase } from 'expo-sqlite';

import { SEED_EXERCISES, SEED_STRETCH_TEMPLATES, SEED_TEMPLATES } from '../data/exercises';
import { FREE_EXERCISE_DB_LINKS } from '../data/freeExerciseDbMap';
import { displayName, toBodyPart, toEquipment, toExerciseType, type FreeExercise } from '../lib/freeExerciseDb';

export const DATABASE_NAME = 'workout.db';

/**
 * Each entry upgrades the schema by one version. Never edit a migration that has shipped;
 * append a new one instead.
 */
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        equipment TEXT NOT NULL,
        body_part TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'weight_reps',
        notes TEXT NOT NULL DEFAULT '',
        is_custom INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        rest_seconds INTEGER
      );
      CREATE UNIQUE INDEX idx_exercises_name ON exercises(name COLLATE NOCASE);

      CREATE TABLE templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER
      );
      CREATE TABLE template_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        position INTEGER NOT NULL,
        rest_seconds INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        sets_json TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX idx_te_template ON template_exercises(template_id);

      CREATE TABLE workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_workouts_started ON workouts(started_at);

      CREATE TABLE workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        position INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_we_workout ON workout_exercises(workout_id);
      CREATE INDEX idx_we_exercise ON workout_exercises(exercise_id);

      CREATE TABLE workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        set_type TEXT NOT NULL DEFAULT 'normal',
        weight REAL,
        reps INTEGER,
        duration_s INTEGER,
        distance_m REAL,
        rpe REAL
      );
      CREATE INDEX idx_ws_we ON workout_sets(workout_exercise_id);

      CREATE TABLE measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        measured_at INTEGER NOT NULL
      );
      CREATE INDEX idx_measurements_type ON measurements(type, measured_at);

      CREATE TABLE kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    await seed(db);
  },
  // v2: exercise images, instructions and muscles from free-exercise-db, plus its ~700 other
  // exercises; bodyweight exercises are tracked as reps only.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN source_id TEXT;
      ALTER TABLE exercises ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE exercises ADD COLUMN instructions TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE exercises ADD COLUMN primary_muscles TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE exercises ADD COLUMN secondary_muscles TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE exercises ADD COLUMN level TEXT;
      ALTER TABLE exercises ADD COLUMN category TEXT;
    `);
    await importFreeExerciseDb(db);
    await db.runAsync(
      "UPDATE exercises SET type = 'reps' WHERE equipment = 'Bodyweight' AND type = 'weight_reps'",
    );
  },
  // v3: Olympic lifts and strongman events go under Full Body, neck exercises under Neck, and
  // unlinked built-ins get a category (strength, cardio, plyometrics…) for the type filter.
  async (db) => {
    const builtIn = SEED_EXERCISES.map((e) => e.name);
    const notBuiltIn = `name NOT IN (${builtIn.map(() => '?').join(',')})`;
    await db.runAsync(
      `UPDATE exercises SET body_part = 'Full Body'
       WHERE is_custom = 0 AND category IN ('olympic weightlifting', 'strongman') AND ${notBuiltIn}`,
      builtIn,
    );
    await db.runAsync(
      `UPDATE exercises SET body_part = 'Neck' WHERE is_custom = 0 AND primary_muscles LIKE '["neck"%' AND ${notBuiltIn}`,
      builtIn,
    );
    for (const e of SEED_EXERCISES) {
      if (e.category) await db.runAsync('UPDATE exercises SET category = ? WHERE name = ?', e.category, e.name);
    }
  },
  // v4: templates are either workouts or stretch routines; add two starter stretch routines.
  async (db) => {
    await db.execAsync("ALTER TABLE templates ADD COLUMN kind TEXT NOT NULL DEFAULT 'workout'");
    const pos = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM templates');
    let position = (pos?.p ?? -1) + 1;
    for (const t of SEED_STRETCH_TEMPLATES) {
      const res = await db.runAsync(
        "INSERT INTO templates (name, notes, kind, position, created_at) VALUES (?, ?, 'stretch', ?, ?)",
        t.name,
        t.notes,
        position++,
        Date.now(),
      );
      let i = 0;
      for (const te of t.exercises) {
        const ex = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', te.name);
        if (!ex) continue;
        const sets = [{ setType: 'normal', weight: null, reps: null, durationS: te.seconds, distanceM: null, rpe: null }];
        await db.runAsync(
          'INSERT INTO template_exercises (template_id, exercise_id, position, rest_seconds, sets_json) VALUES (?, ?, ?, ?, ?)',
          res.lastInsertRowId,
          ex.id,
          i++,
          t.restSeconds,
          JSON.stringify(sets),
        );
      }
    }
  },
];

async function importFreeExerciseDb(db: SQLiteDatabase) {
  // Loaded lazily: the dataset is only needed while migrating.
  const data = (await import('../data/freeExerciseDb.json')).default as FreeExercise[];
  const byId = new Map(data.map((e) => [e.id, e]));

  const link = await db.prepareAsync(
    `UPDATE exercises SET source_id = $id, images = $images, instructions = $instructions,
       primary_muscles = $primary, secondary_muscles = $secondary, level = $level, category = $category
     WHERE name = $name COLLATE NOCASE AND source_id IS NULL`,
  );
  const insert = await db.prepareAsync(
    `INSERT INTO exercises (name, equipment, body_part, type, source_id, images, instructions,
       primary_muscles, secondary_muscles, level, category)
     VALUES ($name, $equipment, $bodyPart, $type, $id, $images, $instructions, $primary, $secondary, $level, $category)`,
  );
  const details = (e: FreeExercise) => ({
    $id: e.id,
    $images: JSON.stringify(e.images),
    $instructions: JSON.stringify(e.instructions),
    $primary: JSON.stringify(e.primaryMuscles),
    $secondary: JSON.stringify(e.secondaryMuscles),
    $level: e.level,
    $category: e.category,
  });

  try {
    const linked = new Set<string>();
    for (const [name, id] of Object.entries(FREE_EXERCISE_DB_LINKS)) {
      const e = byId.get(id);
      if (!e) continue;
      await link.executeAsync({ ...details(e), $name: name });
      linked.add(id);
    }
    const existing = new Set(
      (await db.getAllAsync<{ name: string }>('SELECT name FROM exercises')).map((r) => r.name.toLowerCase()),
    );
    for (const e of data) {
      if (linked.has(e.id)) continue;
      const name = displayName(e);
      if (existing.has(name.toLowerCase())) {
        // Same name as an existing (e.g. imported) exercise: attach the details to it instead.
        await link.executeAsync({ ...details(e), $name: name });
        continue;
      }
      existing.add(name.toLowerCase());
      await insert.executeAsync({
        ...details(e),
        $name: name,
        $equipment: toEquipment(e),
        $bodyPart: toBodyPart(e),
        $type: toExerciseType(e),
      });
    }
  } finally {
    await link.finalizeAsync();
    await insert.finalizeAsync();
  }
}

async function seed(db: SQLiteDatabase) {
  for (const e of SEED_EXERCISES) {
    await db.runAsync(
      'INSERT INTO exercises (name, equipment, body_part, type) VALUES (?, ?, ?, ?)',
      e.name,
      e.equipment,
      e.bodyPart,
      e.type,
    );
  }
  const now = Date.now();
  for (const [i, t] of SEED_TEMPLATES.entries()) {
    const res = await db.runAsync(
      'INSERT INTO templates (name, notes, position, created_at) VALUES (?, ?, ?, ?)',
      t.name,
      t.notes,
      i,
      now,
    );
    for (const [j, te] of t.exercises.entries()) {
      const ex = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', te.name);
      if (!ex) continue;
      const sets = Array.from({ length: te.sets }, () => ({
        setType: 'normal',
        weight: null,
        reps: te.reps,
        durationS: null,
        distanceM: null,
        rpe: null,
      }));
      await db.runAsync(
        'INSERT INTO template_exercises (template_id, exercise_id, position, sets_json) VALUES (?, ?, ?, ?)',
        res.lastInsertRowId,
        ex.id,
        j,
        JSON.stringify(sets),
      );
    }
  }
}

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await migration(db);
    });
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
