import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getExercisesByIds } from '@/db/repo';
import type { Exercise } from './types';

/**
 * Runs an async query whenever the screen gains focus (so data is fresh after navigating back)
 * and whenever `deps` change. Returns [data, reload].
 */
export function useFocusQuery<T>(
  query: (db: SQLiteDatabase) => Promise<T>,
  deps: unknown[] = [],
): [T | undefined, () => void] {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>();
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  });

  const depsKey = JSON.stringify(deps);
  const load = useCallback(() => {
    let active = true;
    queryRef.current(db).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
    // depsKey re-creates the callback (and re-runs the query) when deps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, depsKey]);

  useFocusEffect(load);
  return [data, load];
}

/** Exercise metadata for a set of ids. */
export function useExerciseMap(ids: number[]): Map<number, Exercise> {
  const db = useSQLiteContext();
  const [map, setMap] = useState<Map<number, Exercise>>(new Map());
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    let active = true;
    getExercisesByIds(db, key ? key.split(',').map(Number) : []).then((m) => {
      if (active) setMap(m);
    });
    return () => {
      active = false;
    };
  }, [db, key]);
  return map;
}

/** Re-renders every `intervalMs` and returns Date.now(). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
