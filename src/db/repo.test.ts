/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PROGRAMS } from '../data/programs';
import { parseStrongCsv, workoutsToStrongCsv } from '../lib/strongCsv';
import type { SetData, Template } from '../lib/types';
import { KG_PER_LB } from '../lib/units';
import {
  achievementStats,
  addMeasurement,
  adjustTemplateSets,
  deleteProgram,
  deleteTemplate,
  duplicateTemplate,
  exportBackup,
  exportWorkouts,
  findExerciseByName,
  getPreviousSets,
  getProgram,
  getRecordsBefore,
  getSettings,
  getTemplate,
  getWorkout,
  importWorkouts,
  installProgram,
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
  setProgramBlock,
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

  test('a migration and its version number are saved together', async () => {
    const db = openTestDb();
    try {
      // Fail the first version bump, as if the app were killed right after the migration ran.
      const exec = db.execAsync.bind(db);
      db.execAsync = async (sql: string) => {
        if (sql.startsWith('PRAGMA user_version')) throw new Error('killed');
        return exec(sql);
      };
      await assert.rejects(migrateDb(db), /killed/);
      db.execAsync = exec;
      // Nothing was left half applied, so the next launch migrates normally.
      await migrateDb(db);
      const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      assert.equal(v?.user_version, SCHEMA_VERSION);
      assert.equal((await listTemplates(db)).length, 5);
    } finally {
      db.close();
    }
  });

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

  test('a workout still saves if its template was deleted while it was in progress', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const [gone, kept] = await listTemplates(db);
      await deleteTemplate(db, gone.id);
      const workout = (templateId: number) => ({
        name: 'From a template',
        notes: '',
        startedAt: 1_000,
        endedAt: 2_000,
        templateId,
        exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 5)] }],
      });

      const id = await saveWorkout(db, null, workout(gone.id));
      assert.equal((await getWorkout(db, id))?.templateId, null, 'saved, unlinked from the deleted template');
      // Templates that still exist stay linked, when saving and when editing.
      const other = await saveWorkout(db, null, workout(kept.id));
      assert.equal((await getWorkout(db, other))?.templateId, kept.id);
      await saveWorkout(db, other, workout(kept.id));
      assert.equal((await getWorkout(db, other))?.templateId, kept.id);
    }));

  test("re-importing this app's own CSV export skips the workouts it already has", () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      // Workouts recorded in the app have millisecond start times; the CSV keeps whole seconds.
      const startedAt = new Date(2026, 9, 1, 18, 30, 12, 345).getTime();
      await saveWorkout(db, null, {
        name: 'Evening Workout',
        notes: '',
        startedAt,
        endedAt: startedAt + 3_600_000,
        templateId: null,
        exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 5)] }],
      });
      const [exported] = parseStrongCsv(workoutsToStrongCsv(await exportWorkouts(db), 'metric'), 'metric').workouts;

      assert.deepEqual(await importWorkouts(db, [exported]), { workoutsImported: 0, workoutsSkipped: 1, exercisesCreated: 0 });
      // A workout with the same name a second later is a different one.
      const later = { ...exported, startedAt: exported.startedAt + 1000 };
      assert.equal((await importWorkouts(db, [later])).workoutsImported, 1);
      assert.equal(await workoutCount(db), 2);
    }));

  test("imports keep supersets and file new exercises under the other app's body part", () =>
    withDb(async (db) => {
      await importWorkouts(db, [
        {
          name: 'Mixed',
          notes: '',
          startedAt: 7_000,
          durationS: 600,
          exercises: [
            { name: 'Lateral Raise (Dumbbell)', notes: '', sets: [set(10, 15)], supersetGroup: 1 },
            { name: 'Triceps Pushdown (Cable)', notes: '', sets: [set(30, 12)], supersetGroup: 1 },
            { name: 'Incline Hammer Strength Press', notes: '', sets: [set(40, 10)], bodyPartHint: 'Chest' },
          ],
        },
      ]);
      const [w] = await listWorkouts(db, 1);
      assert.deepEqual(
        w.exercises.map((e) => e.supersetGroup),
        [1, 1, null],
      );
      const created = w.exercises[2].exercise;
      assert.equal(created.isCustom, true);
      assert.equal(created.bodyPart, 'Chest', 'not "Shoulders" from the word "press"');
      assert.equal(created.equipment, 'Machine');
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

describe('programs', () => {
  test('every library program installs with all its exercises and a rule for each', () =>
    withDb(async (db) => {
      for (const def of PROGRAMS) {
        const p = await getProgram(db, await installProgram(db, def, 'metric'));
        if (!p) throw new Error(`${def.name} was not installed`);
        assert.equal(p.name, def.name);
        assert.deepEqual(
          p.templates.map((t) => t.name),
          def.workouts.map((w) => w.name),
        );
        for (const [i, w] of def.workouts.entries()) {
          const t: Template = p.templates[i];
          assert.equal(t.exercises.length, w.exercises.length, `${w.name}: every exercise is in the library`);
          assert.ok(
            t.exercises.every((e) => e.progression),
            `${w.name}: every exercise has a progression rule`,
          );
          assert.equal(t.programId, p.id);
        }
      }
    }));

  test('the rotation moves on to the next workout once one is finished', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const id = await installProgram(db, PROGRAMS.find((p) => p.key === '5x5')!, 'metric');
      const [a, b] = (await getProgram(db, id))!.templates;
      const finish = (templateId: number, startedAt: number) =>
        saveWorkout(db, null, {
          name: 'Program day',
          notes: '',
          startedAt,
          endedAt: startedAt + 1000,
          templateId,
          exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 5)] }],
        });

      assert.equal((await getProgram(db, id))?.nextTemplateId, a.id, 'starts with the first workout');
      await finish(a.id, 1_000);
      assert.equal((await getProgram(db, id))?.nextTemplateId, b.id);
      await finish(b.id, 2_000);
      assert.equal((await getProgram(db, id))?.nextTemplateId, a.id, 'wraps around');
    }));

  test('training blocks: weeks follow finished rotations, then a deload, then a new block', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const id = await installProgram(db, PROGRAMS.find((p) => p.key === 'muscle-block')!, 'metric');
      let p = (await getProgram(db, id))!;
      assert.equal(p.blockWeeks, 5);
      assert.deepEqual(p.block, { week: 1, weeks: 5, block: 1, rir: 3, deload: false });

      // Four workouts in the rotation: finishing them all moves to week 2.
      let t = 10_000_000;
      const finishRotations = async (n: number) => {
        for (let i = 0; i < n * p.templates.length; i++) {
          const template = p.templates[i % p.templates.length];
          t += 1000;
          await saveWorkout(db, null, {
            name: template.name,
            notes: '',
            startedAt: t,
            endedAt: t + 500,
            templateId: template.id,
            exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 10)] }],
          });
        }
      };
      // Workouts from before the block started don't count.
      await db.runAsync('UPDATE programs SET block_started_at = ? WHERE id = ?', t + 1, id);
      await finishRotations(1);
      assert.deepEqual((await getProgram(db, id))?.block, { week: 2, weeks: 5, block: 1, rir: 2, deload: false });
      await finishRotations(3);
      assert.deepEqual((await getProgram(db, id))?.block, { week: 5, weeks: 5, block: 1, rir: null, deload: true });
      await finishRotations(1);
      assert.equal((await getProgram(db, id))?.block?.block, 2, 'after the deload a new block starts');

      await setProgramBlock(db, id, 4);
      assert.deepEqual((await getProgram(db, id))?.block, { week: 1, weeks: 4, block: 1, rir: 3, deload: false });
      await setProgramBlock(db, id, null);
      p = (await getProgram(db, id))!;
      assert.equal(p.block, null);
      assert.equal(p.blockWeeks, null);
    }));

  test('block feedback adds or removes a working set of a template exercise', () =>
    withDb(async (db) => {
      const id = await installProgram(db, PROGRAMS.find((p) => p.key === 'muscle-block')!, 'metric');
      const [upper] = (await getProgram(db, id))!.templates;
      const first = upper.exercises[0];
      await adjustTemplateSets(db, upper.id, first.exerciseId, 1);
      let now = (await getTemplate(db, upper.id))!;
      assert.equal(now.exercises[0].sets.length, first.sets.length + 1);
      assert.deepEqual(now.exercises[0].progression, first.progression, 'the rule stays');
      await adjustTemplateSets(db, upper.id, first.exerciseId, -2);
      now = (await getTemplate(db, upper.id))!;
      assert.equal(now.exercises[0].sets.length, first.sets.length - 1);
      assert.equal(now.exercises[1].sets.length, upper.exercises[1].sets.length, 'other exercises untouched');
    }));

  test('rules use the unit system, and deleting a program keeps workouts done from it', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const id = await installProgram(db, PROGRAMS.find((p) => p.key === '5x5')!, 'imperial');
      const [a, b] = (await getProgram(db, id))!.templates;
      const step = (rule: unknown) => (rule as { increment: number }).increment;
      assert.ok(Math.abs(step(a.exercises[0].progression) - 5 * KG_PER_LB) < 1e-9, 'squat: 5 lb');
      assert.ok(Math.abs(step(b.exercises[2].progression) - 10 * KG_PER_LB) < 1e-9, 'deadlift: 10 lb');

      const done = await saveWorkout(db, null, {
        name: '5×5 A',
        notes: '',
        startedAt: 1_000,
        endedAt: 2_000,
        templateId: a.id,
        exercises: [{ exerciseId: bench.id, notes: '', sets: [set(60, 5)] }],
      });
      await deleteProgram(db, id);
      assert.equal(await getProgram(db, id), null);
      assert.equal(await getTemplate(db, a.id), null, 'its workouts went with it');
      const left = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM template_exercises WHERE template_id IN (?, ?)', a.id, b.id);
      assert.equal(left?.n, 0);
      const kept = await getWorkout(db, done);
      assert.equal(kept?.name, '5×5 A', 'history is kept');
      assert.equal(kept?.templateId, null);
    }));
});

describe('achievement stats', () => {
  test('volume and heaviest weight per workout, oldest first, workouts without sets included', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const pushUp = await exerciseId(db, 'Push Up (Bodyweight)');
      const second = await saveWorkout(db, null, {
        name: 'B',
        notes: '',
        startedAt: 2_000,
        endedAt: 3_000,
        templateId: null,
        exercises: [
          { exerciseId: bench.id, notes: '', sets: [set(120, 1, { setType: 'warmup' }), set(100, 5), set(80, 8)] },
          { exerciseId: pushUp.id, notes: '', sets: [set(null, 20)] },
        ],
      });
      const first = await saveWorkout(db, null, { name: 'A', notes: '', startedAt: 1_000, endedAt: 1_500, templateId: null, exercises: [] });
      const rows = await achievementStats(db);
      assert.deepEqual(rows, [
        { id: first, startedAt: 1_000, volume: 0, heaviest: null },
        // Volume counts every set, as on the workout; the heaviest lift ignores warm-ups.
        { id: second, startedAt: 2_000, volume: 120 + 500 + 640, heaviest: 100 },
      ]);
    }));

  test('stays quick with years of history', () =>
    withDb(async (db) => {
      const bench = await exerciseId(db, 'Bench Press (Barbell)');
      const exercises = Array.from({ length: 5 }, () => ({
        exerciseId: bench.id,
        notes: '',
        sets: Array.from({ length: 5 }, () => set(80, 8)),
      }));
      for (let i = 0; i < 2000; i++) {
        await saveWorkout(db, null, { name: 'W', notes: '', startedAt: i * 1000, endedAt: i * 1000 + 500, templateId: null, exercises });
      }
      const t0 = performance.now();
      const rows = await achievementStats(db);
      const ms = performance.now() - t0;
      assert.equal(rows.length, 2000);
      assert.ok(ms < 500, `2000 workouts / 50,000 sets took ${ms.toFixed(0)} ms`);
    }));
});

describe('settings, measurements and backups', () => {
  test('settings round trip and fill in defaults', () =>
    withDb(async (db) => {
      const defaults = await getSettings(db);
      assert.equal(defaults.bodyMapFigure, 'male');
      assert.equal(defaults.timerNotifications, true);
      await saveSettings(db, { ...defaults, units: 'imperial', timerNotifications: false });
      const saved = await getSettings(db);
      assert.equal(saved.units, 'imperial');
      assert.equal(saved.timerNotifications, false);
    }));

  test('a saved body map figure that no longer exists falls back to the default', () =>
    withDb(async (db) => {
      await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES ('settings', ?)", JSON.stringify({ bodyMapFigure: 'goblin', units: 'imperial' }));
      const settings = await getSettings(db);
      assert.equal(settings.bodyMapFigure, 'male');
      assert.equal(settings.units, 'imperial');
      await saveSettings(db, { ...settings, bodyMapFigure: 'female' });
      assert.equal((await getSettings(db)).bodyMapFigure, 'female');
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
      const programId = await installProgram(db, PROGRAMS[0], 'metric');
      const program = await getProgram(db, programId);
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
        assert.deepEqual(await getProgram(other, programId), program, 'programs and their rules come back');
      });
    }));

  test('restoring something that is not a backup fails and changes nothing', () =>
    withDb(async (db) => {
      await assert.rejects(restoreBackup(db, JSON.stringify({ hello: 'world' })), /Not a backup/);
      assert.equal((await listTemplates(db)).length, 5);
    }));
});
