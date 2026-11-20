import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  backupFileName,
  backupsToPrune,
  parseBackupFileName,
  weeklyBackupDue,
  type BackupReason,
} from './backupNames';

// Automatic backups (the same JSON as Settings → Back up) kept in the app's own storage: one before
// any database upgrade and one a week. They can be restored or shared from Settings.

export interface AutoBackup {
  name: string;
  ts: number;
  reason: BackupReason;
  file: File;
}

function folder(): Directory | null {
  if (Platform.OS === 'web') return null;
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

export function listAutoBackups(): AutoBackup[] {
  try {
    const dir = folder();
    if (!dir) return [];
    return dir
      .list()
      .filter((f): f is File => f instanceof File)
      .flatMap((file) => {
        const info = parseBackupFileName(file.name);
        return info ? [{ name: file.name, ...info, file }] : [];
      })
      .sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/** Saves a backup and removes the oldest ones beyond the limit. Never throws. */
export function saveAutoBackup(json: string, reason: BackupReason, now = Date.now()) {
  try {
    const dir = folder();
    if (!dir) return;
    const file = new File(dir, backupFileName(now, reason));
    if (!file.exists) file.create();
    file.write(json);
    const prune = new Set(backupsToPrune(listAutoBackups().map((b) => b.name)));
    for (const b of listAutoBackups()) if (prune.has(b.name)) b.file.delete();
  } catch {
    // A failed backup must never stop the app from starting.
  }
}

/** Saves this week's backup if the last weekly one is a week old (or there is none). */
export async function weeklyBackupIfDue(makeBackup: () => Promise<string>) {
  const newest = listAutoBackups().find((b) => b.reason === 'weekly');
  if (!weeklyBackupDue(newest?.ts ?? null, Date.now())) return;
  try {
    saveAutoBackup(await makeBackup(), 'weekly');
  } catch {
    // Try again next launch.
  }
}
