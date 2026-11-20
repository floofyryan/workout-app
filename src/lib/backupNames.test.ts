/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backupFileName, backupsToPrune, parseBackupFileName, WEEK_MS, weeklyBackupDue } from './backupNames';

describe('automatic backup names', () => {
  it('round-trips the time and reason', () => {
    assert.deepEqual(parseBackupFileName(backupFileName(1234, 'before-update')), { ts: 1234, reason: 'before-update' });
    assert.equal(parseBackupFileName('workout-backup-2026-01-01.json'), null);
  });
  it('keeps the newest few of each kind', () => {
    const names = [1, 2, 3, 4, 5, 6].map((t) => backupFileName(t, 'weekly'));
    names.push(backupFileName(0, 'before-update'));
    assert.deepEqual(backupsToPrune(names, 4).sort(), [backupFileName(1, 'weekly'), backupFileName(2, 'weekly')].sort());
  });
  it('is due weekly', () => {
    assert.equal(weeklyBackupDue(null, 0), true);
    assert.equal(weeklyBackupDue(0, WEEK_MS - 1), false);
    assert.equal(weeklyBackupDue(0, WEEK_MS), true);
  });
});
