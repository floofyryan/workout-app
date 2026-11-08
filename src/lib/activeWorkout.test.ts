/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addExercisesTo,
  addSetTo,
  completedExercises,
  countIncompleteSets,
  editedExercises,
  fillBlanks,
  insertSetsAtStart,
  moveExerciseIn,
  newActiveSet,
  progressedTemplate,
  progressWorkout,
  removeSetFrom,
  replaceExerciseIn,
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
  programId: null,
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

  it('the past-workout editor saves replaced exercises and added warm-ups', () => {
    // Loaded the way the editor loads a past workout: every set ticked (it has no tick column).
    let w = workoutFromTemplate(template, 0);
    w = { ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, completed: true })) })) };
    w = addExercisesTo(w, [11, 13], true);
    const [bench, swapped] = w.exercises;
    w = insertSetsAtStart(w, bench.key, [{ setType: 'warmup', weight: 40, reps: 10 }]);
    w = replaceExerciseIn(w, swapped.key, 12);
    w = updateSetIn(w, swapped.key, w.exercises[1].sets[0].key, { weight: 30, reps: 12 });

    const saved = editedExercises(w);
    assert.deepEqual(
      saved.map((e) => [e.exerciseId, e.sets.length]),
      [
        [10, 3],
        [12, 1],
      ],
      'exercise 13 has no values, so it is left out',
    );
    assert.equal(saved[0].sets[0].setType, 'warmup');
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

  it('progression rules carry through a workout and move the template on', () => {
    const rule = { kind: 'linear' as const, increment: 2.5, deloadAfter: 3, deloadPercent: 10, misses: 0 };
    const program: Template = {
      ...template,
      exercises: [
        { ...template.exercises[0], progression: rule },
        {
          exerciseId: 20,
          restSeconds: null,
          notes: '',
          sets: [{ setType: 'normal', weight: 50, reps: 8, durationS: null, distanceM: null, rpe: null }],
        },
      ],
    };
    let w = workoutFromTemplate(program, 0);
    assert.deepEqual(w.exercises[0].progression, rule);
    assert.equal(w.exercises[0].targets?.length, 2, 'targets are kept to judge the rule against');
    assert.equal(w.exercises[1].progression, null);

    // Do the ruled exercise as planned, the other one heavier; then move the ruled one last.
    const [squat, row] = w.exercises;
    for (const set of squat.sets) w = updateSetIn(w, squat.key, set.key, { completed: true });
    w = updateSetIn(w, row.key, row.sets[0].key, { weight: 55, completed: true });
    w = moveExerciseIn(w, squat.key, 1);
    assert.equal(templateChanges(w, program), 'exercises', 'order changed');

    const types = () => 'weight_reps' as const;
    const results = progressWorkout(w, types);
    assert.deepEqual([...results.keys()], [squat.key], 'only exercises with a rule progress');
    // Keeping the template's layout: the ruled exercise moves on, the other one stays as it was.
    const kept = progressedTemplate(program, w, results);
    assert.deepEqual(kept[0].sets.map((s) => s.weight), [102.5, 102.5]);
    assert.equal(kept[1].sets[0].weight, 50);
    // Updating the template to match the workout: same, but in the new order with today's numbers.
    const updated = templateExercisesFromWorkout(w, results);
    assert.deepEqual(updated.map((e) => e.exerciseId), [20, 10]);
    assert.equal(updated[0].sets[0].weight, 55);
    assert.deepEqual(updated[1].sets.map((s) => s.weight), [102.5, 102.5]);
    assert.deepEqual(updated[1].progression, rule);

    // A ruled exercise's numbers alone don't make the template "changed": the rule handles them.
    const same = workoutFromTemplate(program, 0);
    const ex = same.exercises[0];
    const heavier = updateSetIn(same, ex.key, ex.sets[0].key, { weight: 110, completed: true });
    assert.equal(templateChanges(heavier, program), null);
    // Swapping the exercise out drops its rule.
    const swapped = replaceExerciseIn(same, ex.key, 30);
    assert.equal(swapped.exercises[0].progression, null);
    assert.equal(swapped.exercises[0].targets, null);
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
