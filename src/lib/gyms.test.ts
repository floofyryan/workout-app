/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { activeGym, availableIn, GYM_PRESETS, similarExercises } from './gyms';
import type { Exercise, Gym } from './types';

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

const home: Gym = { id: 'home', name: 'Home', equipment: ['Dumbbell', 'Band'] };

describe('gyms', () => {
  it('bodyweight moves and stretches are available anywhere', () => {
    assert.equal(availableIn(home, { equipment: 'Dumbbell' }), true);
    assert.equal(availableIn(home, { equipment: 'Barbell' }), false);
    assert.equal(availableIn(home, { equipment: 'Bodyweight' }), true);
    assert.equal(availableIn(home, { equipment: 'Other' }), true);
    assert.equal(availableIn(null, { equipment: 'Barbell' }), true, 'no gym: everything');
    assert.equal(GYM_PRESETS[0].equipment.includes('Bodyweight'), false, 'presets list only real choices');
  });

  it('finds the active gym', () => {
    assert.equal(activeGym({ gyms: [home], activeGymId: 'home' }), home);
    assert.equal(activeGym({ gyms: [home], activeGymId: 'gone' }), null);
    assert.equal(activeGym({ gyms: [home], activeGymId: null }), null);
  });

  it('suggests stand-ins for the same muscle, at the gym, most used first', () => {
    const bench = ex('Bench Press (Barbell)', { secondaryMuscles: ['triceps', 'shoulders'] });
    const dbBench = ex('Bench Press (Dumbbell)', { equipment: 'Dumbbell', secondaryMuscles: ['triceps', 'shoulders'] });
    const fly = ex('Chest Fly (Dumbbell)', { equipment: 'Dumbbell' });
    const pushUp = ex('Push Up (Bodyweight)', { equipment: 'Bodyweight', type: 'reps', secondaryMuscles: ['triceps'] });
    const machine = ex('Chest Press (Machine)', { equipment: 'Machine' });
    const stretch = ex('Chest Stretch', { equipment: 'Other', category: 'stretching', type: 'duration' });
    const row = ex('Bent Over Row (Barbell)', { bodyPart: 'Back', primaryMuscles: ['middle back'] });
    const old = ex('Old Press (Dumbbell)', { equipment: 'Dumbbell', archived: true });
    const chains = ex('Chain Press', { equipment: 'Other', secondaryMuscles: ['triceps', 'shoulders'] });
    const all = [bench, dbBench, fly, pushUp, machine, stretch, row, old, chains];

    const atHome = similarExercises(bench, all, home, new Map([[fly.id, 3]]));
    assert.deepEqual(
      atHome.map((e) => e.name),
      // Fly is used most; then by shared muscles: dumbbell bench (3), push-up (2); odd gear last.
      ['Chest Fly (Dumbbell)', 'Bench Press (Dumbbell)', 'Push Up (Bodyweight)', 'Chain Press'],
    );
    const anywhere = similarExercises(bench, all, null, new Map());
    assert.ok(anywhere.some((e) => e.name === 'Chest Press (Machine)'));
    assert.ok(!anywhere.includes(stretch), 'a stretch is no stand-in for a press');
    assert.ok(!anywhere.includes(row) && !anywhere.includes(bench) && !anywhere.includes(old));

    // Without muscle data (e.g. a custom exercise), the body part decides.
    const custom = ex('My Press', { isCustom: true, primaryMuscles: [] });
    assert.ok(similarExercises(custom, all, null, new Map()).includes(bench));
  });
});
