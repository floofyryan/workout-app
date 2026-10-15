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
  /** Consecutive exercises sharing an id are done as a superset (no rest between them). */
  supersetId?: string | null;
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

/** Turns stored superset group numbers into in-memory superset ids. */
export function supersetIdsFromGroups(groups: (number | null | undefined)[]): (string | null)[] {
  const ids = new Map<number, string>();
  return groups.map((g) => {
    if (g == null) return null;
    if (!ids.has(g)) ids.set(g, newKey());
    return ids.get(g)!;
  });
}

/** Turns superset ids into group numbers (1, 2, …) for storage; lone members get null. */
export function supersetGroupsFromIds(ids: (string | null | undefined)[]): (number | null)[] {
  const counts = new Map<string, number>();
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  const numbers = new Map<string, number>();
  return ids.map((id) => {
    if (!id || (counts.get(id) ?? 0) < 2) return null;
    if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    return numbers.get(id)!;
  });
}

export function workoutFromTemplate(template: Template, startedAt: number): ActiveWorkout {
  const supersetIds = supersetIdsFromGroups(template.exercises.map((te) => te.supersetGroup));
  return {
    name: template.name,
    notes: '',
    startedAt,
    templateId: template.id,
    exercises: template.exercises.map((te, i) => ({
      key: newKey(),
      exerciseId: te.exerciseId,
      notes: te.notes,
      restSeconds: te.restSeconds,
      sets: (te.sets.length ? te.sets : [emptySet()]).map((s) => newActiveSet(s)),
      supersetId: supersetIds[i],
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
  const done = w.exercises
    .map((e) => ({
      exerciseId: e.exerciseId,
      notes: e.notes,
      supersetId: e.supersetId,
      sets: e.sets.filter((s) => s.completed && hasValues(s)).map(stripActive),
    }))
    .filter((e) => e.sets.length > 0);
  const groups = supersetGroupsFromIds(done.map((e) => e.supersetId));
  return done.map(({ supersetId: _, ...e }, i) => ({ ...e, supersetGroup: groups[i] }));
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
  const kept = w.exercises.filter((e) => e.sets.length > 0);
  const groups = supersetGroupsFromIds(kept.map((e) => e.supersetId));
  return kept.map((e, i) => ({
    exerciseId: e.exerciseId,
    restSeconds: e.restSeconds,
    notes: e.notes,
    sets: e.sets.map(stripActive),
    supersetGroup: groups[i],
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
  return normalizeSupersets({ ...w, exercises: w.exercises.filter((e) => e.key !== key) });
}

export function moveExerciseIn(w: ActiveWorkout, key: string, delta: -1 | 1): ActiveWorkout {
  const i = w.exercises.findIndex((e) => e.key === key);
  return moveExerciseTo(w, key, i + delta);
}

/** Moves an exercise to a new position (used by drag-to-reorder). */
export function moveExerciseTo(w: ActiveWorkout, key: string, to: number): ActiveWorkout {
  const from = w.exercises.findIndex((e) => e.key === key);
  if (from < 0 || to < 0 || to >= w.exercises.length || to === from) return w;
  const list = [...w.exercises];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return normalizeSupersets({ ...w, exercises: list });
}

// ---------- Supersets ----------

/** Clears superset ids that no longer have a neighbour in the same superset. */
export function normalizeSupersets(w: ActiveWorkout): ActiveWorkout {
  const ex = w.exercises;
  let changed = false;
  const exercises = ex.map((e, i) => {
    if (!e.supersetId) return e;
    const linked = ex[i - 1]?.supersetId === e.supersetId || ex[i + 1]?.supersetId === e.supersetId;
    if (linked) return e;
    changed = true;
    return { ...e, supersetId: null };
  });
  return changed ? { ...w, exercises } : w;
}

/** Joins an exercise and the one after it into a superset (merging existing supersets). */
export function supersetWithNext(w: ActiveWorkout, key: string): ActiveWorkout {
  const i = w.exercises.findIndex((e) => e.key === key);
  const cur = w.exercises[i];
  const next = w.exercises[i + 1];
  if (!cur || !next) return w;
  const id = cur.supersetId ?? next.supersetId ?? newKey();
  const merge = new Set([cur.supersetId, next.supersetId].filter(Boolean));
  return {
    ...w,
    exercises: w.exercises.map((e, j) =>
      j === i || j === i + 1 || (e.supersetId && merge.has(e.supersetId)) ? { ...e, supersetId: id } : e,
    ),
  };
}

/** Takes an exercise out of its superset. */
export function leaveSuperset(w: ActiveWorkout, key: string): ActiveWorkout {
  const i = w.exercises.findIndex((e) => e.key === key);
  const id = w.exercises[i]?.supersetId;
  if (!id) return w;
  // Leaving from the middle splits the superset in two.
  const after = newKey();
  return normalizeSupersets({
    ...w,
    exercises: w.exercises.map((e, j) => {
      if (j === i) return { ...e, supersetId: null };
      if (j > i && e.supersetId === id) return { ...e, supersetId: after };
      return e;
    }),
  });
}

/** Whether to start the rest timer after a set of this exercise: not mid-way through a superset round. */
export function shouldRestAfter(w: ActiveWorkout | null, exerciseKey: string): boolean {
  if (!w) return true;
  const i = w.exercises.findIndex((e) => e.key === exerciseKey);
  const id = w.exercises[i]?.supersetId;
  return !id || w.exercises[i + 1]?.supersetId !== id;
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

/** Puts exercises in the given key order (used by the reorder sheet). */
export function reorderExercises(w: ActiveWorkout, keys: string[]): ActiveWorkout {
  const byKey = new Map(w.exercises.map((e) => [e.key, e]));
  const ordered = keys.map((k) => byKey.get(k)).filter((e): e is ActiveExercise => !!e);
  // Keep anything not mentioned (shouldn't happen) at the end.
  const rest = w.exercises.filter((e) => !keys.includes(e.key));
  return normalizeSupersets({ ...w, exercises: [...ordered, ...rest] });
}
