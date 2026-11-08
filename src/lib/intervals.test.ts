/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeIntervals, INTERVAL_DEFAULTS, phaseAlert, phasesFor, positionAt, PREP_SECONDS, totalSeconds } from './intervals';

const kinds = (config: Parameters<typeof phasesFor>[0]) => phasesFor(config).map((p) => `${p.kind}${p.round}:${p.duration}`);

describe('interval schedules', () => {
  it('EMOM is a run of whole intervals after the countdown', () => {
    const phases = phasesFor({ ...INTERVAL_DEFAULTS.emom, rounds: 3 });
    assert.deepEqual(
      phases.map((p) => `${p.kind}${p.round}:${p.duration}`),
      ['prep0:10', 'work1:60', 'work2:60', 'work3:60'],
    );
    assert.equal(totalSeconds(phases), PREP_SECONDS + 180);
  });

  it('Tabata is always 20 on, 10 off, with no rest after the last round', () => {
    const phases = phasesFor({ mode: 'tabata', work: 45, rest: 45, rounds: 2 });
    assert.deepEqual(
      phases.map((p) => `${p.kind}${p.round}:${p.duration}`),
      ['prep0:10', 'work1:20', 'rest1:10', 'work2:20'],
    );
  });

  it('work / rest uses its own times, and skips zero-length rests', () => {
    assert.deepEqual(kinds({ mode: 'custom', work: 30, rest: 15, rounds: 2 }), ['prep0:10', 'work1:30', 'rest1:15', 'work2:30']);
    assert.deepEqual(kinds({ mode: 'custom', work: 30, rest: 0, rounds: 2 }), ['prep0:10', 'work1:30', 'work2:30']);
  });

  it('AMRAP is a single block of work', () => {
    assert.deepEqual(kinds({ mode: 'amrap', work: 600, rest: 99, rounds: 5 }), ['prep0:10', 'work1:600']);
  });

  it('finds the phase and time left at any moment', () => {
    const phases = phasesFor({ mode: 'custom', work: 30, rest: 15, rounds: 2 });
    assert.deepEqual(positionAt(phases, 0), { index: 0, remaining: 10 });
    assert.deepEqual(positionAt(phases, 10), { index: 1, remaining: 30 }, 'a boundary belongs to the next phase');
    assert.deepEqual(positionAt(phases, 52.5), { index: 2, remaining: 2.5 });
    assert.deepEqual(positionAt(phases, 85), { index: 4, remaining: 0 }, 'done');
  });

  it('describes configs and phase alerts', () => {
    assert.equal(describeIntervals(INTERVAL_DEFAULTS.emom), '10 × 1:00');
    assert.equal(describeIntervals(INTERVAL_DEFAULTS.tabata), '8 × 0:20 on / 0:10 off');
    assert.equal(describeIntervals(INTERVAL_DEFAULTS.amrap), '12:00 AMRAP');
    const [, work, rest] = phasesFor({ mode: 'custom', work: 30, rest: 15, rounds: 3 });
    assert.deepEqual(phaseAlert(work, 3), { title: 'Round 1 of 3', body: 'Work!' });
    assert.deepEqual(phaseAlert(rest, 3), { title: 'Rest', body: 'Round 1 of 3 done.' });
  });
});
