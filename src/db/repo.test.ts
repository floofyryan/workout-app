/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { SetData } from '../lib/types';
import {
  addMeasurement,
  duplicateTemplate,
  exportBackup,
  findExerciseByName,
  getPreviousSets,
  getRecordsBefore,
  getSettings,
  getTemplate,
  getWorkout,
  importWorkouts,
  latestMeasurements,
  listExercises,
  listMeasurements,
  listTemplates,
  listWorkouts,
  reorderTemplates,
  restoreBackup,
  saveSettings,
  saveTemplate,
  saveWorkout,
  setTemplateFolder,
  workoutCount,
} from './repo';
import { migrateDb, SCHEMA_VERSION } from './schema';
import { openTestDb } from './testDb';

type TestDb = ReturnType<typeof openTestDb>;

async function withDb(fn: (db: TestDb) => Promise<void>, upTo?: number) {
  const db = openTestDb();
  try {
    await migrateDb(db, upTo);
    await fn(db);
  } finally {
    db.close();
  }
}

const set = (weight: number | null, reps: number | null, extra: Partial<SetData> = {}): SetData => ({
  setType: 'normal',
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
  ...extra,
});

async function exerciseId(db: TestDb, name: string) {
  const e = await findExerciseByName(db, name);
  assert.ok(e, `exercise "${name}" should exist`);
  return e;
}

describe('migrations', () => {
  test('a fresh database ends at the latest version with seeded data', () =>
    withDb(async (db) => {
      const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      assert.equal(v?.user_version, SCHEMA_VERSION);

      const exercises = await listExercises(db);
      assert.ok(exercises.length > 850, `expected the full exercise list, got ${exercises.length}`);
      const names = new Set(exercises.map((e) => e.name.toLowerCase()));
      assert.equal(names.size, exercises.length, 'exercise names are unique');

      const templates = await listTemplates(db);
      assert.equal(templates.filter((t) => t.kind === 'workout').length, 3);
      assert.equal(templates.filter((t) => t.kind === 'stretch').length, 2);
      for (const t of templates) {
        assert.ok(t.exercises.length > 0, `${t.name} has exercises`);
        assert.equal(t.folder, null);
      }
    }));

  test('bodyweight exercises are reps only, timed holds keep their duration', () =>
    withDb(async (db) => {
      const pushUp = await exerciseId(db, 'Push Up (Bodyweight)');
      assert.equal(pushUp.type, 'reps');
      const plank = await exerciseId(db, 'Plank (Bodyweight)');
      assert.equal(plank.type, 'duration');
      const linked = await db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM exercises WHERE equipment = 'Bodyweight' AND type = 'weight_reps'",
      );
      assert.equal(linked?.n, 0);
    }));

  test('body parts: Olympic lifts are Full Body, neck stretches are Neck', () =>
    withDb(async (db) => {
      const olympic = await db.getAllAsync<{ body_part: string }>(
        "SELECT body_part FROM exercises WHERE is_custom = 0 AND category = 'olympic weightlifting' AND source_id IS NOT NULL",
      );
      assert.ok(olympic.length > 0);
      assert.ok(olympic.filter((r) => r.body_part === 'Full Body').length > olympic.length / 2);
      const neck = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM exercises WHERE body_part = 'Neck'");
      assert.ok((neck?.n ?? 0) > 0);
    }));

  test('running the migrations again does nothing', () =>
    withDb(async (db) => {
      const before = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises');
      await migrateDb(db);
      const after = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises');
      assert.equal(after?.n, before?.n);
      assert.equal((await listTemplates(db)).length, 5);
    }));

  test('upgrading from v1 keeps workouts and links same-named custom exercises', () =>
    withDb(async (db) => {
      // A user on v1 with one workout and a custom exercise whose name the dataset also uses.
      const custom = await db.runAsync(
        "INSERT INTO exercises (name, equipment, body_part, type, is_custom) VALUES ('Alternate Hammer Curl (Dumbbell)', 'Dumbbell', 'Arms', 'weight_reps', 1)",
      );
      const bench = await db.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Bench Press (Barbell)'");
      const w = await db.runAsync(
        "INSERT INTO workouts (name, notes, started_at, ended_at) VALUES ('Old workout', '', 1000, 2000)",
      );
      const we = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, 0)',
        w.lastInsertRowId,
        bench!.id,
      );
      await db.runAsync(
        "INSERT INTO workout_sets (workout_exercise_id, position, set_type, weight, reps) VALUES (?, 0, 'normal', 60, 8)",
        we.lastInsertRowId,
      );

      await migrateDb(db);

      const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      assert.equal(v?.user_version, SCHEMA_VERSION);
      const matches = await db.getAllAsync<{ id: number; source_id: string | null; is_custom: number }>(
        "SELECT id, source_id, is_custom FROM exercises WHERE name = 'Alternate Hammer Curl (Dumbbell)' COLLATE NOCASE",
      );
      assert.equal(matches.length, 1, 'no duplicate exercise was created');
      assert.equal(matches[0].id, custom.lastInsertRowId);
      assert.ok(matches[0].source_id, 'the custom exercise got the dataset details');

      const old = await getWorkout(db, w.lastInsertRowId);
      assert.equal(old?.name, 'Old workout');
      assert.equal(old?.exercises[0].sets[0].weight, 60);
      assert.equal(old?.exercises[0].supersetGroup, null);
    }, 1));
});

describe('workouts', () => {
  test('save and load a workout with a superset', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const row = await exerciseId(db, 'Bent Over Row (Barbell)');
      const squat = await exerciseId(db, 'Squat (Barbell)');
      const id = await saveWorkout(db, null, {
        name: 'Push Pull',
        notes: 'felt good',
        startedAt: 10_000,
        endedAt: 20_000,
        templateId: null,
        exercises: [
          { exerciseId: bench.id, notes: '', sets: [set(60, 8), set(62.5, 6)], supersetGroup: 1 },
          { exerciseId: row.id, notes: '', sets: [set(50, 10)], supersetGroup: 1 },
          { exerciseId: squat.id, notes: 'deep', sets: [set(100, 5, { setType: 'warmup' })] },
        ],
      });
      const w = await getWorkout(db, id);
      assert.ok(w);
      assert.equal(w.name, 'Push Pull');
      assert.deepEqual(
        w.exercises.map((e) => [e.exercise.name, e.supersetGroup, e.sets.length]),
        [
          ['Bench Press (Barbell)', 1, 2],
          ['Bent Over Row (Barbell)', 1, 1],
          ['Squat (Barbell)', null, 1],
        ],
      );
      assert.deepEqual(w.exercises[0].sets[1], set(62.5, 6));
      assert.equal(w.exercises[2].sets[0].setType, 'warmup');

      // Editing replaces the exercises rather than appending.
      await saveWorkout(db, id, {
        name: 'Push',
        notes: '',
        startedAt: 10_000,
        endedAt: 20_000,
        templateId: null,
        exercises: [{ exerciseId: bench.id, notes: '', sets: [set(70, 5)] }],
      });
      const edited = await getWorkout(db, id);
      assert.equal(edited?.name, 'Push');
      assert.equal(edited?.exercises.length, 1);
      const rows = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_sets');
      assert.equal(rows?.n, 1, 'old sets were removed');
    }));

  test('history: newest first, previous sets and records before a date', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const save = (startedAt: number, weight: number) =>
        saveWorkout(db, null, {
          name: `W${startedAt}`,
          notes: '',
          startedAt,
          endedAt: startedAt + 1000,
          templateId: null,
          exercises: [{ exerciseId: bench.id, notes: '', sets: [set(weight, 5)] }],
        });
      await save(1_000, 60);
      await save(3_000, 80);
      await save(2_000, 70);

      assert.equal(await workoutCount(db), 3);
      assert.deepEqual(
        (await listWorkouts(db, 10)).map((w) => w.startedAt),
        [3_000, 2_000, 1_000],
      );
      assert.deepEqual(
        (await listWorkouts(db, 1, 1)).map((w) => w.startedAt),
        [2_000],
      );

      assert.equal((await getPreviousSets(db, bench.id))[0].weight, 80);
      assert.equal((await getPreviousSets(db, bench.id, 3_000))[0].weight, 70);

      const records = await getRecordsBefore(db, bench, 3_000);
      assert.ok(records);
      assert.equal(records.maxWeight, 70);
      assert.equal(await getRecordsBefore(db, bench, 1_000), null);
    }));

  test('importing the same workouts twice skips duplicates and creates unknown exercises once', () =>
    withDb(async (db) => {
      const workouts = [
        {
          name: 'Imported',
          notes: '',
          startedAt: 5_000,
          durationS: 3600,
          exercises: [
            { name: 'bench press (barbell)', notes: '', sets: [set(60, 5)] },
            { name: 'Mystery Machine Press', notes: '', sets: [set(40, 12)] },
          ],
        },
      ];
      const first = await importWorkouts(db, workouts);
      assert.deepEqual(first, { workoutsImported: 1, workoutsSkipped: 0, exercisesCreated: 1 });
      const second = await importWorkouts(db, workouts);
      assert.deepEqual(second, { workoutsImported: 0, workoutsSkipped: 1, exercisesCreated: 0 });

      const [w] = await listWorkouts(db, 10);
      assert.equal(w.endedAt - w.startedAt, 3600 * 1000);
      assert.equal(w.exercises[0].exercise.name, 'Bench Press (Barbell)', 'matched case-insensitively');
      assert.equal(w.exercises[1].exercise.isCustom, true);
    }));
});

describe('templates', () => {
  test('folders, kinds and supersets are saved', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const row = await exerciseId(db, 'Bent Over Row (Barbell)');
      const id = await saveTemplate(db, null, {
        name: '  Upper A ',
        notes: '',
        kind: 'workout',
        folder: '  PPL  ',
        exercises: [
          { exerciseId: bench.id, restSeconds: 90, notes: '', sets: [set(60, 8)], supersetGroup: 1 },
          { exerciseId: row.id, restSeconds: null, notes: '', sets: [set(50, 10)], supersetGroup: 1 },
        ],
      });
      const t = await getTemplate(db, id);
      assert.ok(t);
      assert.equal(t.name, 'Upper A');
      assert.equal(t.folder, 'PPL', 'folder is trimmed');
      assert.deepEqual(
        t.exercises.map((e) => [e.exerciseId, e.restSeconds, e.supersetGroup]),
        [
          [bench.id, 90, 1],
          [row.id, null, 1],
        ],
      );

      const copy = await duplicateTemplate(db, id);
      assert.ok(copy);
      const dup = await getTemplate(db, copy);
      assert.equal(dup?.name, 'Upper A (copy)');
      assert.equal(dup?.folder, 'PPL');
      assert.equal(dup?.exercises.length, 2);

      await setTemplateFolder(db, copy, '   ');
      assert.equal((await getTemplate(db, copy))?.folder, null, 'blank folder means no folder');

      const stretch = await saveTemplate(db, null, { name: 'Hips', notes: '', kind: 'stretch', exercises: [] });
      assert.equal((await getTemplate(db, stretch))?.kind, 'stretch');
    }));

  test('reorderTemplates sets the listing order', () =>
    withDb(async (db) => {
      const ids = (await listTemplates(db)).map((t) => t.id);
      const reversed = [...ids].reverse();
      await reorderTemplates(db, reversed);
      assert.deepEqual(
        (await listTemplates(db)).map((t) => t.id),
        reversed,
      );
    }));
});

describe('settings, measurements and backups', () => {
  test('settings round trip and fill in defaults', () =>
    withDb(async (db) => {
      const defaults = await getSettings(db);
      assert.equal(defaults.bodyMapFigure, 'goblin');
      assert.equal(defaults.timerNotifications, true);
      await saveSettings(db, { ...defaults, units: 'imperial', timerNotifications: false });
      const saved = await getSettings(db);
      assert.equal(saved.units, 'imperial');
      assert.equal(saved.timerNotifications, false);
    }));

  test('measurements: list newest first and latest per type', () =>
    withDb(async (db) => {
      await addMeasurement(db, 'bodyweight', 80, 1_000);
      await addMeasurement(db, 'bodyweight', 79, 2_000);
      await addMeasurement(db, 'waist', 85, 1_500);
      assert.deepEqual(
        (await listMeasurements(db, 'bodyweight')).map((m) => m.value),
        [79, 80],
      );
      const latest = await latestMeasurements(db);
      assert.equal(latest.get('bodyweight')?.value, 79);
      assert.equal(latest.get('waist')?.value, 85);
    }));

  test('a backup restores into a fresh database', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      await saveWorkout(db, null, {
        name: 'Backed up',
        notes: '',
        startedAt: 1_000,
        endedAt: 2_000,
        templateId: null,
        exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 5)], supersetGroup: 1 }],
      });
      await addMeasurement(db, 'bodyweight', 80, 1_000);
      const t = (await listTemplates(db))[0];
      await setTemplateFolder(db, t.id, 'Strength');
      const backup = await exportBackup(db);

      await withDb(async (other) => {
        await saveWorkout(other, null, {
          name: 'Will be replaced',
          notes: '',
          startedAt: 9_000,
          endedAt: 9_500,
          templateId: null,
          exercises: [],
        });
        await restoreBackup(other, backup);
        const workouts = await listWorkouts(other, 10);
        assert.deepEqual(
          workouts.map((w) => w.name),
          ['Backed up'],
        );
        assert.equal(workouts[0].exercises[0].supersetGroup, 1);
        assert.equal((await listExercises(other)).length, (await listExercises(db)).length);
        assert.equal((await getTemplate(other, t.id))?.folder, 'Strength');
        assert.equal((await latestMeasurements(other)).get('bodyweight')?.value, 80);
      });
    }));

  test('restoring something that is not a backup fails and changes nothing', () =>
    withDb(async (db) => {
      await assert.rejects(restoreBackup(db, JSON.stringify({ hello: 'world' })), /Not a backup/);
      assert.equal((await listTemplates(db)).length, 5);
    }));
});
