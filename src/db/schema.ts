import type { SQLiteDatabase } from 'expo-sqlite';

import { SEED_EXERCISES, SEED_TEMPLATES } from '../data/exercises';

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
];

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
