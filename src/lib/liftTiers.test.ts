/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_EXERCISES } from '../data/exercises';
import { getLiftTierData } from '../db/heroQueries';
import { addMeasurement, findExerciseByName, saveWorkout } from '../db/repo';
import { migrateDb } from '../db/schema';
import { openTestDb } from '../db/testDb';
import { estimate1RM } from './calc';
import { KEY_LIFTS, liftStanding, liftStandings, tierIndexFor, TIERS, type LiftId } from './liftTiers';
import type { SetData } from './types';

const near = (a: number | null, b: number, eps = 1e-6) => {
  assert.ok(a != null && Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
};
const lift = (id: LiftId) => KEY_LIFTS.find((l) => l.id === id)!;

describe('lift definitions', () => {
  it('has six tiers and ascending thresholds for every lift', () => {
    assert.deepEqual(
      TIERS.map((t) => t.id),
      ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'],
    );
    for (const l of KEY_LIFTS) {
      assert.equal(l.thresholds.length, TIERS.length - 1);
      for (let i = 1; i < l.thresholds.length; i++) assert.ok(l.thresholds[i] > l.thresholds[i - 1], l.name);
    }
  });

  it('matches each lift to a seeded exercise by its first name', () => {
    const seeded = new Set(SEED_EXERCISES.map((e) => e.name));
    for (const l of KEY_LIFTS) assert.ok(seeded.has(l.exerciseNames[0]), l.exerciseNames[0]);
  });

  it('orders lift difficulty sensibly', () => {
    for (let i = 0; i < 5; i++) {
      assert.ok(lift('deadlift').thresholds[i] > lift('squat').thresholds[i]);
      assert.ok(lift('squat').thresholds[i] > lift('bench').thresholds[i]);
      assert.ok(lift('bench').thresholds[i] > lift('overheadPress').thresholds[i]);
      assert.ok(lift('row').thresholds[i] >= lift('overheadPress').thresholds[i]);
      assert.ok(lift('row').thresholds[i] <= lift('bench').thresholds[i]);
    }
  });
});

describe('tierIndexFor', () => {
  it('counts thresholds reached, inclusive', () => {
    const t = [0.5, 0.75, 1.0, 1.25, 1.5];
    assert.equal(tierIndexFor(t, 0), 0);
    assert.equal(tierIndexFor(t, 0.49), 0);
    assert.equal(tierIndexFor(t, 0.5), 1);
    assert.equal(tierIndexFor(t, 1.1), 3);
    assert.equal(tierIndexFor(t, 1.5), 5);
    assert.equal(tierIndexFor(t, 9), 5);
  });
});

describe('liftStanding (ratio lifts)', () => {
  it('ranks bench by est. 1RM relative to body weight', () => {
    // 80 kg lifter benching 70 kg: 0.875× → Silver, 10 kg short of Gold (80 kg).
    const s = liftStanding(lift('bench'), { e1rmKg: 70 }, 80);
    assert.equal(s.status, 'ranked');
    assert.equal(s.tier.id, 'silver');
    assert.equal(s.tierIndex, 2);
    assert.equal(s.unit, 'kg');
    assert.equal(s.value, 70);
    near(s.ratio, 0.875);
    assert.equal(s.nextTier?.id, 'gold');
    near(s.nextTarget, 80);
    near(s.toNext, 10);
    near(s.progress, 0.5);
  });

  it('awards a tier exactly at its threshold', () => {
    const s = liftStanding(lift('bench'), { e1rmKg: 100 }, 80); // 1.25×
    assert.equal(s.tier.id, 'platinum');
    assert.equal(s.nextTier?.id, 'diamond');
    near(s.toNext, 20);
    near(s.progress, 0);
    // Body weights that do not divide evenly still land on the tier.
    assert.equal(liftStanding(lift('overheadPress'), { e1rmKg: 0.35 * 83.7 }, 83.7).tier.id, 'bronze');
  });

  it('is unranked below bronze, with progress measured from zero', () => {
    const s = liftStanding(lift('squat'), { e1rmKg: 30 }, 80); // bronze at 60 kg
    assert.equal(s.status, 'ranked');
    assert.equal(s.tier.id, 'unranked');
    assert.equal(s.nextTier?.id, 'bronze');
    near(s.toNext, 30);
    near(s.progress, 0.5);
  });

  it('tops out at diamond', () => {
    const s = liftStanding(lift('deadlift'), { e1rmKg: 250 }, 80); // 3.125×
    assert.equal(s.tier.id, 'diamond');
    assert.equal(s.nextTier, null);
    assert.equal(s.nextTarget, null);
    assert.equal(s.toNext, null);
    assert.equal(s.progress, 1);
  });

  it('needs body weight when none is logged', () => {
    for (const bw of [null, 0]) {
      const s = liftStanding(lift('bench'), { e1rmKg: 100 }, bw);
      assert.equal(s.status, 'needs_bodyweight');
      assert.equal(s.tier.id, 'unranked');
      assert.equal(s.value, 100);
      assert.equal(s.ratio, null);
      assert.equal(s.nextTier, null);
      assert.equal(s.toNext, null);
      assert.equal(s.progress, 0);
    }
  });

  it('is untrained (locked) without a lift, showing the bronze target when body weight is known', () => {
    for (const best of [undefined, {}, { e1rmKg: null }, { e1rmKg: 0, maxReps: 12 }]) {
      const s = liftStanding(lift('bench'), best, 80);
      assert.equal(s.status, 'untrained');
      assert.equal(s.tier.id, 'unranked');
      assert.equal(s.value, null);
      assert.equal(s.nextTier?.id, 'bronze');
      near(s.toNext, 40);
      assert.equal(s.progress, 0);
    }
    const noBw = liftStanding(lift('bench'), undefined, null);
    assert.equal(noBw.status, 'untrained');
    assert.equal(noBw.nextTier, null);
  });
});

describe('liftStanding (rep lifts)', () => {
  it('ranks pull-ups by reps, with or without body weight', () => {
    for (const bw of [null, 80]) {
      const s = liftStanding(lift('pullUp'), { maxReps: 7 }, bw);
      assert.equal(s.status, 'ranked');
      assert.equal(s.tier.id, 'silver');
      assert.equal(s.unit, 'reps');
      assert.equal(s.value, 7);
      assert.equal(s.ratio, null);
      assert.equal(s.nextTier?.id, 'gold');
      assert.equal(s.nextTarget, 10);
      assert.equal(s.toNext, 3);
      near(s.progress, 0.4);
    }
  });

  it('handles the ends of the scale', () => {
    assert.equal(liftStanding(lift('pullUp'), { maxReps: 1 }, null).tier.id, 'bronze');
    const top = liftStanding(lift('pullUp'), { maxReps: 25 }, null);
    assert.equal(top.tier.id, 'diamond');
    assert.equal(top.progress, 1);
    const none = liftStanding(lift('pullUp'), undefined, null);
    assert.equal(none.status, 'untrained');
    assert.equal(none.toNext, 1);
  });
});

describe('liftStandings', () => {
  it('returns every key lift in order', () => {
    const all = liftStandings({ bench: { e1rmKg: 80 }, pullUp: { maxReps: 12 } }, 80);
    assert.deepEqual(
      all.map((s) => s.lift.id),
      KEY_LIFTS.map((l) => l.id),
    );
    const by = new Map(all.map((s) => [s.lift.id, s]));
    assert.equal(by.get('bench')?.tier.id, 'gold');
    assert.equal(by.get('pullUp')?.tier.id, 'gold');
    assert.equal(by.get('squat')?.status, 'untrained');
  });
});

// ---------- getLiftTierData against the in-memory database ----------

const set = (weight: number | null, reps: number | null, extra: Partial<SetData> = {}): SetData => ({
  setType: 'normal',
  weight,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
  ...extra,
});

describe('getLiftTierData', () => {
  it('finds best non-warm-up efforts per lift and the latest body weight', async () => {
    const db = openTestDb();
    try {
      await migrateDb(db);
      const id = async (name: string) => {
        const e = await findExerciseByName(db, name);
        assert.ok(e, name);
        return e.id;
      };
      const bench = await id('Bench Press (Barbell)');
      const squat = await id('Squat (Barbell)');
      const deadlift = await id('Deadlift (Barbell)');
      const sumo = await id('Sumo Deadlift (Barbell)');
      const pullUp = await id('Pull Up (Bodyweight)');
      const chinUp = await id('Chin Up (Bodyweight)');
      const row = await id('Bent Over Row (Barbell)');

      const empty = await getLiftTierData(db);
      assert.equal(empty.bodyWeightKg, null);
      assert.deepEqual(empty.lifts.bench, { exerciseId: bench, e1rmKg: null, maxReps: null });
      assert.deepEqual(empty.lifts.pullUp, { exerciseId: pullUp, e1rmKg: null, maxReps: null });

      const save = (startedAt: number, exercises: { exerciseId: number; sets: SetData[] }[]) =>
        saveWorkout(db, null, {
          name: 'W',
          notes: '',
          startedAt,
          endedAt: startedAt + 1000,
          templateId: null,
          exercises: exercises.map((e) => ({ ...e, notes: '' })),
        });
      await save(1_000, [
        { exerciseId: bench, sets: [set(120, 1, { setType: 'warmup' }), set(80, 5), set(90, 1)] },
        { exerciseId: squat, sets: [set(140, 3, { setType: 'warmup' })] },
        { exerciseId: deadlift, sets: [set(100, 5)] },
        { exerciseId: pullUp, sets: [set(null, 6)] },
      ]);
      await save(2_000, [
        { exerciseId: bench, sets: [set(60, 12), set(0, 20)] },
        { exerciseId: sumo, sets: [set(150, 2, { setType: 'failure' })] },
        { exerciseId: chinUp, sets: [set(null, 9), set(null, 30, { setType: 'warmup' })] },
      ]);
      await addMeasurement(db, 'bodyweight', 82, 5_000);
      await addMeasurement(db, 'bodyweight', 79.5, 9_000);
      await addMeasurement(db, 'bodyweight', 85, 1_000);
      await addMeasurement(db, 'waist', 90, 10_000);

      const data = await getLiftTierData(db);
      assert.equal(data.bodyWeightKg, 79.5);
      // Bench: 80×5 → 93.33 beats the 90 single and 60×12 (84); the 120 warm-up is ignored.
      near(data.lifts.bench.e1rmKg, estimate1RM(80, 5));
      assert.equal(data.lifts.bench.maxReps, 20);
      assert.equal(data.lifts.bench.exerciseId, bench);
      // Only warm-ups logged: still untrained.
      assert.deepEqual(data.lifts.squat, { exerciseId: squat, e1rmKg: null, maxReps: null });
      // The alias with the better lift wins and is the one linked.
      near(data.lifts.deadlift.e1rmKg, estimate1RM(150, 2));
      assert.equal(data.lifts.deadlift.exerciseId, sumo);
      assert.equal(data.lifts.pullUp.maxReps, 9);
      assert.equal(data.lifts.pullUp.e1rmKg, null);
      assert.equal(data.lifts.pullUp.exerciseId, chinUp);
      assert.deepEqual(data.lifts.row, { exerciseId: row, e1rmKg: null, maxReps: null });

      const standings = new Map(liftStandings(data.lifts, data.bodyWeightKg).map((s) => [s.lift.id, s]));
      assert.equal(standings.get('bench')?.tier.id, 'gold'); // 93.3 / 79.5 = 1.17×
      assert.equal(standings.get('deadlift')?.tier.id, 'gold'); // 160 / 79.5 = 2.01×
      assert.equal(standings.get('squat')?.status, 'untrained');
      assert.equal(standings.get('pullUp')?.tier.id, 'silver');
    } finally {
      db.close();
    }
  });
});
