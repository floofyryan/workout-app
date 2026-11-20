// Naming and pruning rules for automatic backups. Kept free of native imports so they can be
// unit tested; the file handling lives in autoBackup.ts.

export type BackupReason = 'weekly' | 'before-update' | 'before-restore';

export const BACKUP_REASON_LABELS: Record<BackupReason, string> = {
  weekly: 'Weekly backup',
  'before-update': 'Before an app update',
  'before-restore': 'Before restoring a backup',
};

/** How many automatic backups of each kind to keep. */
export const KEEP_PER_REASON = 4;

export const WEEK_MS = 7 * 86_400_000;

export function backupFileName(ts: number, reason: BackupReason): string {
  return `auto-${ts}-${reason}.json`;
}

export function parseBackupFileName(name: string): { ts: number; reason: BackupReason } | null {
  const m = /^auto-(\d+)-(weekly|before-update|before-restore)\.json$/.exec(name);
  return m ? { ts: Number(m[1]), reason: m[2] as BackupReason } : null;
}

/** Names of old backups to delete so only the newest few of each kind remain. */
export function backupsToPrune(names: string[], keep = KEEP_PER_REASON): string[] {
  const parsed = names
    .map((name) => ({ name, info: parseBackupFileName(name) }))
    .filter((b): b is { name: string; info: { ts: number; reason: BackupReason } } => b.info != null)
    .sort((a, b) => b.info.ts - a.info.ts);
  const seen: Record<string, number> = {};
  return parsed
    .filter((b) => {
      seen[b.info.reason] = (seen[b.info.reason] ?? 0) + 1;
      return seen[b.info.reason] > keep;
    })
    .map((b) => b.name);
}

/** Whether a weekly backup is due, given the newest one's time (null when there is none). */
export function weeklyBackupDue(newest: number | null, now: number): boolean {
  return newest == null || now - newest >= WEEK_MS;
}
