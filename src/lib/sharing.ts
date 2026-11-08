// Share-sheet and file-picker flows for shared templates and programs (the format is in db/share).
import type { SQLiteDatabase } from 'expo-sqlite';

import { exportProgram, exportTemplate, importShared, type ShareImportResult } from '@/db/share';
import { pickTextFile, shareTextFile } from './files';

/** A file name from a template or program name, e.g. "Push Day.workout.json". */
export function sharedFileName(name: string, kind: 'workout' | 'program'): string {
  // Drop characters that aren't allowed in file names on some systems.
  const base = name.replace(/[\\/:*?"<>|]+/g, '').trim() || kind;
  return `${base}.${kind}.json`;
}

export async function shareTemplate(db: SQLiteDatabase, id: number, name: string) {
  const json = await exportTemplate(db, id);
  if (json) await shareTextFile(sharedFileName(name, 'workout'), json, 'application/json');
}

export async function shareProgram(db: SQLiteDatabase, id: number, name: string) {
  const json = await exportProgram(db, id);
  if (json) await shareTextFile(sharedFileName(name, 'program'), json, 'application/json');
}

/** Lets the user pick a shared file and imports it. Null when they cancel. */
export async function pickAndImportShared(db: SQLiteDatabase): Promise<ShareImportResult | null> {
  const text = await pickTextFile(['application/json', '*/*']);
  return text == null ? null : importShared(db, text);
}

/** E.g. 'Added the program "Upper / Lower" (4 workouts).' */
export function describeImport(r: ShareImportResult): string {
  const n = r.templateIds.length;
  const what =
    r.programId != null ? `the program "${r.name}" (${n} workout${n === 1 ? '' : 's'})` : `the template "${r.name}"`;
  const created = r.exercisesCreated
    ? ` ${r.exercisesCreated} exercise${r.exercisesCreated === 1 ? '' : 's'} you didn't have ${r.exercisesCreated === 1 ? 'was' : 'were'} added too.`
    : '';
  return `Added ${what}.${created}`;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
