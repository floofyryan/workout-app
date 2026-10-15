import * as Haptics from 'expo-haptics';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
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
  shouldRestAfter,
  holdDuration,
  updateSetIn,
  workoutFromTemplate,
  type ActiveWorkout,
} from '@/lib/activeWorkout';
import { defaultWorkoutName } from '@/lib/format';
import { cancelTimerNotification, scheduleTimerNotification } from '@/lib/timerNotifications';
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
  /** Re-reads the in-progress workout from the database (e.g. after restoring a backup). */
  reloadFromStorage: () => Promise<void>;
}

async function readStoredWorkout(db: SQLiteDatabase): Promise<ActiveWorkout | null> {
  const raw = await getKv(db, STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null; // Corrupt state: drop it.
  }
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
    readStoredWorkout(db).then((w) => {
      setWorkout(w);
      loaded.current = true;
    });
  }, [db]);

  const reloadFromStorage = useCallback(async () => {
    loaded.current = false;
    setWorkout(await readStoredWorkout(db));
    loaded.current = true;
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

  // ---------- Background notifications for the timers ----------
  // Rest: { endsAt, id }. Hold: the hold-finished notification's id.
  const restNotif = useRef<{ endsAt: number; id: Promise<string | null> } | null>(null);
  const holdNotif = useRef<Promise<string | null> | null>(null);
  const notificationsOn = settings.timerNotifications;

  const cancelRestNotification = useCallback(() => {
    cancelTimerNotification(restNotif.current?.id);
    restNotif.current = null;
  }, []);
  const cancelHoldNotification = useCallback(() => {
    cancelTimerNotification(holdNotif.current);
    holdNotif.current = null;
  }, []);
  // Rest timer: buzz when it runs out. If the app was in the background when it ended (the
  // timeout fires late), the scheduled notification already buzzed, so don't buzz again.
  useEffect(() => {
    if (!restTimer) return;
    const ms = restTimer.endsAt - Date.now();
    const t = setTimeout(() => {
      setRestTimer(null);
      restNotif.current = null;
      if (Date.now() - restTimer.endsAt > 2000) return;
      if (settings.vibrateOnRestEnd) Vibration.vibrate([0, 400, 200, 400]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [restTimer, settings.vibrateOnRestEnd]);

  /** Schedules the "rest over" notification, keeping one already scheduled for the same moment. */
  const scheduleRestNotification = useCallback(
    (endsAt: number) => {
      if (restNotif.current?.endsAt === endsAt) return;
      cancelRestNotification();
      if (!notificationsOn) return;
      restNotif.current = { endsAt, id: scheduleTimerNotification(endsAt, 'Rest over', 'Time for your next set.') };
    },
    [cancelRestNotification, notificationsOn],
  );

  const update = useCallback((fn: (w: ActiveWorkout) => ActiveWorkout) => {
    setWorkout((w) => (w ? fn(w) : w));
  }, []);

  const start = useCallback(
    (template?: Template) => {
      const now = Date.now();
      setRestTimer(null);
      setSetTimer(null);
      cancelRestNotification();
      cancelHoldNotification();
      if (template) {
        setWorkout(workoutFromTemplate(template, now));
        markTemplateUsed(db, template.id, now);
      } else {
        setWorkout({ name: defaultWorkoutName(now), notes: '', startedAt: now, templateId: null, exercises: [] });
      }
    },
    [db, cancelHoldNotification, cancelRestNotification],
  );

  const restTimerRef = useRef<RestTimer | null>(null);
  useEffect(() => {
    restTimerRef.current = restTimer;
  }, [restTimer]);

  /** Starts a rest of `seconds`, counted from `from` (defaults to now). */
  const startRest = useCallback(
    (seconds: number, from = Date.now()) => {
      if (seconds <= 0) return;
      const endsAt = from + seconds * 1000;
      if (endsAt <= Date.now()) return;
      setRestTimer({ endsAt, duration: seconds });
      scheduleRestNotification(endsAt);
    },
    [scheduleRestNotification],
  );

  const adjustRest = useCallback(
    (delta: number) => {
      const t = restTimerRef.current;
      if (!t) return;
      const endsAt = t.endsAt + delta * 1000;
      if (endsAt <= Date.now()) {
        setRestTimer(null);
        cancelRestNotification();
        return;
      }
      setRestTimer({ endsAt, duration: Math.max(1, t.duration + delta) });
      scheduleRestNotification(endsAt);
    },
    [cancelRestNotification, scheduleRestNotification],
  );

  const stopRest = useCallback(() => {
    setRestTimer(null);
    cancelRestNotification();
  }, [cancelRestNotification]);

  const restSecondsFor = useCallback(
    (exerciseKey: string) => {
      const ex = workoutRef.current?.exercises.find((e) => e.key === exerciseKey);
      if (!ex) return settings.defaultRestSeconds;
      return ex.restSeconds ?? exercises.get(ex.exerciseId)?.restSeconds ?? settings.defaultRestSeconds;
    },
    [exercises, settings.defaultRestSeconds],
  );

  /**
   * Marks a timed set done with the time held, buzzes, and starts the rest timer. When the
   * countdown ran out (`natural`), rest is counted from the moment it ended, so it lines up with
   * the notifications even if the app was in the background.
   */
  const completeTimedSet = useCallback(
    (timer: SetTimer, seconds: number, natural: boolean) => {
      setSetTimer(null);
      cancelHoldNotification();
      const ex = workoutRef.current?.exercises.find((e) => e.key === timer.exerciseKey);
      if (!ex?.sets.some((s) => s.key === timer.setKey)) {
        cancelRestNotification();
        return;
      }
      update((cur) =>
        updateSetIn(cur, timer.exerciseKey, timer.setKey, { durationS: Math.max(1, Math.round(seconds)), completed: true }),
      );
      if (!natural || Date.now() - timer.endsAt < 2000) {
        if (settings.vibrateOnRestEnd) Vibration.vibrate([0, 300, 150, 300]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (shouldRestAfter(workoutRef.current, timer.exerciseKey)) {
        startRest(restSecondsFor(timer.exerciseKey), natural ? timer.endsAt : Date.now());
      } else {
        cancelRestNotification();
      }
    },
    [cancelHoldNotification, cancelRestNotification, restSecondsFor, settings.vibrateOnRestEnd, startRest, update],
  );

  /** Schedules the hold-finished notification and the rest-over one that follows it. */
  const scheduleHoldNotifications = useCallback(
    (timer: SetTimer) => {
      cancelHoldNotification();
      cancelRestNotification();
      if (!notificationsOn) return;
      const ex = workoutRef.current?.exercises.find((e) => e.key === timer.exerciseKey);
      const name = (ex && exercises.get(ex.exerciseId)?.name) ?? 'Hold';
      holdNotif.current = scheduleTimerNotification(timer.endsAt, `${name} done`, 'Nice hold! Rest timer started.');
      if (shouldRestAfter(workoutRef.current, timer.exerciseKey)) {
        const rest = restSecondsFor(timer.exerciseKey);
        if (rest > 0) scheduleRestNotification(timer.endsAt + rest * 1000);
      }
    },
    [cancelHoldNotification, cancelRestNotification, exercises, notificationsOn, restSecondsFor, scheduleRestNotification],
  );

  // Set timer: complete the set when the countdown reaches zero.
  useEffect(() => {
    if (!setTimer) return;
    const t = setTimeout(() => completeTimedSet(setTimer, setTimer.duration, true), Math.max(0, setTimer.endsAt - Date.now()));
    return () => clearTimeout(t);
  }, [setTimer, completeTimedSet]);

  const startSetTimer = useCallback(
    (exerciseKey: string, setKey: string) => {
      const ex = workoutRef.current?.exercises.find((e) => e.key === exerciseKey);
      const idx = ex?.sets.findIndex((s) => s.key === setKey) ?? -1;
      if (!ex || idx < 0) return;
      const duration = holdDuration(ex, idx, previous.get(ex.exerciseId));
      const now = Date.now();
      const timer = { exerciseKey, setKey, startedAt: now, endsAt: now + duration * 1000, duration };
      setRestTimer(null);
      setSetTimer(timer);
      scheduleHoldNotifications(timer);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [previous, scheduleHoldNotifications],
  );

  const adjustSetTimer = useCallback(
    (delta: number) => {
      const t = setTimer;
      if (!t) return;
      const duration = Math.max(1, t.duration + delta);
      const next = { ...t, duration, endsAt: t.startedAt + duration * 1000 };
      setSetTimer(next);
      scheduleHoldNotifications(next);
    },
    [setTimer, scheduleHoldNotifications],
  );

  const finishSetTimer = useCallback(() => {
    if (setTimer) completeTimedSet(setTimer, Math.min(setTimer.duration, (Date.now() - setTimer.startedAt) / 1000), false);
  }, [setTimer, completeTimedSet]);

  const cancelSetTimer = useCallback(() => {
    setSetTimer(null);
    cancelHoldNotification();
    cancelRestNotification();
  }, [cancelHoldNotification, cancelRestNotification]);

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
        // In a superset, rest only after the last exercise of the round.
        if (shouldRestAfter(w, exerciseKey)) startRest(restSecondsFor(exerciseKey));
      }
    },
    [finishSetTimer, previous, restSecondsFor, setTimer, startRest, update],
  );

  const discard = useCallback(() => {
    setWorkout(null);
    setRestTimer(null);
    setSetTimer(null);
    cancelRestNotification();
    cancelHoldNotification();
  }, [cancelHoldNotification, cancelRestNotification]);

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
      reloadFromStorage,
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
      reloadFromStorage,
    ],
  );

  return <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>;
}

export function useActiveWorkout() {
  const ctx = useContext(ActiveWorkoutContext);
  if (!ctx) throw new Error('useActiveWorkout must be used inside ActiveWorkoutProvider');
  return ctx;
}
