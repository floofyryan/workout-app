// Builds a workout from what's recovered: picks a split whose muscles are freshest, then exercises
// for each body part that the gym has the equipment for, favouring ones you already do. Pure.
import { usesWeight } from './calc';
import { muscleBodyPart } from './freeExerciseDb';
import { availableIn } from './gyms';
import type { PartRecovery } from './recovery';
import { exerciseCategory, type BodyPart, type Exercise, type Gym, type SetData } from './types';

export type Split = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';
export type Focus = 'auto' | Split;

/** In order of preference when several are equally fresh. */
export const SPLITS: Split[] = ['full', 'upper', 'lower', 'push', 'pull', 'legs'];

export const SPLIT_PARTS: Record<Split, BodyPart[]> = {
  full: ['Quads', 'Chest', 'Back', 'Hamstrings', 'Shoulders', 'Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'],
  push: ['Chest', 'Shoulders', 'Triceps'],
  pull: ['Back', 'Biceps'],
  legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
};

export const FOCUS_LABELS: Record<Focus, string> = {
  auto: 'Best for today',
  full: 'Full body',
  upper: 'Upper body',
  lower: 'Lower body',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
};

const WORKOUT_NAMES: Record<Split, string> = {
  full: 'Full Body',
  upper: 'Upper Body',
  lower: 'Lower Body',
  push: 'Push Day',
  pull: 'Pull Day',
  legs: 'Leg Day',
};

const BIG: readonly BodyPart[] = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes'];
const isBig = (p: BodyPart) => BIG.includes(p);

/** How fresh a split's muscles are on average (big muscles count double). */
export function splitFreshness(split: Split, recovery: Map<BodyPart, PartRecovery>): number {
  let sum = 0;
  let weight = 0;
  for (const p of SPLIT_PARTS[split]) {
    const w = isBig(p) ? 2 : 1;
    sum += (recovery.get(p)?.recovery ?? 1) * w;
    weight += w;
  }
  return sum / weight;
}

/** The freshest split; ties go to the one listed first (full body when everything is fresh). */
export function pickSplit(recovery: Map<BodyPart, PartRecovery>): Split {
  return SPLITS.reduce((best, s) => (splitFreshness(s, recovery) > splitFreshness(best, recovery) + 1e-9 ? s : best));
}

/** Body parts an exercise mainly works. */
function mainParts(e: Exercise): BodyPart[] {
  const parts = e.primaryMuscles.map(muscleBodyPart).filter((p): p is BodyPart => !!p);
  return parts.length ? parts : [e.bodyPart];
}

const COMPOUND = /press|squat|deadlift|row|pull[- ]?up|chin[- ]?up|dip|lunge|thrust|clean/i;
const isCompound = (e: Exercise) => COMPOUND.test(e.name) || e.secondaryMuscles.length >= 2;

/**
 * The muscles at the heart of each body part: a back day should be rows and pulldowns (lats,
 * mid-back) before back extensions, glutes should be thrusts before hip adductions.
 */
const CORE_MUSCLES: Partial<Record<BodyPart, string[]>> = {
  Back: ['lats', 'middle back'],
  Glutes: ['glutes'],
  Quads: ['quadriceps'],
  Hamstrings: ['hamstrings'],
  Chest: ['chest'],
  Shoulders: ['shoulders'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Calves: ['calves'],
  Core: ['abdominals'],
};

/** The movement without its equipment, so "Curl (Dumbbell)" and "Curl (EZ Bar)" count as one. */
const movement = (e: Exercise) => e.name.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();

/** Small seeded random generator (mulberry32), so "Regenerate" can step through variations. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exercise slots: one per body part, then more for the big ones, kept together by part. */
export function allocateSlots(parts: BodyPart[], count: number): BodyPart[] {
  const slots: BodyPart[] = [];
  for (let round = 0; round < 3 && slots.length < count; round++) {
    for (const p of parts) {
      if (slots.length >= count) break;
      // Second exercises go to big muscles, or to every part of a short split.
      if (round === 0 || isBig(p) || (round === 1 && parts.length <= 3)) slots.push(p);
    }
  }
  return parts.flatMap((p) => slots.filter((s) => s === p));
}

export interface PlannedExercise {
  exercise: Exercise;
  part: BodyPart;
  sets: SetData[];
}

export interface GeneratedWorkout {
  split: Split;
  name: string;
  exercises: PlannedExercise[];
}

function targetSets(e: Exercise, heavy: boolean): SetData[] {
  const base: SetData = { setType: 'normal', weight: null, reps: null, durationS: null, distanceM: null, rpe: null };
  if (e.type === 'duration') return Array.from({ length: 3 }, () => ({ ...base, durationS: 30 }));
  const reps = usesWeight(e.type) && heavy ? 6 : 10;
  return Array.from({ length: 3 }, () => ({ ...base, reps }));
}

export function generateWorkout(options: {
  exercises: Exercise[];
  recovery: Map<BodyPart, PartRecovery>;
  gym: Gym | null;
  useCounts: Map<number, number>;
  /** Built-in staples (the well-known names) are preferred over the long tail of the library. */
  isStaple: (e: Exercise) => boolean;
  focus: Focus;
  count: number;
  seed: number;
}): GeneratedWorkout {
  const { recovery, gym, useCounts, isStaple } = options;
  const split = options.focus === 'auto' ? pickSplit(recovery) : options.focus;
  const fresh = (p: BodyPart) => recovery.get(p)?.recovery ?? 1;
  // Big muscles first (they get the heavy compound lifts), then the freshest.
  const parts = [...SPLIT_PARTS[split]].sort((a, b) => Number(isBig(b)) - Number(isBig(a)) || fresh(b) - fresh(a));
  const rand = random(options.seed);
  const usable = options.exercises.filter(
    (e) =>
      !e.archived &&
      exerciseCategory(e) === 'strength' &&
      e.equipment !== 'Other' &&
      e.type !== 'distance_duration' &&
      availableIn(gym, e),
  );

  const chosen = new Set<string>();
  const planned: PlannedExercise[] = [];
  for (const [i, part] of allocateSlots(parts, options.count).entries()) {
    const first = planned.every((p) => p.part !== part);
    const score = (e: Exercise) => {
      const used = useCounts.get(e.id) ?? 0;
      return (
        (used > 0 ? 100 + Math.min(used, 50) : 0) +
        (isStaple(e) ? 50 : 0) +
        (e.primaryMuscles.some((m) => CORE_MUSCLES[part]?.includes(m)) ? 40 : 0) +
        (first && isBig(part) && isCompound(e) ? 30 : 0) +
        // Holds suit the core; elsewhere prefer exercises with reps.
        (e.type === 'duration' ? (part === 'Core' ? 0 : -80) : 0)
      );
    };
    const ranked = usable
      .filter((e) => !chosen.has(movement(e)) && mainParts(e).includes(part))
      .map((e) => ({ e, s: score(e) }))
      .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
      .slice(0, 5);
    if (ranked.length === 0) continue;
    // Pick among the best few, leaning towards the top of the list.
    const pick = ranked[Math.min(ranked.length - 1, Math.floor(rand() * rand() * ranked.length))].e;
    chosen.add(movement(pick));
    planned.push({ exercise: pick, part, sets: targetSets(pick, first && isBig(part) && i < 4) });
  }
  return { split, name: WORKOUT_NAMES[split], exercises: planned };
}
