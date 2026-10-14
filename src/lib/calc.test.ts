/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculatePlates,
  computeRecords,
  estimate1RM,
  newRecords,
  repMaxes,
  setVolume,
  warmupSets,
} from './calc';
import type { SetData } from './types';

const set = (weight: number | null, reps: number | null, setType: SetData['setType'] = 'normal'): SetData => ({
  setType,
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

describe('estimate1RM', () => {
  it('returns the weight for a single', () => assert.equal(estimate1RM(100, 1), 100));
  it('uses Epley for multiple reps', () => assert.equal(estimate1RM(100, 30), 200));
  it('is 0 for empty sets', () => assert.equal(estimate1RM(0, 5), 0));
});

describe('setVolume', () => {
  it('multiplies weight and reps for weighted movements', () => assert.equal(setVolume('weight_reps', set(50, 10)), 500));
  it('ignores assisted movements', () => assert.equal(setVolume('assisted_bodyweight', set(20, 10)), 0));
});

describe('computeRecords', () => {
  it('ignores warm-up sets', () => {
    const r = computeRecords('weight_reps', [set(200, 1, 'warmup'), set(100, 5)]);
    assert.equal(r.maxWeight, 100);
    assert.equal(r.maxReps, 5);
    assert.equal(r.maxSetVolume, 500);
  });
});

describe('newRecords', () => {
  it('reports improved records only', () => {
    const prev = computeRecords('weight_reps', [set(100, 5)]);
    const cur = computeRecords('weight_reps', [set(105, 3)]);
    assert.deepEqual(newRecords('weight_reps', prev, cur), ['maxWeight']);
  });
  it('reports nothing without history', () => {
    assert.deepEqual(newRecords('weight_reps', null, computeRecords('weight_reps', [set(100, 5)])), []);
  });
});

describe('repMaxes', () => {
  it('a heavier set for more reps counts toward fewer reps', () => {
    const r = repMaxes([set(100, 3), set(90, 5)], 5);
    assert.deepEqual(r, [100, 100, 100, 90, 90]);
  });
});

describe('calculatePlates', () => {
  it('loads plates greedily per side', () => {
    const r = calculatePlates(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    assert.deepEqual(r.perSide, [25, 15]);
    assert.equal(r.remainder, 0);
  });
  it('reports what cannot be loaded', () => {
    const r = calculatePlates(101, 20, [25, 20, 10, 5, 2.5]);
    assert.equal(r.achieved, 100);
    assert.equal(r.remainder, 1);
  });
  it('handles targets below the bar', () => {
    assert.deepEqual(calculatePlates(15, 20, [25]).perSide, []);
  });
});

describe('warmupSets', () => {
  it('ramps up from the bar', () => {
    assert.deepEqual(warmupSets(100, 20, 2.5), [
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 80, reps: 2 },
    ]);
  });
  it('skips steps not above the bar', () => {
    assert.deepEqual(warmupSets(40, 20, 2.5), [
      { weight: 20, reps: 10 },
      { weight: 25, reps: 3 },
      { weight: 32.5, reps: 2 },
    ]);
  });
});
