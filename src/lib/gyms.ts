// Gym profiles: which equipment is at hand, and finding stand-ins for an exercise. Pure logic.
import { EQUIPMENT, exerciseCategory, type Equipment, type Exercise, type Gym, type Settings } from './types';

/** Needs nothing in particular (bodyweight moves, stretches, odds and ends), so always available. */
export const ALWAYS_AVAILABLE: readonly Equipment[] = ['Bodyweight', 'Other'];

/** Equipment a gym can choose from (the always-available kinds aren't a choice). */
export const GYM_EQUIPMENT = EQUIPMENT.filter((e) => !ALWAYS_AVAILABLE.includes(e));

export const GYM_PRESETS: { name: string; equipment: Equipment[] }[] = [
  { name: 'Full gym', equipment: [...GYM_EQUIPMENT] },
  { name: 'Dumbbells at home', equipment: ['Dumbbell', 'Band'] },
  { name: 'Bodyweight only', equipment: [] },
];

/** The gym currently in use, if any. */
export function activeGym(settings: Pick<Settings, 'gyms' | 'activeGymId'>): Gym | null {
  return settings.gyms.find((g) => g.id === settings.activeGymId) ?? null;
}

/** Whether an exercise can be done with a gym's equipment (anything goes without a gym). */
export function availableIn(gym: Gym | null | undefined, e: Pick<Exercise, 'equipment'>): boolean {
  return !gym || ALWAYS_AVAILABLE.includes(e.equipment) || gym.equipment.includes(e.equipment);
}

/**
 * Stand-ins for an exercise: the same kind of exercise working the same main muscle (or, without
 * muscle data, the same body part), that the gym has the equipment for. The ones you've done most
 * come first, then those sharing the most muscles. "Other" gear (chains, medicine balls…) passes the
 * gym check so that stretches aren't hidden, but you may well not have it, so it goes last.
 */
export function similarExercises(
  target: Exercise,
  all: Exercise[],
  gym: Gym | null,
  useCounts: Map<number, number>,
  limit = 8,
): Exercise[] {
  const muscle = target.primaryMuscles[0];
  const kind = exerciseCategory(target);
  const targetMuscles = new Set([...target.primaryMuscles, ...target.secondaryMuscles]);
  const shared = (e: Exercise) => [...e.primaryMuscles, ...e.secondaryMuscles].filter((m) => targetMuscles.has(m)).length;
  return all
    .filter(
      (e) =>
        e.id !== target.id &&
        !e.archived &&
        exerciseCategory(e) === kind &&
        availableIn(gym, e) &&
        (muscle ? e.primaryMuscles[0] === muscle : e.bodyPart === target.bodyPart),
    )
    .map((e) => ({ e, used: useCounts.get(e.id) ?? 0, odd: e.equipment === 'Other' ? 1 : 0, shared: shared(e) }))
    .sort((a, b) => b.used - a.used || a.odd - b.odd || b.shared - a.shared || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e);
}
