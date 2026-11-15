import type { SQLiteDatabase } from 'expo-sqlite';

import { KEY_LIFTS, type LiftId } from '../lib/liftTiers';

export interface LiftBestRow {
  /**
   * The exercise to open for this lift: the variation holding the best result, else the first
   * of the lift's exercises that exists. Null when none of them exist.
   */
  exerciseId: number | null;
  /** Best non-warm-up estimated 1RM (Epley) in kg across all workouts, or null. */
  e1rmKg: number | null;
  /** Most reps in a non-warm-up set across all workouts, or null. */
  maxReps: number | null;
}

export interface LiftTierData {
  /** Latest logged body weight in kg, or null if never logged. */
  bodyWeightKg: number | null;
  lifts: Record<LiftId, LiftBestRow>;
}

interface BestRow {
  id: number;
  name: string;
  e1rm: number | null;
  max_reps: number | null;
}

/** Everything the skill tree needs: each key lift's best efforts and the latest body weight. */
export async function getLiftTierData(db: SQLiteDatabase): Promise<LiftTierData> {
  const names = KEY_LIFTS.flatMap((l) => l.exerciseNames);
  // Same Epley estimate as estimate1RM in lib/calc.
  const rows = await db.getAllAsync<BestRow>(
    `SELECT e.id, e.name,
       MAX(CASE WHEN s.weight > 0 AND s.reps > 0
             THEN CASE WHEN s.reps = 1 THEN s.weight ELSE s.weight * (1 + s.reps / 30.0) END
           END) AS e1rm,
       MAX(CASE WHEN s.reps > 0 THEN s.reps END) AS max_reps
     FROM exercises e
     LEFT JOIN workout_exercises we ON we.exercise_id = e.id
     LEFT JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.set_type != 'warmup'
     WHERE e.name COLLATE NOCASE IN (${names.map(() => '?').join(',')})
     GROUP BY e.id`,
    names,
  );
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));

  const lifts = {} as Record<LiftId, LiftBestRow>;
  for (const lift of KEY_LIFTS) {
    const best: LiftBestRow = { exerciseId: null, e1rmKg: null, maxReps: null };
    let bestScore = 0;
    for (const name of lift.exerciseNames) {
      const r = byName.get(name.toLowerCase());
      if (!r) continue;
      if (best.exerciseId == null) best.exerciseId = r.id;
      if (r.e1rm != null && r.e1rm > (best.e1rmKg ?? 0)) best.e1rmKg = r.e1rm;
      if (r.max_reps != null && r.max_reps > (best.maxReps ?? 0)) best.maxReps = r.max_reps;
      const score = (lift.kind === 'reps' ? r.max_reps : r.e1rm) ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best.exerciseId = r.id;
      }
    }
    lifts[lift.id] = best;
  }

  const bw = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM measurements WHERE type = 'bodyweight' ORDER BY measured_at DESC, id DESC LIMIT 1",
  );
  return { bodyWeightKg: bw?.value ?? null, lifts };
}
