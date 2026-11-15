// The "hero" progression system: levels, stats, ranks, weekly quests and achievements.
//
// Nothing here is stored. Everything is replayed from the workout history, oldest first, so
// imported workouts count, editing or deleting a workout keeps the numbers honest, and backups
// carry the hero with them for free.
import { computeRecords, newRecords, setVolume, type RecordKey, type Records } from './calc';
import { startOfWeek } from './format';
import type { BodyPart, ExerciseType, SetData } from './types';

// ---------- Stats ----------

export const STATS = ['might', 'grip', 'drive', 'fortitude', 'stamina', 'agility'] as const;
export type Stat = (typeof STATS)[number];

export const STAT_INFO: Record<Stat, { name: string; short: string; trains: string; color: string; heroClass: string }> = {
  might: { name: 'Might', short: 'MGT', trains: 'Chest, shoulders, triceps', color: '#EF4444', heroClass: 'Vanguard' },
  grip: { name: 'Grip', short: 'GRP', trains: 'Back, biceps, forearms', color: '#3B82F6', heroClass: 'Ranger' },
  drive: { name: 'Drive', short: 'DRV', trains: 'Quads, hamstrings, glutes, calves', color: '#F59E0B', heroClass: 'Juggernaut' },
  fortitude: { name: 'Fortitude', short: 'FOR', trains: 'Core and neck', color: '#A855F7', heroClass: 'Guardian' },
  stamina: { name: 'Stamina', short: 'STA', trains: 'Cardio and plyometrics', color: '#22C55E', heroClass: 'Pathfinder' },
  agility: { name: 'Agility', short: 'AGI', trains: 'Stretching and mobility', color: '#06B6D4', heroClass: 'Monk' },
};

type StatWeights = Partial<Record<Stat, number>>;

const BODY_PART_STATS: Record<BodyPart, StatWeights> = {
  Chest: { might: 1 },
  Shoulders: { might: 1 },
  Triceps: { might: 1 },
  Back: { grip: 1 },
  Biceps: { grip: 1 },
  Forearms: { grip: 1 },
  Quads: { drive: 1 },
  Hamstrings: { drive: 1 },
  Glutes: { drive: 1 },
  Calves: { drive: 1 },
  Core: { fortitude: 1 },
  Neck: { fortitude: 1 },
  'Full Body': { might: 0.25, grip: 0.25, drive: 0.25, fortitude: 0.25 },
  Cardio: { stamina: 1 },
  Other: { might: 0.25, grip: 0.25, drive: 0.25, fortitude: 0.25 },
};

export interface ExerciseKind {
  type: ExerciseType;
  bodyPart: BodyPart;
  category: string | null;
}

/** How an exercise's XP is shared between stats (weights add up to 1). */
export function statWeights(e: ExerciseKind): StatWeights {
  if (e.category === 'stretching') return { agility: 1 };
  if (isCardio(e)) return { stamina: 1 };
  if (e.category === 'plyometrics') return { stamina: 0.5, drive: 0.5 };
  return BODY_PART_STATS[e.bodyPart] ?? BODY_PART_STATS.Other;
}

function isCardio(e: ExerciseKind): boolean {
  return e.category === 'cardio' || e.bodyPart === 'Cardio' || e.type === 'distance_duration';
}

// ---------- XP rules ----------

export const XP = {
  set: 10,
  warmupSet: 3,
  /** Timed holds and stretches: 1 XP per 6 s, between 4 and 20 per set. */
  holdSecondsPerXp: 6,
  holdMin: 4,
  holdMax: 20,
  /** Cardio: 4 XP per minute (or 20 per km when only distance is logged), up to 360 per set. */
  cardioPerMinute: 4,
  cardioPerKm: 20,
  cardioMax: 360,
  record: 25,
  workout: 50,
  /** Extra set XP per consecutive week trained before this one. */
  streakStep: 0.05,
  streakMaxSteps: 5,
} as const;

/** XP for one completed set. Sets with nothing logged earn nothing. */
export function setXp(e: ExerciseKind, s: SetData): number {
  const duration = s.durationS ?? 0;
  const distance = s.distanceM ?? 0;
  if (e.type === 'duration' || e.type === 'distance_duration') {
    if (isCardio(e)) {
      const raw = duration > 0 ? (duration / 60) * XP.cardioPerMinute : (distance / 1000) * XP.cardioPerKm;
      return raw > 0 ? Math.min(XP.cardioMax, Math.max(XP.holdMin, Math.round(raw))) : 0;
    }
    if (duration <= 0) return 0;
    return Math.min(XP.holdMax, Math.max(XP.holdMin, Math.round(duration / XP.holdSecondsPerXp)));
  }
  if ((s.reps ?? 0) <= 0) return 0;
  return s.setType === 'warmup' ? XP.warmupSet : XP.set;
}

// ---------- Levels & ranks ----------

export const MAX_LEVEL = 99;
/** Total XP for hero level L is 50·L·(L−1): 100 XP for level 2, then 100 more per level each time. */
const HERO_CURVE = 50;
/** Stats use the same shape with a smaller step, since XP is shared between six of them. */
const STAT_CURVE = 20;

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level takes in total (0 at the level cap). */
  span: number;
  /** 0–1 progress to the next level. */
  progress: number;
}

function levelFor(xp: number, curve: number): LevelInfo {
  const total = Math.max(0, Math.floor(xp));
  const level = Math.min(MAX_LEVEL, Math.floor((1 + Math.sqrt(1 + (4 * total) / curve)) / 2));
  const floor = curve * level * (level - 1);
  if (level >= MAX_LEVEL) return { level, xp: total, into: total - floor, span: 0, progress: 1 };
  const span = curve * 2 * level;
  return { level, xp: total, into: total - floor, span, progress: (total - floor) / span };
}

export const heroLevel = (xp: number) => levelFor(xp, HERO_CURVE);
export const statLevel = (xp: number) => levelFor(xp, STAT_CURVE);
/** Total XP needed to reach a hero level. */
export const xpForHeroLevel = (level: number) => HERO_CURVE * level * (level - 1);

export interface Rank {
  letter: string;
  title: string;
  minLevel: number;
  color: string;
}

export const RANKS: Rank[] = [
  { letter: 'E', title: 'Rookie', minLevel: 1, color: '#9CA3AF' },
  { letter: 'D', title: 'Trainee', minLevel: 5, color: '#22C55E' },
  { letter: 'C', title: 'Challenger', minLevel: 10, color: '#3B82F6' },
  { letter: 'B', title: 'Veteran', minLevel: 20, color: '#A855F7' },
  { letter: 'A', title: 'Elite', minLevel: 30, color: '#F59E0B' },
  { letter: 'S', title: 'Champion', minLevel: 40, color: '#EF4444' },
  { letter: 'SS', title: 'Legend', minLevel: 60, color: '#F472B6' },
  { letter: 'SSS', title: 'Mythic', minLevel: 80, color: '#FDE047' },
];

export function rankFor(level: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) rank = r;
  return rank;
}

export function nextRank(level: number): Rank | null {
  return RANKS.find((r) => r.minLevel > level) ?? null;
}

/**
 * The hero's class follows what they actually train: the strongest stat names it, unless the
 * stats are close enough to call them an all-rounder.
 */
export function heroClass(statXp: Record<Stat, number>): { name: string; stat: Stat | null } {
  const levels = STATS.map((s) => ({ stat: s, level: statLevel(statXp[s]).level, xp: statXp[s] }));
  const top = levels.reduce((a, b) => (b.xp > a.xp ? b : a));
  if (top.xp === 0) return { name: 'Newcomer', stat: null };
  const lowest = Math.min(...levels.map((l) => l.level));
  if (lowest >= 3 && top.level - lowest <= 2) return { name: 'Paragon', stat: null };
  return { name: STAT_INFO[top.stat].heroClass, stat: top.stat };
}

// ---------- Weekly quests ----------

export const QUESTS = [
  { id: 'showUp', title: 'Show up', description: 'Train 3 times this week', target: 3, reward: 100 },
  { id: 'record', title: 'Break a limit', description: 'Beat a personal record', target: 1, reward: 50 },
  { id: 'rounded', title: 'Well-rounded', description: 'Train 4 different stats', target: 4, reward: 75 },
] as const;
export type QuestId = (typeof QUESTS)[number]['id'];

/** A stat counts as trained for the week once it has earned this much XP (two normal sets). */
const TRAINED_STAT_XP = 20;

export interface QuestStatus {
  id: QuestId;
  title: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  done: boolean;
}

interface WeekState {
  week: number;
  workouts: number;
  records: number;
  statXp: Record<Stat, number>;
  done: Set<QuestId>;
}

const zeroStats = (): Record<Stat, number> => ({ might: 0, grip: 0, drive: 0, fortitude: 0, stamina: 0, agility: 0 });

const newWeek = (week: number): WeekState => ({ week, workouts: 0, records: 0, statXp: zeroStats(), done: new Set() });

function questProgress(w: WeekState, id: QuestId): number {
  if (id === 'showUp') return w.workouts;
  if (id === 'record') return w.records;
  return STATS.filter((s) => w.statXp[s] >= TRAINED_STAT_XP).length;
}

function questStatuses(w: WeekState): QuestStatus[] {
  return QUESTS.map((q) => {
    const progress = Math.min(q.target, questProgress(w, q.id));
    return { ...q, progress, done: progress >= q.target };
  });
}

// ---------- Achievements ----------

interface Totals {
  workouts: number;
  records: number;
  volumeKg: number;
  bestStreak: number;
  questsDone: number;
  minStatLevel: number;
}

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: 'footsteps' | 'calendar' | 'flame' | 'trophy' | 'barbell' | 'star' | 'ribbon';
  goal: number;
  value: (t: Totals) => number;
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'w1', title: 'First Step', description: 'Finish your first workout', icon: 'footsteps', goal: 1, value: (t) => t.workouts },
  { id: 'w10', title: 'Regular', description: 'Finish 10 workouts', icon: 'calendar', goal: 10, value: (t) => t.workouts },
  { id: 'w50', title: 'Dedicated', description: 'Finish 50 workouts', icon: 'calendar', goal: 50, value: (t) => t.workouts },
  { id: 'w100', title: 'Centurion', description: 'Finish 100 workouts', icon: 'calendar', goal: 100, value: (t) => t.workouts },
  { id: 'w250', title: 'Iron Will', description: 'Finish 250 workouts', icon: 'calendar', goal: 250, value: (t) => t.workouts },
  { id: 's4', title: 'On a Roll', description: 'Train 4 weeks in a row', icon: 'flame', goal: 4, value: (t) => t.bestStreak },
  { id: 's12', title: 'Unbreakable', description: 'Train 12 weeks in a row', icon: 'flame', goal: 12, value: (t) => t.bestStreak },
  { id: 's52', title: 'Year of Iron', description: 'Train 52 weeks in a row', icon: 'flame', goal: 52, value: (t) => t.bestStreak },
  { id: 'r1', title: 'Limit Breaker', description: 'Beat a personal record', icon: 'trophy', goal: 1, value: (t) => t.records },
  { id: 'r25', title: 'Record Hunter', description: 'Beat your records 25 times', icon: 'trophy', goal: 25, value: (t) => t.records },
  { id: 'r100', title: 'Record Slayer', description: 'Beat your records 100 times', icon: 'trophy', goal: 100, value: (t) => t.records },
  { id: 'v1', title: 'Car Lifter', description: 'Lift 1,500 kg in total', icon: 'barbell', goal: 1500, value: (t) => t.volumeKg },
  { id: 'v2', title: 'Elephant Lifter', description: 'Lift 6,000 kg in total', icon: 'barbell', goal: 6000, value: (t) => t.volumeKg },
  { id: 'v3', title: 'Whale Lifter', description: 'Lift 150,000 kg in total', icon: 'barbell', goal: 150_000, value: (t) => t.volumeKg },
  { id: 'v4', title: 'Mountain Mover', description: 'Lift 1,000,000 kg in total', icon: 'barbell', goal: 1_000_000, value: (t) => t.volumeKg },
  { id: 'q10', title: 'Quest Taker', description: 'Complete 10 weekly quests', icon: 'ribbon', goal: 10, value: (t) => t.questsDone },
  { id: 'q50', title: 'Quest Master', description: 'Complete 50 weekly quests', icon: 'ribbon', goal: 50, value: (t) => t.questsDone },
  { id: 'all5', title: 'No Weak Points', description: 'Reach level 5 in every stat', icon: 'star', goal: 5, value: (t) => t.minStatLevel },
];

export interface Achievement extends Omit<AchievementDef, 'value'> {
  value: number;
  unlocked: boolean;
}

// ---------- Replaying the history ----------

export interface ProgressExercise extends ExerciseKind {
  exerciseId: number;
  sets: SetData[];
}

export interface ProgressWorkout {
  id: number;
  startedAt: number;
  exercises: ProgressExercise[];
}

/** What one workout earned, and how it moved the hero. */
export interface WorkoutReward {
  setXp: number;
  /** Exercises that beat at least one personal record. */
  records: number;
  recordXp: number;
  workoutXp: number;
  /** Consecutive weeks trained, counting this workout's week. */
  streakWeeks: number;
  streakXp: number;
  quests: { id: QuestId; title: string; reward: number }[];
  questXp: number;
  total: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  /** XP each stat gained, with its level before and after. */
  stats: { stat: Stat; xp: number; levelBefore: number; levelAfter: number }[];
}

export interface Progress {
  xp: number;
  level: LevelInfo;
  rank: Rank;
  nextRank: Rank | null;
  heroClass: { name: string; stat: Stat | null };
  stats: Record<Stat, LevelInfo>;
  /** Consecutive weeks trained up to now (a week without a workout yet doesn't break it). */
  streakWeeks: number;
  bestStreak: number;
  workouts: number;
  records: number;
  volumeKg: number;
  /** This week's quests. */
  quests: QuestStatus[];
  achievements: Achievement[];
  rewards: Map<number, WorkoutReward>;
}

const DAY_MS = 86_400_000;
/** The start of the week before `week`; stepping back half a week first survives DST shifts. */
const previousWeek = (week: number) => startOfWeek(week - 3.5 * DAY_MS);

/** Replays every workout (in any order) and returns the hero as of `now`. */
export function computeProgress(workouts: ProgressWorkout[], now: number): Progress {
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt || a.id - b.id);
  const best = new Map<number, Records>();
  const statXp = zeroStats();
  const rewards = new Map<number, WorkoutReward>();
  let xp = 0;
  let records = 0;
  let volumeKg = 0;
  let questsDone = 0;
  let streak = 0;
  let bestStreak = 0;
  let week: WeekState | null = null;

  for (const w of ordered) {
    const thisWeek = startOfWeek(w.startedAt);
    if (!week || week.week !== thisWeek) {
      streak = week && week.week === previousWeek(thisWeek) ? streak + 1 : 1;
      week = newWeek(thisWeek);
    }
    bestStreak = Math.max(bestStreak, streak);

    // Sets, grouped per exercise so that records compare against earlier workouts only.
    const gained = zeroStats();
    const byExercise = new Map<number, { kind: ExerciseKind; sets: SetData[] }>();
    let setTotal = 0;
    for (const e of w.exercises) {
      const entry = byExercise.get(e.exerciseId) ?? { kind: e, sets: [] };
      entry.sets.push(...e.sets);
      byExercise.set(e.exerciseId, entry);
      const weights = statWeights(e);
      for (const s of e.sets) {
        const earned = setXp(e, s);
        setTotal += earned;
        volumeKg += setVolume(e.type, s);
        for (const stat of STATS) gained[stat] += earned * (weights[stat] ?? 0);
      }
    }

    let workoutRecords = 0;
    for (const [exerciseId, { kind, sets }] of byExercise) {
      const current = computeRecords(kind.type, sets);
      const previous = best.get(exerciseId) ?? null;
      // One heavier set usually beats several records at once (est. 1RM, weight, volume), so the
      // bonus is paid once per exercise.
      if (newRecords(kind.type, previous, current).length > 0) {
        workoutRecords++;
        const weights = statWeights(kind);
        for (const stat of STATS) gained[stat] += XP.record * (weights[stat] ?? 0);
      }
      const merged = { ...current };
      if (previous) for (const k of Object.keys(merged) as RecordKey[]) merged[k] = Math.max(merged[k], previous[k]);
      best.set(exerciseId, merged);
    }

    // A workout with nothing logged in it is not a training session.
    const counts = setTotal > 0;
    const streakXp = counts ? Math.round(setTotal * XP.streakStep * Math.min(XP.streakMaxSteps, streak - 1)) : 0;
    const recordXp = workoutRecords * XP.record;
    const workoutXp = counts ? XP.workout : 0;

    if (counts) week.workouts++;
    week.records += workoutRecords;
    for (const stat of STATS) week.statXp[stat] += gained[stat];
    const quests: WorkoutReward['quests'] = [];
    for (const q of QUESTS) {
      if (!week.done.has(q.id) && questProgress(week, q.id) >= q.target) {
        week.done.add(q.id);
        quests.push({ id: q.id, title: q.title, reward: q.reward });
      }
    }
    const questXp = quests.reduce((n, q) => n + q.reward, 0);
    questsDone += quests.length;
    records += workoutRecords;

    const total = setTotal + recordXp + workoutXp + streakXp + questXp;
    const stats: WorkoutReward['stats'] = [];
    for (const stat of STATS) {
      if (gained[stat] <= 0) continue;
      const levelBefore = statLevel(statXp[stat]).level;
      statXp[stat] += gained[stat];
      stats.push({ stat, xp: Math.round(gained[stat]), levelBefore, levelAfter: statLevel(statXp[stat]).level });
    }
    rewards.set(w.id, {
      setXp: setTotal,
      records: workoutRecords,
      recordXp,
      workoutXp,
      streakWeeks: streak,
      streakXp,
      quests,
      questXp,
      total,
      xpBefore: xp,
      xpAfter: xp + total,
      levelBefore: heroLevel(xp).level,
      levelAfter: heroLevel(xp + total).level,
      stats,
    });
    xp += total;
  }

  // The streak survives into a new week until that week ends without a workout.
  const currentWeek = startOfWeek(now);
  const alive = week != null && (week.week === currentWeek || week.week === previousWeek(currentWeek));
  const stats = Object.fromEntries(STATS.map((s) => [s, statLevel(statXp[s])])) as Record<Stat, LevelInfo>;
  const level = heroLevel(xp);
  const totals: Totals = {
    workouts: [...rewards.values()].filter((r) => r.workoutXp > 0).length,
    records,
    volumeKg,
    bestStreak,
    questsDone,
    minStatLevel: Math.min(...STATS.map((s) => stats[s].level)),
  };

  return {
    xp,
    level,
    rank: rankFor(level.level),
    nextRank: nextRank(level.level),
    heroClass: heroClass(statXp),
    stats,
    streakWeeks: alive ? streak : 0,
    bestStreak,
    workouts: totals.workouts,
    records,
    volumeKg,
    quests: questStatuses(week && week.week === currentWeek ? week : newWeek(currentWeek)),
    achievements: ACHIEVEMENTS.map(({ value, ...a }) => {
      const v = value(totals);
      return { ...a, value: Math.min(v, a.goal), unlocked: v >= a.goal };
    }),
    rewards,
  };
}
