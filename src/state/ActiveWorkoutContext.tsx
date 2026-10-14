import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Vibration } from 'react-native';

import { getExercisesByIds, getKv, getPreviousSets, markTemplateUsed, saveWorkout, setKv } from '@/db/repo';
import {
  completedExercises,
  fillBlanks,
  holdDuration,
  updateSetIn,
  workoutFromTemplate,
  type ActiveWorkout,
} from '@/lib/activeWorkout';
import { defaultWorkoutName } from '@/lib/format';
import type { Exercise, SetData, Template } from '@/lib/types';
import { useSettings } from './SettingsContext';

const STORAGE_KEY = 'active_workout';

export interface RestTimer {
  endsAt: number;
  duration: number;
}

/** Countdown for a timed set (e.g. a plank); when it ends the set is completed and rest starts. */
export interface SetTimer {
  exerciseKey: string;
  setKey: string;
  startedAt: number;
  endsAt: number;
  duration: number;
}

interface ActiveWorkoutContextValue {
  workout: ActiveWorkout | null;
  /** Exercise metadata for every exercise in the active workout. */
  exercises: Map<number, Exercise>;
  /** Sets from the last time each exercise was performed. */
  previous: Map<number, SetData[]>;
  restTimer: RestTimer | null;
  setTimer: SetTimer | null;
  start: (template?: Template) => void;
  update: (fn: (w: ActiveWorkout) => ActiveWorkout) => void;
  toggleSetComplete: (exerciseKey: string, setKey: string) => void;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSeconds: number) => void;
  stopRest: () => void;
  startSetTimer: (exerciseKey: string, setKey: string) => void;
  adjustSetTimer: (deltaSeconds: number) => void;
  /** Ends the countdown early and records the time held so far. */
  finishSetTimer: () => void;
  cancelSetTimer: () => void;
  /** Saves completed sets. Returns the new workout id, or null if nothing was completed. */
  finish: () => Promise<number | null>;
  discard: () => void;
}

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

export function ActiveWorkoutProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [exercises, setExercises] = useState<Map<number, Exercise>>(new Map());
  const [previous, setPrevious] = useState<Map<number, SetData[]>>(new Map());
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [setTimer, setSetTimer] = useState<SetTimer | null>(null);
  const loaded = useRef(false);
  const workoutRef = useRef<ActiveWorkout | null>(null);
  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);

  // Restore an in-progress workout after the app was closed.
  useEffect(() => {
    getKv(db, STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setWorkout(JSON.parse(raw));
        } catch {
          // Corrupt state: drop it.
        }
      }
      loaded.current = true;
    });
  }, [db]);

  // Persist the active workout (debounced) so it survives the app being killed.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      setKv(db, STORAGE_KEY, workout ? JSON.stringify(workout) : null);
    }, 400);
    return () => clearTimeout(t);
  }, [db, workout]);

  // Load exercise metadata and previous performance for exercises in the workout.
  const exerciseIdsKey = workout?.exercises.map((e) => e.exerciseId).join(',') ?? '';
  useEffect(() => {
    const ids = exerciseIdsKey ? exerciseIdsKey.split(',').map(Number) : [];
    const before = workoutRef.current?.startedAt ?? Date.now();
    let cancelled = false;
    (async () => {
      const map = await getExercisesByIds(db, ids);
      const prev = new Map<number, SetData[]>();
      for (const id of new Set(ids)) prev.set(id, await getPreviousSets(db, id, before));
      if (!cancelled) {
        setExercises(map);
        setPrevious(prev);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, exerciseIdsKey]);

  // Rest timer: buzz when it runs out.
  useEffect(() => {
    if (!restTimer) return;
    const ms = restTimer.endsAt - Date.now();
    const t = setTimeout(() => {
      setRestTimer(null);
      if (settings.vibrateOnRestEnd) Vibration.vibrate([0, 400, 200, 400]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [restTimer, settings.vibrateOnRestEnd]);

  const update = useCallback((fn: (w: ActiveWorkout) => ActiveWorkout) => {
    setWorkout((w) => (w ? fn(w) : w));
  }, []);

  const start = useCallback(
    (template?: Template) => {
      const now = Date.now();
      setRestTimer(null);
      setSetTimer(null);
      if (template) {
        setWorkout(workoutFromTemplate(template, now));
        markTemplateUsed(db, template.id, now);
      } else {
        setWorkout({ name: defaultWorkoutName(now), notes: '', startedAt: now, templateId: null, exercises: [] });
      }
    },
    [db],
  );

  const startRest = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setRestTimer({ endsAt: Date.now() + seconds * 1000, duration: seconds });
  }, []);

  const adjustRest = useCallback((delta: number) => {
    setRestTimer((t) => {
      if (!t) return t;
      const endsAt = t.endsAt + delta * 1000;
      if (endsAt <= Date.now()) return null;
      return { endsAt, duration: Math.max(1, t.duration + delta) };
    });
  }, []);

  const stopRest = useCallback(() => setRestTimer(null), []);

  const restSecondsFor = useCallback(
    (exerciseKey: string) => {
      const ex = workoutRef.current?.exercises.find((e) => e.key === exerciseKey);
      if (!ex) return settings.defaultRestSeconds;
      return ex.restSeconds ?? exercises.get(ex.exerciseId)?.restSeconds ?? settings.defaultRestSeconds;
    },
    [exercises, settings.defaultRestSeconds],
  );

  /** Marks a timed set done with the time held, buzzes, and starts the rest timer. */
  const completeTimedSet = useCallback(
    (timer: SetTimer, seconds: number) => {
      setSetTimer(null);
      const ex = workoutRef.current?.exercises.find((e) => e.key === timer.exerciseKey);
      if (!ex?.sets.some((s) => s.key === timer.setKey)) return;
      update((cur) =>
        updateSetIn(cur, timer.exerciseKey, timer.setKey, { durationS: Math.max(1, Math.round(seconds)), completed: true }),
      );
      if (settings.vibrateOnRestEnd) Vibration.vibrate([0, 300, 150, 300]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      startRest(restSecondsFor(timer.exerciseKey));
    },
    [restSecondsFor, settings.vibrateOnRestEnd, startRest, update],
  );

  // Set timer: complete the set when the countdown reaches zero.
  useEffect(() => {
    if (!setTimer) return;
    const t = setTimeout(() => completeTimedSet(setTimer, setTimer.duration), Math.max(0, setTimer.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [setTimer, completeTimedSet]);

  const startSetTimer = useCallback(
    (exerciseKey: string, setKey: string) => {
      const ex = workoutRef.current?.exercises.find((e) => e.key === exerciseKey);
      const idx = ex?.sets.findIndex((s) => s.key === setKey) ?? -1;
      if (!ex || idx < 0) return;
      const duration = holdDuration(ex, idx, previous.get(ex.exerciseId));
      const now = Date.now();
      setRestTimer(null);
      setSetTimer({ exerciseKey, setKey, startedAt: now, endsAt: now + duration * 1000, duration });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [previous],
  );

  const adjustSetTimer = useCallback((delta: number) => {
    setSetTimer((t) => {
      if (!t) return t;
      const duration = Math.max(1, t.duration + delta);
      return { ...t, duration, endsAt: t.startedAt + duration * 1000 };
    });
  }, []);

  const finishSetTimer = useCallback(() => {
    if (setTimer) completeTimedSet(setTimer, Math.min(setTimer.duration, (Date.now() - setTimer.startedAt) / 1000));
  }, [setTimer, completeTimedSet]);

  const cancelSetTimer = useCallback(() => setSetTimer(null), []);

  const toggleSetComplete = useCallback(
    (exerciseKey: string, setKey: string) => {
      const w = workoutRef.current;
      const ex = w?.exercises.find((e) => e.key === exerciseKey);
      const idx = ex?.sets.findIndex((s) => s.key === setKey) ?? -1;
      if (!ex || idx < 0) return;
      // Ticking a set that is being timed ends the countdown early.
      if (setTimer?.setKey === setKey) return finishSetTimer();
      const set = ex.sets[idx];
      const completing = !set.completed;
      const prevSets = previous.get(ex.exerciseId) ?? [];
      // Blank fields take last session's value for this set, then the set above's.
      const nextSet = completing
        ? { ...fillBlanks(fillBlanks(set, prevSets[idx]), ex.sets[idx - 1]), completed: true }
        : { ...set, completed: false };
      update((cur) => updateSetIn(cur, exerciseKey, setKey, nextSet));
      if (completing) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        startRest(restSecondsFor(exerciseKey));
      }
    },
    [finishSetTimer, previous, restSecondsFor, setTimer, startRest, update],
  );

  const discard = useCallback(() => {
    setWorkout(null);
    setRestTimer(null);
    setSetTimer(null);
  }, []);

  const finish = useCallback(async () => {
    const w = workoutRef.current;
    if (!w) return null;
    const done = completedExercises(w);
    if (done.length === 0) return null;
    const id = await saveWorkout(db, null, {
      name: w.name.trim() || defaultWorkoutName(w.startedAt),
      notes: w.notes,
      startedAt: w.startedAt,
      endedAt: Date.now(),
      templateId: w.templateId,
      exercises: done,
    });
    discard();
    return id;
  }, [db, discard]);

  const value = useMemo<ActiveWorkoutContextValue>(
    () => ({
      workout,
      exercises,
      previous,
      restTimer,
      setTimer,
      start,
      update,
      toggleSetComplete,
      startRest,
      adjustRest,
      stopRest,
      startSetTimer,
      adjustSetTimer,
      finishSetTimer,
      cancelSetTimer,
      finish,
      discard,
    }),
    [
      workout,
      exercises,
      previous,
      restTimer,
      setTimer,
      start,
      update,
      toggleSetComplete,
      startRest,
      adjustRest,
      stopRest,
      startSetTimer,
      adjustSetTimer,
      finishSetTimer,
      cancelSetTimer,
      finish,
      discard,
    ],
  );

  return <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>;
}

export function useActiveWorkout() {
  const ctx = useContext(ActiveWorkoutContext);
  if (!ctx) throw new Error('useActiveWorkout must be used inside ActiveWorkoutProvider');
  return ctx;
}
