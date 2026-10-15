/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addExercisesTo,
  addSetTo,
  completedExercises,
  countIncompleteSets,
  fillBlanks,
  moveExerciseIn,
  newActiveSet,
  removeSetFrom,
  templateChanges,
  templateExercisesFromWorkout,
  updateSetIn,
  workoutFromTemplate,
  type ActiveWorkout,
} from './activeWorkout';
import { formatClock, formatDuration, parseClock, parseNumber } from './format';
import type { Template } from './types';

const template: Template = {
  id: 1,
  name: 'Push',
  notes: '',
  kind: 'workout',
  folder: null,
  lastUsedAt: null,
  exercises: [
    {
      exerciseId: 10,
      restSeconds: 90,
      notes: '',
      sets: [
        { setType: 'normal', weight: 100, reps: 5, durationS: null, distanceM: null, rpe: null },
        { setType: 'normal', weight: 100, reps: 5, durationS: null, distanceM: null, rpe: null },
      ],
    },
  ],
};

describe('active workout editing', () => {
  it('starts from a template', () => {
    const w = workoutFromTemplate(template, 1000);
    assert.equal(w.templateId, 1);
    assert.equal(w.exercises[0].sets.length, 2);
    assert.equal(w.exercises[0].restSeconds, 90);
    assert.equal(templateChanges(w, template), null);
  });

  it('adds sets copying the previous values', () => {
    let w = workoutFromTemplate(template, 0);
    const key = w.exercises[0].key;
    w = addSetTo(w, key);
    assert.equal(w.exercises[0].sets.length, 3);
    assert.equal(w.exercises[0].sets[2].weight, 100);
    assert.equal(templateChanges(w, template), 'exercises');
    w = removeSetFrom(w, key, w.exercises[0].sets[2].key);
    assert.equal(w.exercises[0].sets.length, 2);
  });

  it('only saves completed sets', () => {
    let w: ActiveWorkout = workoutFromTemplate(template, 0);
    const ex = w.exercises[0];
    w = updateSetIn(w, ex.key, ex.sets[0].key, { completed: true });
    w = addExercisesTo(w, [11]);
    assert.equal(countIncompleteSets(w), 2);
    const done = completedExercises(w);
    assert.equal(done.length, 1);
    assert.equal(done[0].sets.length, 1);
    assert.equal('completed' in done[0].sets[0], false);
  });

  it('notices when only the weights or reps changed', () => {
    let w = workoutFromTemplate(template, 0);
    const ex = w.exercises[0];
    // Ticking a set with the template's own values is not a change.
    w = updateSetIn(w, ex.key, ex.sets[0].key, { completed: true });
    assert.equal(templateChanges(w, template), null);
    // A heavier second set that was never ticked doesn't count either.
    w = updateSetIn(w, ex.key, ex.sets[1].key, { weight: 105 });
    assert.equal(templateChanges(w, template), null);
    w = updateSetIn(w, ex.key, ex.sets[1].key, { completed: true });
    assert.equal(templateChanges(w, template), 'values');
    const saved = templateExercisesFromWorkout(w);
    assert.deepEqual(
      saved[0].sets.map((s) => [s.weight, s.reps]),
      [
        [100, 5],
        [105, 5],
      ],
    );
  });

  it('reorders exercises', () => {
    let w = addExercisesTo(workoutFromTemplate(template, 0), [11]);
    w = moveExerciseIn(w, w.exercises[1].key, -1);
    assert.deepEqual(
      w.exercises.map((e) => e.exerciseId),
      [11, 10],
    );
  });

  it('fills blanks from the previous set', () => {
    const s = fillBlanks(newActiveSet({ reps: 8 }), {
      setType: 'normal',
      weight: 60,
      reps: 5,
      durationS: null,
      distanceM: null,
      rpe: null,
    });
    assert.equal(s.weight, 60);
    assert.equal(s.reps, 8);
  });
});

describe('format helpers', () => {
  it('formats clocks and durations', () => {
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(3725), '1:02:05');
    assert.equal(formatDuration(3900), '1h 5m');
    assert.equal(formatDuration(600), '10m');
  });
  it('parses user input', () => {
    assert.equal(parseClock('1:30'), 90);
    assert.equal(parseClock('abc'), null);
    assert.equal(parseNumber('62,5'), 62.5);
    assert.equal(parseNumber(''), null);
  });
});
