import type { SetData, Template, TemplateExercise } from './types';

export interface ActiveSet extends SetData {
  key: string;
  completed: boolean;
}

export interface ActiveExercise {
  key: string;
  exerciseId: number;
  notes: string;
  restSeconds: number | null;
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  name: string;
  notes: string;
  startedAt: number;
  templateId: number | null;
  exercises: ActiveExercise[];
}

let counter = 0;
export function newKey(): string {
  counter = (counter + 1) % 1e9;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function emptySet(): SetData {
  return { setType: 'normal', weight: null, reps: null, durationS: null, distanceM: null, rpe: null };
}

export function newActiveSet(base?: Partial<SetData>): ActiveSet {
  return { ...emptySet(), ...base, key: newKey(), completed: false };
}

export function newActiveExercise(exerciseId: number, setCount = 1, restSeconds: number | null = null): ActiveExercise {
  return {
    key: newKey(),
    exerciseId,
    notes: '',
    restSeconds,
    sets: Array.from({ length: setCount }, () => newActiveSet()),
  };
}

export function workoutFromTemplate(template: Template, startedAt: number): ActiveWorkout {
  return {
    name: template.name,
    notes: '',
    startedAt,
    templateId: template.id,
    exercises: template.exercises.map((te) => ({
      key: newKey(),
      exerciseId: te.exerciseId,
      notes: te.notes,
      restSeconds: te.restSeconds,
      sets: (te.sets.length ? te.sets : [emptySet()]).map((s) => newActiveSet(s)),
    })),
  };
}

/** Fills blank fields of a set with the values from the matching previous set. */
export function fillBlanks(set: ActiveSet, previous: SetData | undefined): ActiveSet {
  if (!previous) return set;
  return {
    ...set,
    weight: set.weight ?? previous.weight,
    reps: set.reps ?? previous.reps,
    durationS: set.durationS ?? previous.durationS,
    distanceM: set.distanceM ?? previous.distanceM,
  };
}

function hasValues(s: SetData): boolean {
  return s.weight != null || s.reps != null || s.durationS != null || s.distanceM != null;
}

/** Completed sets only, dropping exercises with nothing completed. */
export function completedExercises(w: ActiveWorkout) {
  return w.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets.filter((s) => s.completed && hasValues(s)).map(stripActive),
    }))
    .filter((e) => e.sets.length > 0);
}

export function countIncompleteSets(w: ActiveWorkout): number {
  return w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
}

export function stripActive(s: ActiveSet): SetData {
  return {
    setType: s.setType,
    weight: s.weight,
    reps: s.reps,
    durationS: s.durationS,
    distanceM: s.distanceM,
    rpe: s.rpe,
  };
}

/** Template contents reflecting what was actually done in a workout. */
export function templateExercisesFromWorkout(w: ActiveWorkout): TemplateExercise[] {
  return w.exercises
    .filter((e) => e.sets.length > 0)
    .map((e) => ({
      exerciseId: e.exerciseId,
      restSeconds: e.restSeconds,
      notes: e.notes,
      sets: e.sets.map(stripActive),
    }));
}

/** True when the exercises or set counts differ from the template the workout started from. */
export function differsFromTemplate(w: ActiveWorkout, t: Template): boolean {
  if (w.exercises.length !== t.exercises.length) return true;
  return w.exercises.some((e, i) => {
    const te = t.exercises[i];
    return e.exerciseId !== te.exerciseId || e.sets.length !== te.sets.length;
  });
}

// ---------- Pure editing operations (shared by the live workout, history editor and template editor) ----------

type Ex = ActiveExercise;

function mapExercise(w: ActiveWorkout, key: string, fn: (e: Ex) => Ex): ActiveWorkout {
  return { ...w, exercises: w.exercises.map((e) => (e.key === key ? fn(e) : e)) };
}

export function addExercisesTo(w: ActiveWorkout, ids: number[], completed = false): ActiveWorkout {
  const added = ids.map((id) => {
    const e = newActiveExercise(id);
    return { ...e, sets: e.sets.map((s) => ({ ...s, completed })) };
  });
  return { ...w, exercises: [...w.exercises, ...added] };
}

export function replaceExerciseIn(w: ActiveWorkout, key: string, exerciseId: number): ActiveWorkout {
  return mapExercise(w, key, (e) => ({
    ...e,
    exerciseId,
    sets: e.sets.map((s) => ({ ...emptySet(), setType: s.setType, key: s.key, completed: false })),
  }));
}

export function removeExerciseFrom(w: ActiveWorkout, key: string): ActiveWorkout {
  return { ...w, exercises: w.exercises.filter((e) => e.key !== key) };
}

export function moveExerciseIn(w: ActiveWorkout, key: string, delta: -1 | 1): ActiveWorkout {
  const i = w.exercises.findIndex((e) => e.key === key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= w.exercises.length) return w;
  const list = [...w.exercises];
  [list[i], list[j]] = [list[j], list[i]];
  return { ...w, exercises: list };
}

/** Appends a set that copies the last set's values. */
export function addSetTo(w: ActiveWorkout, exerciseKey: string, completed = false): ActiveWorkout {
  return mapExercise(w, exerciseKey, (e) => {
    const last = e.sets[e.sets.length - 1];
    const base = last
      ? { weight: last.weight, reps: last.reps, durationS: last.durationS, distanceM: last.distanceM }
      : {};
    return { ...e, sets: [...e.sets, { ...newActiveSet(base), completed }] };
  });
}

export function insertSetsAtStart(w: ActiveWorkout, exerciseKey: string, sets: Partial<SetData>[]): ActiveWorkout {
  return mapExercise(w, exerciseKey, (e) => ({ ...e, sets: [...sets.map((s) => newActiveSet(s)), ...e.sets] }));
}

export function removeSetFrom(w: ActiveWorkout, exerciseKey: string, setKey: string): ActiveWorkout {
  return mapExercise(w, exerciseKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) }));
}

export function updateSetIn(
  w: ActiveWorkout,
  exerciseKey: string,
  setKey: string,
  patch: Partial<ActiveSet>,
): ActiveWorkout {
  return mapExercise(w, exerciseKey, (e) => ({
    ...e,
    sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
  }));
}

export function updateExerciseIn(w: ActiveWorkout, key: string, patch: Partial<Omit<Ex, 'key' | 'sets'>>): ActiveWorkout {
  return mapExercise(w, key, (e) => ({ ...e, ...patch }));
}

export const DEFAULT_HOLD_SECONDS = 60;

/**
 * Countdown length for a timed set: its own target, else last session's time for that set,
 * else the set above's, else one minute.
 */
export function holdDuration(ex: ActiveExercise, setIndex: number, previous: SetData[] = []): number {
  return (
    ex.sets[setIndex]?.durationS ??
    previous[setIndex]?.durationS ??
    ex.sets[setIndex - 1]?.durationS ??
    DEFAULT_HOLD_SECONDS
  );
}
