// The "hero" progression system: levels, stats, ranks, weekly quests and achievements.
//
// Nothing here is stored. Everything is replayed from the workout history, oldest first, so
// imported workouts count, editing or deleting a workout keeps the numbers honest, and backups
// carry the hero with them for free.
import { computeRecords, newRecords, setVolume, type RecordKey, type Records } from './calc';
import { startOfDay, startOfWeek } from './format';
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
  /** Defeating the monthly boss. */
  boss: 200,
  /** Completing the daily quest. */
  daily: 30,
  /** Extra set XP for an exercise whose main stat has rested long enough. */
  restedStep: 0.1,
} as const;

/** The monthly boss: beat your best est. 1RM on your most-trained lift by this much. */
export const BOSS = {
  /** Target = best est. 1RM before the month × (1 + step). */
  step: 0.025,
  /** The boss lift is the one trained in the most workouts over this many days before the month. */
  lookbackDays: 60,
} as const;

/** Daily quest targets. */
export const DAILY = {
  sets: 10,
  /** XP to earn in the weakest stat. */
  statXp: 20,
  stretchSets: 2,
  cardioMinutes: 10,
} as const;

/** Streak tokens: one per `everyWeeks` weeks of streak, holding at most `max`; one bridges a single missed week. */
export const STREAK_TOKENS = { everyWeeks: 4, max: 2 } as const;

/** Hours since a stat was last trained: under `fatiguedHours` it is fatigued, from `restedHours` on it is rested. */
export const RECOVERY = { fatiguedHours: 24, restedHours: 48 } as const;

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

// ---------- Daily quest ----------

const DAILY_KINDS = ['sets', 'weakest', 'mobility', 'cardio'] as const;
type DailyKind = (typeof DAILY_KINDS)[number];

interface DayState {
  /** Start of the local day. */
  day: number;
  kind: DailyKind;
  stat: Stat | null;
  /** Raw progress in the quest's own unit (sets, XP or minutes). */
  progress: number;
  paid: boolean;
}

/** The stat with the least XP; ties go to the first in STATS order. */
function weakestStat(statXp: Record<Stat, number>): Stat {
  return STATS.reduce((a, b) => (statXp[b] < statXp[a] ? b : a));
}

/** The quest for the day containing `at`, given the stat XP at the start of that day. */
function newDay(at: number, statXp: Record<Stat, number>): DayState {
  const d = new Date(at);
  // Counting calendar days (not elapsed time) keeps the rotation steady through DST shifts.
  const index = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  const n = DAILY_KINDS.length;
  const kind = DAILY_KINDS[((index % n) + n) % n];
  const stat = kind === 'weakest' ? weakestStat(statXp) : kind === 'mobility' ? 'agility' : kind === 'cardio' ? 'stamina' : null;
  return { day: startOfDay(at), kind, stat, progress: 0, paid: false };
}

function dailyTarget(kind: DailyKind): number {
  if (kind === 'sets') return DAILY.sets;
  if (kind === 'weakest') return DAILY.statXp;
  if (kind === 'mobility') return DAILY.stretchSets;
  return DAILY.cardioMinutes;
}

function dailyText(d: DayState): { title: string; description: string } {
  if (d.kind === 'sets') return { title: 'Daily training', description: `Finish ${DAILY.sets} sets today` };
  if (d.kind === 'weakest') {
    return { title: 'Weak point', description: `Earn ${DAILY.statXp} ${STAT_INFO[d.stat ?? 'might'].name} XP today` };
  }
  if (d.kind === 'mobility') return { title: 'Limber up', description: `Complete ${DAILY.stretchSets} stretching sets today` };
  return { title: 'Get moving', description: `Do ${DAILY.cardioMinutes} minutes of cardio today` };
}

const EPSILON = 1e-9;
const dailyDone = (d: DayState) => d.progress >= dailyTarget(d.kind) - EPSILON;

function dailyStatus(d: DayState): DailyQuest {
  const target = dailyTarget(d.kind);
  return {
    id: d.kind,
    ...dailyText(d),
    reward: XP.daily,
    progress: Math.min(target, Math.floor(d.progress + EPSILON)),
    target,
    done: dailyDone(d),
    stat: d.stat,
  };
}

/** Minutes of cardio in a set; distance-only sets count 5 min per km, matching the XP rates. */
function cardioMinutes(s: SetData): number {
  const duration = s.durationS ?? 0;
  if (duration > 0) return duration / 60;
  return (Math.max(0, s.distanceM ?? 0) / 1000) * (XP.cardioPerKm / XP.cardioPerMinute);
}

// ---------- Achievements ----------

interface Totals {
  bossesDefeated: number;
  dailyDone: number;
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
  /** Goal and progress are weights in kg; "%s" in the description is the goal in the user's unit. */
  weight?: true;
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
  { id: 'v1', title: 'Car Lifter', description: 'Lift %s in total', icon: 'barbell', weight: true, goal: 1500, value: (t) => t.volumeKg },
  { id: 'v2', title: 'Elephant Lifter', description: 'Lift %s in total', icon: 'barbell', weight: true, goal: 6000, value: (t) => t.volumeKg },
  { id: 'v3', title: 'Whale Lifter', description: 'Lift %s in total', icon: 'barbell', weight: true, goal: 150_000, value: (t) => t.volumeKg },
  { id: 'v4', title: 'Mountain Mover', description: 'Lift %s in total', icon: 'barbell', weight: true, goal: 1_000_000, value: (t) => t.volumeKg },
  { id: 'q10', title: 'Quest Taker', description: 'Complete 10 weekly quests', icon: 'ribbon', goal: 10, value: (t) => t.questsDone },
  { id: 'q50', title: 'Quest Master', description: 'Complete 50 weekly quests', icon: 'ribbon', goal: 50, value: (t) => t.questsDone },
  { id: 'b1', title: 'Boss Slayer', description: 'Defeat a monthly boss', icon: 'trophy', goal: 1, value: (t) => t.bossesDefeated },
  { id: 'b5', title: 'Boss Hunter', description: 'Defeat 5 monthly bosses', icon: 'trophy', goal: 5, value: (t) => t.bossesDefeated },
  { id: 'd7', title: 'Daily Grind', description: 'Complete 7 daily quests', icon: 'star', goal: 7, value: (t) => t.dailyDone },
  { id: 'd30', title: 'Creature of Habit', description: 'Complete 30 daily quests', icon: 'star', goal: 30, value: (t) => t.dailyDone },
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
  /** Other bonuses (boss defeated, daily quest, rested muscles…), already included in `total`. */
  bonuses: { label: string; xp: number }[];
  /** A streak token was spent to bridge the missed week before this workout. */
  tokenUsed: boolean;
  /** This workout's week earned a streak token. */
  tokenEarned: boolean;
  total: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  /** XP each stat gained, with its level before and after. */
  stats: { stat: Stat; xp: number; levelBefore: number; levelAfter: number }[];
}

/** This month's boss: beat `targetE1rm` (kg) on one lift for a big payout. */
export interface BossStatus {
  exerciseId: number;
  /** Start of the boss's calendar month (local time). */
  month: number;
  /** Est. 1RM to beat, in kg. */
  targetE1rm: number;
  /** Best est. 1RM before the month started, in kg. */
  baselineE1rm: number;
  /** Best est. 1RM so far this month, in kg (0 if the lift hasn't been trained this month). */
  bestE1rm: number;
  reward: number;
  defeated: boolean;
}

/** Today's small quest. */
export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  done: boolean;
  /** The stat the quest is about, if any. */
  stat: Stat | null;
}

export type RecoveryState = 'fatigued' | 'recovering' | 'rested';

export interface Progress {
  /** This month's boss, or null when there isn't enough lifting history to pick one. */
  boss: BossStatus | null;
  bossesDefeated: number;
  daily: DailyQuest;
  /** Streak tokens held now; one saves the streak through a missed week. */
  streakTokens: number;
  /** How recovered the muscles behind each stat are. */
  recovery: Record<Stat, { lastTrainedAt: number | null; state: RecoveryState }>;
  /** Total XP after each workout, oldest first. */
  timeline: { at: number; xp: number }[];
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

const startOfMonth = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

const isLift = (type: ExerciseType) => type === 'weight_reps' || type === 'weighted_bodyweight';

/** An exercise's main stat: its largest weight, ties going to the first in STATS order. */
function primaryStat(e: ExerciseKind): Stat {
  const weights = statWeights(e);
  return STATS.reduce((a, b) => ((weights[b] ?? 0) > (weights[a] ?? 0) ? b : a));
}

/**
 * Picks the boss for the month starting at `month` from the state just before it: the lift (with
 * an est. 1RM on record) that appeared in the most workouts over the lookback window.
 */
function pickBoss(
  month: number,
  best: Map<number, Records>,
  types: Map<number, ExerciseType>,
  history: { at: number; exerciseIds: number[] }[],
): BossStatus | null {
  const from = month - BOSS.lookbackDays * DAY_MS;
  const seen = new Map<number, number>();
  for (let i = history.length - 1; i >= 0 && history[i].at >= from; i--) {
    if (history[i].at >= month) continue;
    for (const id of history[i].exerciseIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  let pick: { exerciseId: number; count: number; e1rm: number } | null = null;
  for (const [exerciseId, records] of best) {
    const type = types.get(exerciseId);
    if (!type || !isLift(type) || records.e1rm <= 0) continue;
    const count = seen.get(exerciseId) ?? 0;
    if (!pick || count > pick.count || (count === pick.count && exerciseId < pick.exerciseId)) {
      pick = { exerciseId, count, e1rm: records.e1rm };
    }
  }
  if (!pick) return null;
  return {
    exerciseId: pick.exerciseId,
    month,
    targetE1rm: pick.e1rm * (1 + BOSS.step),
    baselineE1rm: pick.e1rm,
    bestE1rm: 0,
    reward: XP.boss,
    defeated: false,
  };
}

function recoveryState(lastTrainedAt: number | null, now: number): RecoveryState {
  if (lastTrainedAt == null) return 'rested';
  const hours = (now - lastTrainedAt) / 3_600_000;
  return hours < RECOVERY.fatiguedHours ? 'fatigued' : hours < RECOVERY.restedHours ? 'recovering' : 'rested';
}

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
  let tokens = 0;
  let day: DayState | null = null;
  let dailyCount = 0;
  let boss: BossStatus | null = null;
  let bossMonth: number | null = null;
  let bossesDefeated = 0;
  const types = new Map<number, ExerciseType>();
  const history: { at: number; exerciseIds: number[] }[] = [];
  const lastTrained = Object.fromEntries(STATS.map((s) => [s, null])) as Record<Stat, number | null>;
  const timeline: Progress['timeline'] = [];

  for (const w of ordered) {
    const thisWeek = startOfWeek(w.startedAt);
    let tokenUsed = false;
    let tokenEarned = false;
    if (!week || week.week !== thisWeek) {
      const lastWeek = previousWeek(thisWeek);
      if (week && week.week === lastWeek) {
        streak++;
      } else if (week && tokens > 0 && week.week === previousWeek(lastWeek)) {
        // Exactly one week missed: a token bridges it, and the missed week adds nothing.
        tokens--;
        tokenUsed = true;
        streak++;
      } else {
        streak = 1;
      }
      if (streak % STREAK_TOKENS.everyWeeks === 0 && tokens < STREAK_TOKENS.max) {
        tokens++;
        tokenEarned = true;
      }
      week = newWeek(thisWeek);
    }
    bestStreak = Math.max(bestStreak, streak);

    // The boss and the daily quest are chosen from the state before this workout, which is the
    // state at the start of the month/day since workouts are replayed in order.
    const thisMonth = startOfMonth(w.startedAt);
    if (bossMonth !== thisMonth) {
      bossMonth = thisMonth;
      boss = pickBoss(thisMonth, best, types, history);
    }
    if (!day || day.day !== startOfDay(w.startedAt)) day = newDay(w.startedAt, statXp);

    // Sets, grouped per exercise so that records compare against earlier workouts only.
    const gained = zeroStats();
    const byExercise = new Map<number, { kind: ExerciseKind; sets: SetData[] }>();
    let setTotal = 0;
    let restedXp = 0;
    let xpSets = 0;
    let stretchSets = 0;
    let cardio = 0;
    for (const e of w.exercises) {
      const entry = byExercise.get(e.exerciseId) ?? { kind: e, sets: [] };
      entry.sets.push(...e.sets);
      byExercise.set(e.exerciseId, entry);
      const weights = statWeights(e);
      const trainedAt = lastTrained[primaryStat(e)];
      const rested = trainedAt == null || w.startedAt - trainedAt >= RECOVERY.restedHours * 3_600_000;
      for (const s of e.sets) {
        const earned = setXp(e, s);
        setTotal += earned;
        volumeKg += setVolume(e.type, s);
        for (const stat of STATS) gained[stat] += earned * (weights[stat] ?? 0);
        if (earned <= 0) continue;
        xpSets++;
        if (rested) restedXp += earned * XP.restedStep;
        if (e.category === 'stretching') stretchSets++;
        else if (isCardio(e)) cardio += cardioMinutes(s);
      }
    }

    const bonuses: WorkoutReward['bonuses'] = [];
    let workoutRecords = 0;
    for (const [exerciseId, { kind, sets }] of byExercise) {
      const current = computeRecords(kind.type, sets);
      const previous = best.get(exerciseId) ?? null;
      types.set(exerciseId, kind.type);
      if (boss && boss.exerciseId === exerciseId) {
        boss.bestE1rm = Math.max(boss.bestE1rm, current.e1rm);
        if (!boss.defeated && current.e1rm >= boss.targetE1rm - EPSILON) {
          boss.defeated = true;
          bossesDefeated++;
          bonuses.push({ label: 'Boss defeated', xp: XP.boss });
        }
      }
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

    // Daily quest: progress adds up over the day's workouts and pays out once.
    if (day.kind === 'sets') day.progress += xpSets;
    else if (day.kind === 'weakest') day.progress += day.stat ? gained[day.stat] : 0;
    else if (day.kind === 'mobility') day.progress += stretchSets;
    else day.progress += cardio;
    if (!day.paid && dailyDone(day)) {
      day.paid = true;
      dailyCount++;
      bonuses.push({ label: `Daily quest: ${dailyText(day).title}`, xp: XP.daily });
    }

    // Rested bonus, judged against when each stat was trained before this workout.
    const restedBonus = Math.round(restedXp);
    if (restedBonus > 0) bonuses.push({ label: 'Rested muscles', xp: restedBonus });
    for (const stat of STATS) if (gained[stat] >= TRAINED_STAT_XP) lastTrained[stat] = w.startedAt;
    history.push({ at: w.startedAt, exerciseIds: [...byExercise.keys()] });

    const bonusXp = bonuses.reduce((n, b) => n + b.xp, 0);
    const total = setTotal + recordXp + workoutXp + streakXp + questXp + bonusXp;
    const stats: WorkoutReward['stats'] = [];
    for (const stat of STATS) {
      if (gained[stat] <= 0) continue;
      const levelBefore = statLevel(statXp[stat]).level;
      statXp[stat] += gained[stat];
      stats.push({ stat, xp: Math.round(gained[stat]), levelBefore, levelAfter: statLevel(statXp[stat]).level });
    }
    rewards.set(w.id, {
      bonuses,
      tokenUsed,
      tokenEarned,
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
    timeline.push({ at: w.startedAt, xp });
  }

  // The streak survives into a new week until that week ends without a workout, and one week
  // longer with a token in hand (it is only spent when a workout actually uses it).
  const currentWeek = startOfWeek(now);
  const lastWeek = previousWeek(currentWeek);
  const alive =
    week != null &&
    (week.week === currentWeek || week.week === lastWeek || (tokens > 0 && week.week === previousWeek(lastWeek)));
  const currentMonth = startOfMonth(now);
  if (bossMonth !== currentMonth) boss = pickBoss(currentMonth, best, types, history);
  if (!day || day.day !== startOfDay(now)) day = newDay(now, statXp);
  const stats = Object.fromEntries(STATS.map((s) => [s, statLevel(statXp[s])])) as Record<Stat, LevelInfo>;
  const level = heroLevel(xp);
  const totals: Totals = {
    bossesDefeated,
    dailyDone: dailyCount,
    workouts: [...rewards.values()].filter((r) => r.workoutXp > 0).length,
    records,
    volumeKg,
    bestStreak,
    questsDone,
    minStatLevel: Math.min(...STATS.map((s) => stats[s].level)),
  };

  return {
    boss,
    bossesDefeated,
    daily: dailyStatus(day),
    streakTokens: tokens,
    recovery: Object.fromEntries(
      STATS.map((s) => [s, { lastTrainedAt: lastTrained[s], state: recoveryState(lastTrained[s], now) }]),
    ) as Progress['recovery'],
    timeline,
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
