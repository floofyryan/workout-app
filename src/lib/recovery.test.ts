/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { allocateSlots, generateWorkout, pickSplit } from './generator';
import { bodyPartLoad, recoveryByPart, recoveryLevel, TRACKED_PARTS, type PartRecovery } from './recovery';
import type { BodyPart, Exercise, Gym, SetData, WorkoutDetail } from './types';

let nextId = 1;
const ex = (name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id: nextId++,
  name,
  equipment: 'Barbell',
  bodyPart: 'Chest',
  type: 'weight_reps',
  notes: '',
  isCustom: false,
  archived: false,
  restSeconds: null,
  sourceId: null,
  images: [],
  instructions: [],
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  level: null,
  category: null,
  ...extra,
});
const set = (setType: SetData['setType'] = 'normal'): SetData => ({
  setType,
  weight: 100,
  reps: 5,
  durationS: null,
  distanceM: null,
  rpe: null,
});
const HOUR = 3_600_000;
const NOW = 1_000 * HOUR;

const bench = ex('Bench Press (Barbell)', { secondaryMuscles: ['shoulders', 'triceps'] });
const workout = (endedHoursAgo: number, exercise: Exercise, sets: SetData[]): WorkoutDetail => ({
  id: 1,
  name: 'W',
  notes: '',
  startedAt: NOW - endedHoursAgo * HOUR - HOUR,
  endedAt: NOW - endedHoursAgo * HOUR,
  templateId: null,
  exercises: [{ id: 1, exercise, notes: '', sets, supersetGroup: null }],
});
const all = (value: number) => new Map(TRACKED_PARTS.map((p): [BodyPart, PartRecovery] => [p, { recovery: value, lastWorked: null }]));

describe('recovery', () => {
  it('main muscles take the full load, helpers half', () => {
    assert.deepEqual(
      [...bodyPartLoad(bench)],
      [
        ['Chest', 1],
        ['Shoulders', 0.5],
        ['Triceps', 0.5],
      ],
    );
    const custom = ex('My Row', { bodyPart: 'Back', primaryMuscles: [] });
    assert.deepEqual([...bodyPartLoad(custom)], [['Back', 1]], 'without muscle data, the body part counts');
  });

  it('hard sets wear a body part down and it recovers over a few days; warm-ups do not count', () => {
    const sets = [set('warmup'), set(), set(), set(), set(), set()];
    const justNow = recoveryByPart([workout(0, bench, sets)], NOW);
    assert.equal(justNow.get('Chest')?.recovery, 0.5, '5 hard sets of 10');
    assert.equal(justNow.get('Triceps')?.recovery, 0.75);
    assert.equal(justNow.get('Quads')?.recovery, 1);
    assert.equal(justNow.get('Quads')?.lastWorked, null);
    assert.ok(justNow.get('Chest')?.lastWorked);

    const later = recoveryByPart([workout(36, bench, sets)], NOW);
    assert.equal(later.get('Chest')?.recovery, 0.75, 'half way through 72 h');
    assert.equal(later.get('Triceps')?.recovery, 1 - (5 * 0.5 * 0.25) / 10, 'smaller muscles recover in 48 h');
    assert.equal(recoveryByPart([workout(72, bench, sets)], NOW).get('Chest')?.recovery, 1);

    assert.equal(recoveryLevel(0.2), 'worked');
    assert.equal(recoveryLevel(0.5), 'recovering');
    assert.equal(recoveryLevel(0.9), 'fresh');
  });
});

describe('workout generator', () => {
  it('picks the freshest split', () => {
    assert.equal(pickSplit(all(1)), 'full', 'everything fresh: full body');
    const legsDone = all(1);
    for (const p of ['Quads', 'Hamstrings', 'Glutes', 'Calves'] as const) legsDone.set(p, { recovery: 0.2, lastWorked: NOW });
    assert.equal(pickSplit(legsDone), 'upper');
    const pushDone = all(1);
    for (const p of ['Chest', 'Shoulders', 'Triceps'] as const) pushDone.set(p, { recovery: 0.1, lastWorked: NOW });
    assert.equal(pickSplit(pushDone), 'lower');
  });

  it('gives big muscles more exercises and keeps each part together', () => {
    assert.deepEqual(allocateSlots(['Back', 'Biceps'], 5), ['Back', 'Back', 'Back', 'Biceps', 'Biceps']);
    assert.deepEqual(allocateSlots(['Chest', 'Shoulders', 'Triceps'], 5), ['Chest', 'Chest', 'Shoulders', 'Shoulders', 'Triceps']);
    assert.equal(allocateSlots(['Quads', 'Chest', 'Back', 'Hamstrings', 'Shoulders', 'Core'], 4).length, 4);
  });

  it('builds a workout from exercises the gym can do, favouring ones you know', () => {
    const library = [
      bench,
      ex('Bench Press (Dumbbell)', { equipment: 'Dumbbell', secondaryMuscles: ['shoulders', 'triceps'] }),
      ex('Chest Fly (Dumbbell)', { equipment: 'Dumbbell' }),
      ex('Push Up (Bodyweight)', { equipment: 'Bodyweight', type: 'reps' }),
      ex('Chest Stretch', { equipment: 'Other', category: 'stretching', type: 'duration' }),
      ex('Overhead Press (Dumbbell)', { equipment: 'Dumbbell', bodyPart: 'Shoulders', primaryMuscles: ['shoulders'] }),
      ex('Lateral Raise (Dumbbell)', { equipment: 'Dumbbell', bodyPart: 'Shoulders', primaryMuscles: ['shoulders'] }),
      ex('Triceps Kickback (Dumbbell)', { equipment: 'Dumbbell', bodyPart: 'Triceps', primaryMuscles: ['triceps'] }),
      ex('Triceps Pushdown (Cable)', { equipment: 'Cable', bodyPart: 'Triceps', primaryMuscles: ['triceps'] }),
    ];
    const home: Gym = { id: 'h', name: 'Home', equipment: ['Dumbbell'] };
    const fly = library[2];
    const options = {
      exercises: library,
      recovery: all(1),
      gym: home,
      useCounts: new Map([[fly.id, 4]]),
      isStaple: () => false,
      focus: 'push' as const,
      count: 5,
      seed: 7,
    };
    const plan = generateWorkout(options);
    assert.equal(plan.split, 'push');
    assert.equal(plan.name, 'Push Day');
    const names = plan.exercises.map((p) => p.exercise.name);
    assert.equal(new Set(names).size, names.length, 'no exercise twice');
    assert.ok(names.every((n) => !n.includes('Barbell') && !n.includes('Cable') && n !== 'Chest Stretch'), names.join());
    assert.deepEqual(
      plan.exercises.map((p) => p.part),
      ['Chest', 'Chest', 'Shoulders', 'Shoulders', 'Triceps'],
    );
    assert.ok(names.slice(0, 2).includes('Chest Fly (Dumbbell)'), 'the exercise you do is in');
    assert.ok(plan.exercises.every((p) => p.sets.length === 3));
    assert.deepEqual(generateWorkout(options), plan, 'the same seed gives the same workout');
  });

  it("leads with the body part's core muscles and doesn't repeat a movement", () => {
    const back = (name: string, primary: string, equipment: Exercise['equipment'] = 'Dumbbell') =>
      ex(name, { equipment, bodyPart: 'Back', primaryMuscles: [primary], secondaryMuscles: ['biceps', 'shoulders'] });
    const library = [
      back('Back Extension (Bodyweight)', 'lower back', 'Bodyweight'),
      back('Back Extension (Weighted)', 'lower back', 'Bodyweight'),
      back('Bent Over Row (Dumbbell)', 'middle back'),
      back('Bent Over Row (Barbell)', 'middle back', 'Barbell'),
      back('Pullover (Dumbbell)', 'lats'),
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generateWorkout({
        exercises: library,
        recovery: all(1),
        gym: null,
        useCounts: new Map(),
        isStaple: () => true,
        focus: 'pull',
        count: 3,
        seed,
      });
      const names = plan.exercises.map((p) => p.exercise.name);
      assert.ok(!names[0].startsWith('Back Extension'), `seed ${seed}: led with ${names[0]}`);
      const moves = names.map((n) => n.replace(/ \(.*\)$/, ''));
      assert.equal(new Set(moves).size, moves.length, `seed ${seed}: ${names.join(', ')}`);
    }
  });
});
