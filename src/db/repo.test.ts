/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { generateProgram } from '../lib/generator';
import type { SetData } from '../lib/types';
import {
  addMeasurement,
  deleteTemplate,
  duplicateTemplate,
  exportBackup,
  findExerciseByName,
  getPlan,
  getPlanStart,
  getPreviousSets,
  getRecordsBefore,
  getSettings,
  getStatEntries,
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
  savePlan,
  saveGeneratedProgram,
  saveSettings,
  saveTemplate,
  saveWorkout,
  setTemplateFolder,
  workoutCount,
  workoutsBetween,
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

  test('saving a workout whose template was deleted unlinks it instead of failing', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const tid = await saveTemplate(db, null, { name: 'Upper A', notes: '', kind: 'workout', folder: null, exercises: [] });
      await deleteTemplate(db, tid);
      const id = await saveWorkout(db, null, {
        name: 'Upper A',
        notes: '',
        startedAt: 1_000,
        endedAt: 2_000,
        templateId: tid,
        exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 8)] }],
      });
      const w = await getWorkout(db, id);
      assert.equal(w?.templateId, null);
      assert.equal(w?.exercises.length, 1);
      await assert.rejects(
        saveWorkout(db, null, { name: 'X', notes: '', startedAt: 3_000, endedAt: 4_000, templateId: null, exercises: [{ exerciseId: 999_999, notes: '', sets: [set(1, 1)] }] }),
        /no longer exists/,
      );
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

      const entries = await getStatEntries(db, 3_000);
      assert.deepEqual(entries.map((e) => e.set.weight).sort(), [60, 70]);
      assert.equal(entries[0].bodyPart, 'Chest');
      assert.equal(entries[0].type, 'weight_reps');
      assert.deepEqual(entries.map((e) => e.startedAt).sort(), [1_000, 2_000]);
      assert.equal((await getStatEntries(db)).length, 3);
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

describe('weekly plan', () => {
  test('saves the plan in day order, drops deleted templates and survives a backup', () =>
    withDb(async (db) => {
      const [a, b, c] = await listTemplates(db);
      await savePlan(db, [
        { weekday: 4, templateId: c.id },
        { weekday: 0, templateId: b.id },
        { weekday: 0, templateId: a.id },
        { weekday: 9, templateId: a.id },
      ]);
      const start = await getPlanStart(db);
      assert.ok(start && start <= Date.now());
      assert.deepEqual(await getPlan(db), [
        { weekday: 0, templateId: b.id },
        { weekday: 0, templateId: a.id },
        { weekday: 4, templateId: c.id },
      ]);

      await deleteTemplate(db, b.id);
      const plan = await getPlan(db);
      assert.deepEqual(plan.map((p) => p.templateId), [a.id, c.id]);

      const backup = await exportBackup(db);
      await withDb(async (other) => {
        await restoreBackup(other, backup);
        assert.deepEqual(await getPlan(other), plan);
      });
    }));

  test('a generated program is saved as templates and becomes the plan', () =>
    withDb(async (db) => {
      const program = generateProgram(
        { gear: ['Dumbbell', 'Bench'], split: 'ppl', goal: 'muscle', weekdays: [0, 1, 2, 3, 4, 5], seed: 0 },
        await listExercises(db),
      );
      const ids = await saveGeneratedProgram(db, program, { folder: 'PPL (generated)', replacePlan: true });
      assert.equal(ids.length, 3);
      const push = await getTemplate(db, ids[0]);
      // The starter templates already include a "Push".
      assert.equal(push?.name, 'Push (1)');
      assert.equal(push?.folder, 'PPL (generated)');
      assert.equal(push?.exercises.length, program.workouts[0].exercises.length);
      assert.ok(!('name' in (push?.exercises[0] ?? {})));
      assert.deepEqual((await getPlan(db)).map((p) => p.templateId), [...ids, ...ids]);

      // Generating again numbers the new templates instead of duplicating the names.
      const again = await saveGeneratedProgram(db, program, { folder: 'PPL (generated)', replacePlan: false });
      assert.equal((await getTemplate(db, again[0]))?.name, 'Push (2)');
      const third = await saveGeneratedProgram(db, program, { folder: 'PPL (generated)', replacePlan: false });
      assert.equal((await getTemplate(db, third[0]))?.name, 'Push (3)');
      assert.equal((await getTemplate(db, third[1]))?.name, 'Pull (3)');
      // A deleted name is free again.
      await deleteTemplate(db, ids[0]);
      const fourth = await saveGeneratedProgram(db, program, { folder: 'PPL (generated)', replacePlan: false });
      assert.equal((await getTemplate(db, fourth[0]))?.name, 'Push (1)');
    }));

  test('workoutsBetween returns start times and templates in a range', () =>
    withDb(async (db) => {
      const [t] = await listTemplates(db);
      for (const startedAt of [1_000, 2_000, 3_000]) {
        await saveWorkout(db, null, { name: 'W', notes: '', startedAt, endedAt: startedAt + 1, templateId: t.id, exercises: [] });
      }
      assert.deepEqual(await workoutsBetween(db, 1_500, 3_000), [{ startedAt: 2_000, templateId: t.id }]);
    }));
});

describe('settings, measurements and backups', () => {
  test('an app update backs up the data before changing the database, and the backup restores', async () => {
    const old = openTestDb();
    try {
      await migrateDb(old, SCHEMA_VERSION - 1);
      const tid = await saveTemplate(old, null, { name: 'Upper A', notes: '', kind: 'workout', folder: null, exercises: [] });
      let backup: string | null = null;
      let from = 0;
      await migrateDb(old, SCHEMA_VERSION, async (v) => {
        from = v;
        backup = await exportBackup(old); // Taken from the old database, before the upgrade.
      });
      assert.equal(from, SCHEMA_VERSION - 1);
      assert.ok(backup);
      await withDb(async (fresh) => {
        await restoreBackup(fresh, backup!);
        assert.equal((await getTemplate(fresh, tid))?.name, 'Upper A');
      });
      // Up to date: no backup needed.
      let called = false;
      await migrateDb(old, SCHEMA_VERSION, async () => {
        called = true;
      });
      assert.equal(called, false);
    } finally {
      old.close();
    }
  });

  test('a database from a build with different upgrades gets the missing tables and keeps its own', async () => {
    const db = openTestDb();
    try {
      // Like claude/great-fermi-g4vjji: same first five upgrades, then its own v6 and v7.
      await migrateDb(db, 5);
      await db.execAsync('CREATE TABLE programs (id INTEGER PRIMARY KEY, name TEXT); PRAGMA user_version = 7;');
      await db.runAsync("INSERT INTO programs (name) VALUES ('Block 1')");
      const tid = await saveTemplate(db, null, { name: 'Upper A', notes: '', kind: 'workout', folder: null, exercises: [] });
      await migrateDb(db);
      await savePlan(db, [{ weekday: 0, templateId: tid }]);
      assert.equal((await getPlan(db)).length, 1);
      assert.equal((await db.getFirstAsync<{ name: string }>('SELECT name FROM programs'))?.name, 'Block 1');
      assert.equal((await getTemplate(db, tid))?.name, 'Upper A');
    } finally {
      db.close();
    }
  });

  test('a brand-new database is not backed up', async () => {
    const db = openTestDb();
    try {
      let called = false;
      await migrateDb(db, SCHEMA_VERSION, async () => {
        called = true;
      });
      assert.equal(called, false);
    } finally {
      db.close();
    }
  });

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
