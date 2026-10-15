/// <reference types="node" />
// In-memory SQLite for unit tests, using Node's built-in node:sqlite behind the small part of
// expo-sqlite's SQLiteDatabase API that the app uses. Not imported by the app itself.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = unknown[];

/** expo-sqlite accepts variadic values, one array, or one object of named values. */
function bind(params: Params): SQLInputValue[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0] as SQLInputValue[];
  return params as SQLInputValue[];
}

export function openTestDb(): SQLiteDatabase & { close(): void } {
  const raw = new DatabaseSync(':memory:');
  const run = (sql: string, params: Params) => {
    const r = raw.prepare(sql).run(...bind(params));
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
  };
  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: Params) => run(sql, params),
    getFirstAsync: async (sql: string, ...params: Params) => raw.prepare(sql).get(...bind(params)) ?? null,
    getAllAsync: async (sql: string, ...params: Params) => raw.prepare(sql).all(...bind(params)),
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    prepareAsync: async (sql: string) => {
      const statement = raw.prepare(sql);
      return {
        executeAsync: async (...params: Params) => {
          const r = statement.run(...bind(params));
          return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
        },
        finalizeAsync: async () => {},
      };
    },
    close: () => raw.close(),
  };
  return db as unknown as SQLiteDatabase & { close(): void };
}
