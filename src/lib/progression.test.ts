/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  defaultProgression,
  describeOutcome,
  describeProgression,
  parseNextTime,
  parseProgression,
  progress,
  progressionKinds,
  type ProgressionResult,
} from './progression';
import type { Progression, SetData } from './types';
import { KG_PER_LB } from './units';

const s = (weight: number | null, reps: number | null, extra: Partial<SetData> = {}): SetData => ({
  setType: 'normal',
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
  ...extra,
});
const hold = (seconds: number | null) => s(null, null, { durationS: seconds });
const linear: Progression = { kind: 'linear', increment: 2.5, deloadAfter: 3, deloadPercent: 10, misses: 0 };
const double: Progression = { kind: 'double', minReps: 8, maxReps: 12, increment: 2.5 };
const weights = (sets: SetData[]) => sets.map((x) => x.weight);
const reps = (sets: SetData[]) => sets.map((x) => x.reps);

describe('linear progression', () => {
  const targets = [s(20, 10, { setType: 'warmup' }), s(100, 5), s(100, 5), s(100, 5)];

  it('adds the increment when every set hits its target, leaving warm-ups alone', () => {
    const r = progress(linear, 'weight_reps', targets, [s(20, 10, { setType: 'warmup' }), s(100, 5), s(100, 5), s(100, 6)]);
    assert.equal(r?.outcome, 'up');
    assert.deepEqual(weights(r!.sets), [20, 102.5, 102.5, 102.5]);
    assert.deepEqual(reps(r!.sets), [10, 5, 5, 5]);
  });

  it('goes up from what was lifted when that was heavier than planned', () => {
    const r = progress(linear, 'weight_reps', [s(100, 5)], [s(105, 5)]);
    assert.deepEqual(weights(r!.sets), [107.5]);
  });

  it('counts misses, then deloads by the percentage, rounded to the step', () => {
    const missed = [s(100, 5), s(100, 4), s(100, 5)];
    let rule: Progression = linear;
    for (const expected of [1, 2]) {
      const r: ProgressionResult = progress(rule, 'weight_reps', targets, missed)!;
      assert.equal(r.outcome, 'same');
      assert.deepEqual(r.sets, targets);
      assert.equal(r.progression.kind === 'linear' && r.progression.misses, expected);
      rule = r.progression;
    }
    const r = progress(rule, 'weight_reps', [s(102.5, 5)], [s(102.5, 3)])!;
    assert.equal(r.outcome, 'deload');
    assert.deepEqual(weights(r.sets), [92.5]); // 92.25 rounded to 2.5
    assert.equal(r.progression.kind === 'linear' && r.progression.misses, 0);
  });

  it('a lighter weight or a missing set is a miss', () => {
    assert.equal(progress(linear, 'weight_reps', [s(100, 5), s(100, 5)], [s(95, 5), s(95, 5)])?.outcome, 'same');
    assert.equal(progress(linear, 'weight_reps', [s(100, 5), s(100, 5)], [s(100, 5)])?.outcome, 'same');
  });

  it('a skipped exercise changes nothing', () => {
    assert.equal(progress(linear, 'weight_reps', targets, []), null);
    assert.equal(progress(linear, 'weight_reps', targets, [s(20, 10, { setType: 'warmup' })]), null);
  });

  it('with no weights set yet, the first session sets the starting point', () => {
    const r = progress(linear, 'weight_reps', [s(null, 5), s(null, 5)], [s(60, 5), s(62.5, 5)])!;
    assert.equal(r.outcome, 'start');
    assert.deepEqual(weights(r.sets), [60, 62.5]);
  });

  it('adds reps for reps-only exercises and time for holds, from the target', () => {
    const pushUps = progress({ ...linear, increment: 1 }, 'reps', [s(null, 10), s(null, 10)], [s(null, 15), s(null, 10)])!;
    assert.deepEqual(reps(pushUps.sets), [11, 11]);
    const plank = progress({ ...linear, increment: 5 }, 'duration', [hold(30)], [hold(32)])!;
    assert.equal(plank.outcome, 'up');
    assert.equal(plank.sets[0].durationS, 35);
    const short = progress({ ...linear, increment: 5, misses: 2 }, 'duration', [hold(30)], [hold(20)])!;
    assert.equal(short.outcome, 'deload');
    assert.equal(short.sets[0].durationS, 27);
  });

  it('assisted exercises progress by taking assistance away', () => {
    const up = progress(linear, 'assisted_bodyweight', [s(20, 8)], [s(20, 8)])!;
    assert.deepEqual(weights(up.sets), [17.5]);
    const down = progress({ ...linear, misses: 2 }, 'assisted_bodyweight', [s(20, 8)], [s(20, 5)])!;
    assert.deepEqual(weights(down.sets), [22.5]); // 22 rounded to 2.5: more help after a deload
  });

  it('weighted bodyweight with no added weight yet starts adding some', () => {
    const r = progress(linear, 'weighted_bodyweight', [s(null, 8)], [s(null, 8)])!;
    assert.equal(r.outcome, 'up');
    assert.deepEqual(weights(r.sets), [2.5]);
  });
});

describe('double progression', () => {
  it('adds a rep to each set that made its goal, up to the top of the range', () => {
    const r = progress(double, 'weight_reps', [s(40, 8), s(40, 8), s(40, 8)], [s(40, 10), s(40, 8), s(40, 7)])!;
    assert.equal(r.outcome, 'reps');
    assert.deepEqual(reps(r.sets), [11, 9, 8]);
    assert.deepEqual(weights(r.sets), [40, 40, 40]);
  });

  it('adds weight and drops back to the bottom once every set reaches the top', () => {
    const r = progress(double, 'weight_reps', [s(40, 12), s(40, 12)], [s(40, 12), s(40, 13)])!;
    assert.equal(r.outcome, 'up');
    assert.deepEqual(weights(r.sets), [42.5, 42.5]);
    assert.deepEqual(reps(r.sets), [8, 8]);
  });

  it('stays put when no set made its goal', () => {
    const r = progress(double, 'weight_reps', [s(40, 10)], [s(40, 9)])!;
    assert.equal(r.outcome, 'same');
    assert.deepEqual(reps(r.sets), [10]);
  });
});

describe('rule helpers', () => {
  it('offers rules that fit the exercise type', () => {
    assert.deepEqual(progressionKinds('weight_reps'), ['linear', 'double']);
    assert.deepEqual(progressionKinds('reps'), ['linear']);
    assert.deepEqual(progressionKinds('distance_duration'), []);
    assert.equal(defaultProgression('linear', 'duration', 'metric').increment, 5);
    const lb = defaultProgression('linear', 'weight_reps', 'imperial');
    assert.ok(Math.abs(lb.increment - 5 * KG_PER_LB) < 1e-9, '5 lb, stored in kg');
  });

  it('describes rules and outcomes in the user’s units', () => {
    assert.equal(describeProgression(linear, 'weight_reps', 'metric'), '+2.5 kg when every set hits its reps · −10% after 3 misses');
    assert.equal(describeProgression(double, 'weight_reps', 'metric'), '8–12 reps, then +2.5 kg');
    assert.equal(
      describeProgression({ ...linear, increment: 5 }, 'duration', 'metric'),
      '+5 s when every hold lasts its time · −10% after 3 misses',
    );
    const lb = defaultProgression('linear', 'weight_reps', 'imperial');
    assert.match(describeProgression(lb, 'weight_reps', 'imperial'), /^\+5 lb /);

    const up = progress(linear, 'weight_reps', [s(100, 5), s(100, 5)], [s(100, 5), s(100, 5)])!;
    assert.equal(describeOutcome(up, 'weight_reps', 'metric'), 'Up to 102.5 kg × 5');
    const miss = progress(linear, 'weight_reps', [s(100, 5)], [s(100, 3)])!;
    assert.equal(describeOutcome(miss, 'weight_reps', 'metric'), 'Same again: 100 kg × 5 (1 of 3 misses before a deload)');
    const more = progress(double, 'weight_reps', [s(40, 8), s(40, 8)], [s(40, 9), s(40, 8)])!;
    assert.equal(describeOutcome(more, 'weight_reps', 'metric'), 'Aim for 40 kg × 10, 9');
  });

  it('reads stored rules and summary lines defensively', () => {
    assert.deepEqual(parseProgression(JSON.stringify(double)), double);
    assert.equal(parseProgression(JSON.stringify({ ...linear, misses: undefined }))?.kind, 'linear');
    assert.equal(parseProgression('{"kind":"linear"}'), null);
    assert.equal(parseProgression('not json'), null);
    assert.equal(parseProgression(null), null);
    assert.deepEqual(parseNextTime(JSON.stringify([{ name: 'Squat', outcome: 'up', text: 'Up to 100 kg × 5' }, { bad: 1 }])), [
      { name: 'Squat', outcome: 'up', text: 'Up to 100 kg × 5' },
    ]);
    assert.deepEqual(parseNextTime('nope'), []);
  });
});
