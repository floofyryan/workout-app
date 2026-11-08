/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PROGRAMS } from '../data/programs';
import type { SetData } from '../lib/types';
import {
  createExercise,
  findExerciseByName,
  getExercise,
  getProgram,
  getTemplate,
  installProgram,
  saveTemplate,
} from './repo';
import { migrateDb } from './schema';
import { exportProgram, exportTemplate, importShared, parseSharedFile } from './share';
import { openTestDb } from './testDb';

type TestDb = ReturnType<typeof openTestDb>;

async function withDb(fn: (db: TestDb) => Promise<void>) {
  const db = openTestDb();
  try {
    await migrateDb(db);
    await fn(db);
  } finally {
    db.close();
  }
}

const set = (weight: number | null, reps: number | null): SetData => ({
  setType: 'normal',
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

describe('sharing templates and programs', () => {
  test('a template travels to another database without weights, keeping rules and supersets', () =>
    withDb(async (mine) => {
      const bench = (await findExerciseByName(mine, 'Bench Press (Barbell)'))!;
      const row = (await findExerciseByName(mine, 'Bent Over Row (Barbell)'))!;
      const customId = await createExercise(mine, {
        name: 'Landmine Row (Barbell)',
        equipment: 'Barbell',
        bodyPart: 'Back',
        type: 'weight_reps',
        notes: 'my cue',
        restSeconds: null,
        category: null,
      });
      const id = await saveTemplate(mine, null, {
        name: 'Upper',
        notes: 'Heavy day',
        kind: 'workout',
        exercises: [
          {
            exerciseId: bench.id,
            restSeconds: 180,
            notes: 'pause',
            sets: [set(100, 5), set(100, 5)],
            supersetGroup: null,
            progression: { kind: 'linear', increment: 2.5, deloadAfter: 3, deloadPercent: 10, misses: 2 },
          },
          { exerciseId: row.id, restSeconds: null, notes: '', sets: [set(60, 8)], supersetGroup: 1 },
          { exerciseId: customId, restSeconds: null, notes: '', sets: [set(40, 10)], supersetGroup: 1 },
        ],
      });
      const json = (await exportTemplate(mine, id))!;
      assert.ok(!json.includes('100'), 'weights are left out');

      await withDb(async (theirs) => {
        const first = await importShared(theirs, json);
        assert.equal(first.programId, null);
        assert.equal(first.exercisesCreated, 1, 'only the custom exercise was missing');
        const t = (await getTemplate(theirs, first.templateIds[0]))!;
        assert.equal(t.name, 'Upper');
        assert.equal(t.notes, 'Heavy day');
        assert.deepEqual(
          t.exercises.map((e) => [e.restSeconds, e.notes, e.supersetGroup, e.sets.map((s) => [s.weight, s.reps])]),
          [
            [180, 'pause', null, [[null, 5], [null, 5]]],
            [null, '', 1, [[null, 8]]],
            [null, '', 1, [[null, 10]]],
          ],
        );
        assert.deepEqual(
          t.exercises[0].progression,
          { kind: 'linear', increment: 2.5, deloadAfter: 3, deloadPercent: 10, misses: 0 },
          'the rule comes along, without the sender’s misses',
        );
        const custom = (await getExercise(theirs, t.exercises[2].exerciseId))!;
        assert.equal(custom.name, 'Landmine Row (Barbell)');
        assert.equal(custom.isCustom, true);
        assert.equal(custom.bodyPart, 'Back');
        assert.equal(custom.notes, '', 'personal exercise notes stay behind');

        const again = await importShared(theirs, json);
        assert.equal(again.exercisesCreated, 0, 'importing twice reuses the exercise created the first time');
      });
    }));

  test('a whole program travels with its workouts in order', () =>
    withDb(async (mine) => {
      const id = await installProgram(mine, PROGRAMS.find((p) => p.key === 'upper-lower')!, 'metric');
      const original = (await getProgram(mine, id))!;
      const json = (await exportProgram(mine, id))!;
      await withDb(async (theirs) => {
        const r = await importShared(theirs, json);
        assert.ok(r.programId);
        assert.equal(r.name, 'Upper / Lower');
        const p = (await getProgram(theirs, r.programId))!;
        assert.equal(p.notes, original.notes);
        assert.deepEqual(
          p.templates.map((t) => [t.name, t.exercises.length]),
          original.templates.map((t) => [t.name, t.exercises.length]),
        );
        assert.equal(p.nextTemplateId, p.templates[0].id);
        assert.ok(p.templates.every((t) => t.exercises.every((e) => e.progression)));
      });
    }));

  test('rejects other files and cleans up odd values', () => {
    assert.throws(() => parseSharedFile('not json'), /isn't a template or program/);
    assert.throws(() => parseSharedFile(JSON.stringify({ app: 'workout-app', version: 1, data: {} })), /isn't a template/);
    assert.throws(() => parseSharedFile(JSON.stringify({ app: 'workout-app', format: 'template', templates: [] })), /no workouts/);
    const file = parseSharedFile(
      JSON.stringify({
        app: 'workout-app',
        format: 'template',
        templates: [
          {
            name: '  ',
            kind: 'nonsense',
            exercises: [
              { name: 'Mystery Curl (Cable)', equipment: 'Laser', sets: [{ setType: 'huge', reps: 8.6, weight: 'heavy' }], progression: { kind: 'magic' } },
              { name: '' },
              'junk',
            ],
          },
        ],
      }),
    );
    const t = file.templates[0];
    assert.equal(t.name, 'Shared workout');
    assert.equal(t.kind, 'workout');
    assert.equal(t.exercises.length, 1);
    assert.equal(t.exercises[0].equipment, 'Cable', 'unknown equipment is guessed from the name');
    assert.equal(t.exercises[0].bodyPart, 'Biceps');
    assert.deepEqual(t.exercises[0].sets[0], { setType: 'normal', weight: null, reps: 9, durationS: null, distanceM: null, rpe: null });
    assert.equal(t.exercises[0].progression, null);
  });
});
