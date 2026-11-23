/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COUNTDOWN_GO_AT_MS, countdownDelay, countdownStillOnTime } from './restCountdown';

describe('rest countdown', () => {
  it('starts so the GO beep lands on the end of the rest', () => {
    const now = 1_000_000;
    const endsAt = now + 90_000;
    const delay = countdownDelay(endsAt, now);
    assert.equal(delay, 90_000 - COUNTDOWN_GO_AT_MS);
    assert.equal(now + delay! + COUNTDOWN_GO_AT_MS, endsAt);
  });
  it('is skipped when the whole countdown no longer fits', () => {
    assert.equal(countdownDelay(5_000, 5_000 - COUNTDOWN_GO_AT_MS + 1), null);
    assert.equal(countdownDelay(5_000, 5_000 - 2_000), null);
    assert.equal(countdownDelay(5_000, 5_000 - COUNTDOWN_GO_AT_MS), 0);
  });
  it("won't start badly out of time after the app was in the background", () => {
    assert.equal(countdownStillOnTime(1_000, 1_200), true);
    assert.equal(countdownStillOnTime(1_000, 5_000), false);
  });
});
