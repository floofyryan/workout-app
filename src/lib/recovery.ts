// How recovered each body part is, estimated from recent workouts. A rough guide rather than
// physiology: every hard set loads the muscles it works, and that load fades over two or three days.
import { muscleBodyPart } from './freeExerciseDb';
import type { BodyPart, Exercise, WorkoutDetail } from './types';

/** Hours a body part takes to recover from a hard session: big muscles take longer. */
const RECOVERY_HOURS: Partial<Record<BodyPart, number>> = {
  Chest: 72,
  Back: 72,
  Quads: 72,
  Hamstrings: 72,
  Glutes: 72,
  Shoulders: 48,
  Biceps: 48,
  Triceps: 48,
  Forearms: 48,
  Calves: 48,
  Core: 48,
  Neck: 48,
};

/** Body parts the recovery map tracks (the ones on the body figure). */
export const TRACKED_PARTS = Object.keys(RECOVERY_HOURS) as BodyPart[];

/** Hard sets in one go that leave a body part fully worked. */
export const FULL_FATIGUE_SETS = 10;

/** How fully an exercise works each body part: its main muscles fully, helpers by half. */
export function bodyPartLoad(e: Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles' | 'bodyPart'>): Map<BodyPart, number> {
  const load = new Map<BodyPart, number>();
  const add = (part: BodyPart | undefined, share: number) => {
    if (part && RECOVERY_HOURS[part]) load.set(part, Math.max(load.get(part) ?? 0, share));
  };
  const primary = e.primaryMuscles.map(muscleBodyPart).filter((p): p is BodyPart => !!p);
  // Without muscle data (custom exercises), the exercise's body part stands in.
  if (primary.length) primary.forEach((p) => add(p, 1));
  else add(e.bodyPart, 1);
  e.secondaryMuscles.forEach((m) => add(muscleBodyPart(m), 0.5));
  return load;
}

export interface PartRecovery {
  /** 0 = just worked hard, 1 = fresh. */
  recovery: number;
  /** When it was last worked within its recovery time, if it was. */
  lastWorked: number | null;
}

/** Recovery of every tracked body part at `now`, from the workouts given (usually the last few days). */
export function recoveryByPart(workouts: WorkoutDetail[], now: number): Map<BodyPart, PartRecovery> {
  const fatigue = new Map<BodyPart, number>();
  const last = new Map<BodyPart, number>();
  for (const w of workouts) {
    const hours = Math.max(0, (now - w.endedAt) / 3_600_000);
    for (const e of w.exercises) {
      const hardSets = e.sets.filter((s) => s.setType !== 'warmup').length;
      if (hardSets === 0) continue;
      for (const [part, share] of bodyPartLoad(e.exercise)) {
        const left = 1 - hours / RECOVERY_HOURS[part]!;
        if (left <= 0) continue;
        fatigue.set(part, (fatigue.get(part) ?? 0) + hardSets * share * left);
        last.set(part, Math.max(last.get(part) ?? 0, w.startedAt));
      }
    }
  }
  return new Map(
    TRACKED_PARTS.map((part) => [
      part,
      {
        recovery: Math.min(1, Math.max(0, 1 - (fatigue.get(part) ?? 0) / FULL_FATIGUE_SETS)),
        lastWorked: last.get(part) ?? null,
      },
    ]),
  );
}

/** The longest any body part takes to recover, i.e. how far back workouts matter. */
export const RECOVERY_WINDOW_MS = Math.max(...Object.values(RECOVERY_HOURS)) * 3_600_000;

export type RecoveryLevel = 'worked' | 'recovering' | 'fresh';

export function recoveryLevel(recovery: number): RecoveryLevel {
  if (recovery < 0.4) return 'worked';
  return recovery < 0.8 ? 'recovering' : 'fresh';
}
