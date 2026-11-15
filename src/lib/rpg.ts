// Adventure mode: role-playing-game flavour on top of the workout log. Every completed set is a
// monster slain and earns XP; XP adds up to a character level, and the kind of training you do
// raises five attributes. Everything here is derived from the workout history, nothing is stored.

import type { ActiveSet, ActiveWorkout } from './activeWorkout';
import { computeRecords, newRecords, type Records } from './calc';
import { startOfWeek } from './format';
import { exerciseCategory, type BodyPart, type ExerciseType, type SetData } from './types';

// ---------- XP ----------

/**
 * XP for one set: a base for showing up plus a share for the work done. Warm-ups give a little,
 * drop sets and sets to failure give a bonus. Weight is in kg, distance in metres.
 */
export function setXp(type: ExerciseType, s: SetData): number {
  const reps = s.reps ?? 0;
  const weight = Math.max(0, s.weight ?? 0);
  const seconds = s.durationS ?? 0;
  let effort: number;
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      effort = reps + (weight * reps) / 40;
      break;
    case 'reps':
    case 'assisted_bodyweight':
      effort = reps * 0.8;
      break;
    case 'duration':
      effort = seconds / 6;
      break;
    case 'distance_duration':
      effort = (s.distanceM ?? 0) / 100 + seconds / 30;
      break;
  }
  effort = Math.min(effort, 150);
  if (s.setType === 'warmup') return Math.round(4 + effort * 0.25);
  const bonus = s.setType === 'failure' ? 1.5 : s.setType === 'drop' ? 1.2 : 1;
  return Math.round((10 + effort) * bonus);
}

/** Total XP needed to reach `level` (level 1 needs 0). Each level costs 100 XP more than the last. */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  /** XP earned since reaching this level. */
  into: number;
  /** XP between this level and the next. */
  span: number;
}

export function levelFromXp(xp: number): LevelInfo {
  // Inverse of xpForLevel, corrected for rounding.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2));
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  const base = xpForLevel(level);
  return { level, into: xp - base, span: xpForLevel(level + 1) - base };
}

/** Rank shown in front of the class name. */
export function rankTitle(level: number): string {
  if (level >= 35) return 'Legendary';
  if (level >= 20) return 'Champion';
  if (level >= 10) return 'Veteran';
  if (level >= 5) return 'Apprentice';
  return 'Novice';
}

// ---------- Gear ----------

/** Equipment the hero wears, upgraded at the same levels as the rank. */
export const GEAR_TIERS = [
  { minLevel: 1, weapon: 'Wooden Sword', armor: 'Leather Tunic' },
  { minLevel: 5, weapon: 'Iron Sword', armor: 'Chainmail' },
  { minLevel: 10, weapon: 'Steel Longsword', armor: 'Plate Armor' },
  { minLevel: 20, weapon: 'Golden Blade', armor: 'Gilded Plate' },
  { minLevel: 35, weapon: 'Flameblade', armor: 'Dragonscale Armor' },
] as const;

/** Index into GEAR_TIERS for a level. */
export function gearTier(level: number): number {
  let tier = 0;
  GEAR_TIERS.forEach((g, i) => {
    if (level >= g.minLevel) tier = i;
  });
  return tier;
}

/** The next gear upgrade, or null at the top tier. */
export function nextGear(level: number) {
  return GEAR_TIERS[gearTier(level) + 1] ?? null;
}

// ---------- Attributes ----------

export const STATS = ['STR', 'CON', 'DEX', 'STA', 'WIS'] as const;
export type Stat = (typeof STATS)[number];

export const STAT_INFO: Record<Stat, { name: string; trainedBy: string; className: string; color: string }> = {
  STR: { name: 'Strength', trainedBy: 'Upper body', className: 'Barbarian', color: '#EF4444' },
  CON: { name: 'Constitution', trainedBy: 'Legs', className: 'Juggernaut', color: '#F59E0B' },
  DEX: { name: 'Dexterity', trainedBy: 'Core, plyo & Olympic lifts', className: 'Rogue', color: '#22C55E' },
  STA: { name: 'Stamina', trainedBy: 'Cardio', className: 'Ranger', color: '#3B82F6' },
  WIS: { name: 'Wisdom', trainedBy: 'Stretching & mobility', className: 'Monk', color: '#A855F7' },
};

const LEG_PARTS = new Set<BodyPart>(['Quads', 'Hamstrings', 'Glutes', 'Calves']);

export interface StatSource {
  type: ExerciseType;
  bodyPart: BodyPart;
  category: string | null;
}

/** Which attributes an exercise trains, as shares that add up to 1. */
export function statShares(e: StatSource): Partial<Record<Stat, number>> {
  const category = exerciseCategory(e);
  if (category === 'stretching') return { WIS: 1 };
  if (category === 'cardio' || e.bodyPart === 'Cardio') return { STA: 1 };
  if (category === 'plyometrics' || category === 'olympic weightlifting') return { DEX: 1 };
  if (LEG_PARTS.has(e.bodyPart)) return { CON: 1 };
  if (e.bodyPart === 'Core') return { DEX: 1 };
  if (e.bodyPart === 'Full Body') return { STR: 0.5, CON: 0.5 };
  return { STR: 1 };
}

/** Attribute score from the XP put into it: grows quickly at first, then slows down. */
export function statValue(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 20));
}

export interface StatEntry extends StatSource {
  set: SetData;
}

export interface Character {
  xp: number;
  level: LevelInfo;
  /** Monsters slain: completed working sets (warm-ups count as slimes but not here). */
  slain: number;
  stats: Record<Stat, { xp: number; value: number }>;
  /** Class from the highest attribute, e.g. "Barbarian". */
  className: string;
  /** e.g. "Veteran Barbarian". */
  title: string;
}

export function emptyStatXp(): Record<Stat, number> {
  return { STR: 0, CON: 0, DEX: 0, STA: 0, WIS: 0 };
}

/** Adds the XP from sets to a running total (overall and per attribute). */
export function addXp(totals: { xp: number; slain: number; stats: Record<Stat, number> }, entries: StatEntry[]) {
  for (const e of entries) {
    const xp = setXp(e.type, e.set);
    totals.xp += xp;
    if (e.set.setType !== 'warmup') totals.slain++;
    for (const [stat, share] of Object.entries(statShares(e)) as [Stat, number][]) totals.stats[stat] += xp * share;
  }
  return totals;
}

export function characterFrom(entries: StatEntry[]): Character {
  const t = addXp({ xp: 0, slain: 0, stats: emptyStatXp() }, entries);
  const level = levelFromXp(t.xp);
  let top: Stat | null = null;
  for (const s of STATS) if (t.stats[s] > 0 && (top == null || t.stats[s] > t.stats[top])) top = s;
  const className = top ? STAT_INFO[top].className : 'Adventurer';
  return {
    xp: t.xp,
    level,
    slain: t.slain,
    stats: Object.fromEntries(STATS.map((s) => [s, { xp: t.stats[s], value: statValue(t.stats[s]) }])) as Character['stats'],
    className,
    title: `${rankTitle(level.level)} ${className}`,
  };
}

// ---------- Monsters ----------

export type MonsterKind = 'slime' | 'bat' | 'skeleton' | 'goblin' | 'ogre' | 'golem' | 'dragon' | 'wraith';

export interface Monster {
  kind: MonsterKind;
  name: string;
  level: number;
  /** XP it is worth (= the set's XP). */
  xp: number;
  /** Last working set of an exercise: a tougher, crowned monster. */
  elite: boolean;
  /** Set to failure or a personal record attempt. */
  boss: boolean;
  /** The planned set would beat a personal record: the Record Keeper. */
  record: boolean;
}

interface Family {
  kind: MonsterKind;
  names: string[];
  elite: string;
}

const FAMILIES: Record<'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'mobility', Family> = {
  push: { kind: 'golem', names: ['Iron Golem', 'Bench Golem', 'Granite Golem'], elite: 'Ancient Golem' },
  pull: { kind: 'goblin', names: ['Goblin Grappler', 'Goblin Raider', 'Goblin Brute'], elite: 'Goblin Warlord' },
  legs: { kind: 'ogre', names: ['Squat Ogre', 'Hill Ogre', 'Swamp Ogre'], elite: 'Ogre Chieftain' },
  core: { kind: 'skeleton', names: ['Skeleton Guard', 'Crypt Skeleton', 'Bone Knight'], elite: 'Lich Knight' },
  cardio: { kind: 'bat', names: ['Cave Bat', 'Vampire Bat', 'Shadow Bat'], elite: 'Bat Queen' },
  mobility: { kind: 'skeleton', names: ['Stiff Skeleton', 'Creaky Skeleton', 'Rusty Skeleton'], elite: 'Skeleton King' },
};

const PUSH_PARTS = new Set<BodyPart>(['Chest', 'Shoulders', 'Triceps']);

function familyFor(e: StatSource): Family {
  const category = exerciseCategory(e);
  if (category === 'stretching') return FAMILIES.mobility;
  if (category === 'cardio' || e.bodyPart === 'Cardio') return FAMILIES.cardio;
  if (LEG_PARTS.has(e.bodyPart)) return FAMILIES.legs;
  if (e.bodyPart === 'Core') return FAMILIES.core;
  if (PUSH_PARTS.has(e.bodyPart)) return FAMILIES.push;
  return FAMILIES.pull;
}

/** Fills a planned set's blank fields from last session's matching set, as ticking it would. */
function plannedSet(s: SetData, previous: SetData | undefined): SetData {
  if (!previous) return s;
  return {
    ...s,
    weight: s.weight ?? previous.weight,
    reps: s.reps ?? previous.reps,
    durationS: s.durationS ?? previous.durationS,
    distanceM: s.distanceM ?? previous.distanceM,
  };
}

/** Whether a set would beat the exercise's records (none without earlier history). */
export function beatsRecord(type: ExerciseType, s: SetData, records: Records | null | undefined): boolean {
  if (!records || s.setType === 'warmup') return false;
  return newRecords(type, records, computeRecords(type, [s])).length > 0;
}

/**
 * The monster guarding set `index` of an exercise. `records` are the exercise's bests before this
 * workout: a set planned to beat them is guarded by the Record Keeper.
 */
export function monsterFor(
  e: StatSource,
  sets: SetData[],
  index: number,
  previous: SetData[] = [],
  records?: Records | null,
): Monster {
  const s = plannedSet(sets[index], previous[index]);
  const xp = setXp(e.type, s);
  const level = Math.max(1, Math.round(xp / 4));
  const base = { level, xp, elite: false, boss: false, record: false };
  if (s.setType === 'warmup') return { ...base, kind: 'slime', name: 'Warm-up Slime' };
  if (beatsRecord(e.type, s, records)) return { ...base, kind: 'wraith', name: 'Record Keeper', boss: true, record: true };
  if (s.setType === 'failure') return { ...base, kind: 'dragon', name: 'Dragon of Failure', boss: true };
  const family = familyFor(e);
  const working = sets.map((x, i) => (x.setType === 'warmup' ? -1 : i)).filter((i) => i >= 0);
  const elite = working.length >= 2 && working[working.length - 1] === index;
  const nth = working.indexOf(index);
  const name = elite ? family.elite : family.names[Math.max(0, nth) % family.names.length];
  return { ...base, kind: family.kind, name, elite };
}

// ---------- The dungeon (a live workout) ----------

export interface Encounter {
  exerciseKey: string;
  setKey: string;
  exerciseIndex: number;
  setIndex: number;
  /** 1-based room number: an exercise, or a superset done together. */
  room: number;
  rooms: number;
}

/** Groups exercise indexes into rooms: single exercises, or consecutive ones in the same superset. */
export function dungeonRooms(w: ActiveWorkout): number[][] {
  const rooms: number[][] = [];
  w.exercises.forEach((e, i) => {
    const prev = w.exercises[i - 1];
    if (e.supersetId && prev?.supersetId === e.supersetId) rooms[rooms.length - 1].push(i);
    else rooms.push([i]);
  });
  return rooms;
}

/**
 * The next set to do: the first room with sets left. Within a superset, rounds alternate between
 * its exercises, so the exercise furthest behind (earliest in the list on a tie) goes next.
 */
export function nextEncounter(w: ActiveWorkout): Encounter | null {
  const rooms = dungeonRooms(w);
  for (let r = 0; r < rooms.length; r++) {
    let best: { exerciseIndex: number; setIndex: number } | null = null;
    for (const i of rooms[r]) {
      const setIndex = w.exercises[i].sets.findIndex((s) => !s.completed);
      if (setIndex >= 0 && (best == null || setIndex < best.setIndex)) best = { exerciseIndex: i, setIndex };
    }
    if (best) {
      const ex = w.exercises[best.exerciseIndex];
      return { ...best, exerciseKey: ex.key, setKey: ex.sets[best.setIndex].key, room: r + 1, rooms: rooms.length };
    }
  }
  return null;
}

/** Sets completed / total in a live workout. */
export function dungeonProgress(w: ActiveWorkout): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const e of w.exercises) {
    total += e.sets.length;
    done += e.sets.filter((s: ActiveSet) => s.completed).length;
  }
  return { done, total };
}

// ---------- Achievements ----------

export interface AchievementEntry extends StatEntry {
  workoutId: number;
  startedAt: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Ionicons name. */
  icon: string;
  progress: number;
  target: number;
  unlocked: boolean;
}

const WEEK_MS = 7 * 86_400_000;

/** Longest run of consecutive calendar weeks with at least one workout. */
export function longestWeekStreak(times: number[]): number {
  const weeks = [...new Set(times.map(startOfWeek))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  weeks.forEach((w, i) => {
    // Rounding absorbs the hour that daylight saving adds or removes.
    run = i > 0 && Math.round((w - weeks[i - 1]) / WEEK_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Badges earned from the whole history, each with progress toward it. */
export function achievementsFrom(entries: AchievementEntry[]): Achievement[] {
  const c = characterFrom(entries);
  const workouts = new Map<number, number>();
  let failures = 0;
  let heaviest = 0;
  let farthest = 0;
  let stretches = 0;
  for (const e of entries) {
    workouts.set(e.workoutId, e.startedAt);
    const s = e.set;
    if (s.setType === 'warmup') continue;
    if (s.setType === 'failure') failures++;
    if ((e.type === 'weight_reps' || e.type === 'weighted_bodyweight') && (s.reps ?? 0) > 0) {
      heaviest = Math.max(heaviest, s.weight ?? 0);
    }
    farthest = Math.max(farthest, s.distanceM ?? 0);
    if (statShares(e).WIS) stretches++;
  }
  const minStat = Math.min(...STATS.map((s) => c.stats[s].value));
  const list: Omit<Achievement, 'unlocked'>[] = [
    { id: 'first', name: 'First Blood', description: 'Finish your first workout', icon: 'flag', progress: workouts.size, target: 1 },
    { id: 'hunter', name: 'Monster Hunter', description: 'Slay 100 monsters', icon: 'skull', progress: c.slain, target: 100 },
    { id: 'dragon', name: 'Dragon Slayer', description: 'Beat a Dragon of Failure (a set to failure)', icon: 'flame', progress: failures, target: 1 },
    { id: 'streak', name: 'Iron Will', description: 'Train 4 weeks in a row', icon: 'calendar', progress: longestWeekStreak([...workouts.values()]), target: 4 },
    { id: 'centurion', name: 'Centurion', description: 'Lift 100 kg (220 lb) in one set', icon: 'barbell', progress: heaviest, target: 100 },
    { id: 'wanderer', name: 'Wanderer', description: 'Cover 5 km in one set', icon: 'walk', progress: farthest, target: 5000 },
    { id: 'zen', name: 'Zen Master', description: 'Complete 50 stretching sets', icon: 'leaf', progress: stretches, target: 50 },
    { id: 'veteran', name: 'Veteran', description: 'Reach level 10', icon: 'star', progress: c.level.level, target: 10 },
    { id: 'balanced', name: 'Renaissance Hero', description: 'Raise every attribute to 5', icon: 'diamond', progress: minStat, target: 5 },
    { id: 'regular', name: 'Dungeon Regular', description: 'Finish 50 workouts', icon: 'trophy', progress: workouts.size, target: 50 },
    { id: 'legend', name: 'Legendary Slayer', description: 'Slay 1,000 monsters', icon: 'skull', progress: c.slain, target: 1000 },
  ];
  return list.map((a) => ({ ...a, progress: Math.min(a.progress, a.target), unlocked: a.progress >= a.target }));
}
