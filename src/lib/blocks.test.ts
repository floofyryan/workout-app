/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { adjustWorkingSets, blockWeek, deloadSets, describeBlockWeek, targetRir } from './blocks';
import type { SetData } from './types';

const s = (reps: number, setType: SetData['setType'] = 'normal'): SetData => ({
  setType,
  weight: 50,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

describe('training blocks', () => {
  it('effort goes from 3 reps in reserve to 0 over the build weeks', () => {
    assert.deepEqual([1, 2, 3, 4].map((w) => targetRir(w, 4)), [3, 2, 1, 0]);
    assert.deepEqual([1, 2, 3].map((w) => targetRir(w, 3)), [3, 2, 0]);
    assert.equal(targetRir(1, 1), 2);
  });

  it('weeks follow completed rotations, end with a deload and then start over', () => {
    // A 3-workout program in a 5-week block.
    assert.deepEqual(blockWeek(5, 0, 3), { week: 1, weeks: 5, block: 1, rir: 3, deload: false });
    assert.equal(blockWeek(5, 2, 3).week, 1, 'part way through the first rotation');
    assert.equal(blockWeek(5, 3, 3).week, 2);
    const deload = blockWeek(5, 12, 3);
    assert.deepEqual(deload, { week: 5, weeks: 5, block: 1, rir: null, deload: true });
    assert.deepEqual(blockWeek(5, 15, 3), { week: 1, weeks: 5, block: 2, rir: 3, deload: false });
    assert.equal(describeBlockWeek(blockWeek(5, 3, 3)), 'Week 2 of 5: stop about 2 reps short of failure');
    assert.equal(describeBlockWeek(blockWeek(5, 9, 3)), 'Week 4 of 5: push close to failure');
    assert.equal(describeBlockWeek(deload), 'Deload week (5 of 5): half the sets, keep it easy');
  });

  it('a deload keeps warm-ups and half the working sets', () => {
    const sets = [s(10, 'warmup'), s(8), s(8), s(8)];
    assert.deepEqual(deloadSets(sets), [s(10, 'warmup'), s(8), s(8)]);
    assert.deepEqual(deloadSets([s(5)]), [s(5)]);
  });

  it('feedback adds or removes working sets within limits', () => {
    const sets = [s(10, 'warmup'), s(8), s(9)];
    assert.deepEqual(adjustWorkingSets(sets, 1), [s(10, 'warmup'), s(8), s(9), s(9)], 'a copy of the last working set');
    assert.deepEqual(adjustWorkingSets(sets, -1), [s(10, 'warmup'), s(8)]);
    assert.deepEqual(adjustWorkingSets(sets, -5), [s(10, 'warmup'), s(8)], 'at least one working set');
    assert.equal(adjustWorkingSets([s(8)], 20).length, 8, 'at most eight');
    assert.deepEqual(adjustWorkingSets(sets, 0), sets);
  });
});
