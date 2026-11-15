import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { formatNumber } from '@/lib/format';
import {
  heroLevel,
  MAX_LEVEL,
  rankFor,
  STAT_INFO,
  STATS,
  type Achievement,
  type LevelInfo,
  type Progress,
  type QuestStatus,
  type Rank,
  type Stat,
  type WorkoutReward,
} from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';
import { kgToDisplay, weightUnit } from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';
import { Card } from './ui';

// ---------- Small pieces ----------

/** Progress bar that animates to `progress` (0–1), optionally starting from `from`. */
export function XpBar({
  progress,
  from,
  color = colors.xp,
  height = 8,
  delay = 0,
  style,
}: {
  progress: number;
  from?: number;
  color?: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [value] = useState(() => new Animated.Value(from ?? progress));
  useEffect(() => {
    Animated.timing(value, {
      toValue: progress,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, progress, delay]);
  const width = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }, style]}>
      <Animated.View style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  return (
    <View
      style={[styles.rank, { width: size, height: size, borderRadius: size * 0.28, borderColor: rank.color }]}
      accessibilityLabel={`Rank ${rank.letter}`}
    >
      <Text style={{ color: rank.color, fontWeight: '900', fontSize: size * (rank.letter.length > 2 ? 0.3 : rank.letter.length > 1 ? 0.38 : 0.5) }}>
        {rank.letter}
      </Text>
    </View>
  );
}

const xpToGo = (level: LevelInfo) =>
  level.span > 0 ? `${formatNumber(level.into)} / ${formatNumber(level.span)} XP` : `${formatNumber(level.xp)} XP · max level`;

// ---------- Hero summary ----------

/** Compact level bar for the Workout tab: rank, level, XP and this week's quests at a glance. */
export function HeroBar({ progress, name, onPress }: { progress: Progress; name: string; onPress?: () => void }) {
  const questsDone = progress.quests.filter((q) => q.done).length;
  return (
    <Card onPress={onPress} style={styles.heroBar}>
      <RankBadge rank={progress.rank} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={styles.rowBetween}>
          <Text style={styles.heroBarName} numberOfLines={1}>
            {name} <Text style={styles.heroBarLevel}>Lv {progress.level.level}</Text>
          </Text>
          <View style={styles.row}>
            {progress.streakWeeks > 1 && (
              <View style={[styles.row, { marginRight: spacing.sm }]}>
                <Ionicons name="flame" size={14} color={colors.warning} />
                <Text style={styles.heroBarMeta}> {progress.streakWeeks}w</Text>
              </View>
            )}
            <Ionicons name="ribbon" size={14} color={questsDone === progress.quests.length ? colors.xp : colors.faint} />
            <Text style={styles.heroBarMeta}>
              {' '}
              {questsDone}/{progress.quests.length}
            </Text>
          </View>
        </View>
        <XpBar progress={progress.level.progress} style={{ marginTop: 6 }} />
        <Text style={styles.heroBarXp}>{xpToGo(progress.level)}</Text>
      </View>
    </Card>
  );
}

/** The top of the character sheet. */
export function HeroCard({ progress, name, onRename }: { progress: Progress; name: string; onRename: () => void }) {
  const { level, rank } = progress;
  return (
    <Card style={styles.heroCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroName} numberOfLines={1} onPress={onRename} accessibilityHint="Rename your hero">
          {name} <Ionicons name="pencil" size={13} color={colors.faint} />
        </Text>
        <Text style={styles.heroClass}>
          {progress.heroClass.name} · <Text style={{ color: rank.color }}>{rank.title}</Text>
        </Text>
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <RankBadge rank={rank} size={48} />
          <View style={{ marginLeft: spacing.md }}>
            <Text style={styles.levelLabel}>LEVEL</Text>
            <Text style={styles.levelValue}>{level.level}</Text>
          </View>
        </View>
        <XpBar progress={level.progress} height={10} style={{ marginTop: spacing.md }} />
        <Text style={styles.heroBarXp}>{xpToGo(level)}</Text>
        {progress.nextRank && level.level < MAX_LEVEL ? (
          <Text style={styles.nextRank}>
            Rank {progress.nextRank.letter} at level {progress.nextRank.minLevel}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

// ---------- Stats ----------

/** Hexagon chart of the six stat levels. */
export function StatRadar({ stats }: { stats: Record<Stat, LevelInfo> }) {
  const [width, setWidth] = useState(0);
  const size = Math.min(width, 260);
  const c = size / 2;
  const r = c - 34;
  const value = (s: Stat) => stats[s].level - 1 + stats[s].progress;
  // The outer ring is the next multiple of five above the best stat.
  const max = Math.max(5, Math.ceil((Math.max(...STATS.map(value)) + 0.01) / 5) * 5);
  const point = (i: number, fraction: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length;
    return [c + Math.cos(angle) * r * fraction, c + Math.sin(angle) * r * fraction] as const;
  };
  const ring = (fraction: number) => STATS.map((_, i) => point(i, fraction).join(',')).join(' ');
  return (
    <View style={{ alignItems: 'center' }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {size > 0 && (
        <Svg width={size} height={size}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <Polygon key={f} points={ring(f)} fill="none" stroke={colors.border} strokeWidth={1} />
          ))}
          {STATS.map((s, i) => {
            const [x, y] = point(i, 1);
            return <Line key={s} x1={c} y1={c} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />;
          })}
          <Polygon
            points={STATS.map((s, i) => point(i, Math.max(0.04, value(s) / max)).join(',')).join(' ')}
            fill="rgba(251,191,36,0.22)"
            stroke={colors.xp}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {STATS.map((s, i) => {
            const [x, y] = point(i, Math.max(0.04, value(s) / max));
            const [lx, ly] = point(i, 1 + 22 / r);
            return [
              <Circle key={`${s}p`} cx={x} cy={y} r={3.5} fill={STAT_INFO[s].color} />,
              <SvgText key={`${s}n`} x={lx} y={ly - 1} fill={STAT_INFO[s].color} fontSize={11} fontWeight="bold" textAnchor="middle">
                {STAT_INFO[s].short}
              </SvgText>,
              <SvgText key={`${s}l`} x={lx} y={ly + 12} fill={colors.muted} fontSize={11} textAnchor="middle">
                {stats[s].level}
              </SvgText>,
            ];
          })}
        </Svg>
      )}
    </View>
  );
}

export function StatRows({ stats }: { stats: Record<Stat, LevelInfo> }) {
  return (
    <View>
      {STATS.map((s) => {
        const info = STAT_INFO[s];
        const level = stats[s];
        return (
          <View key={s} style={styles.statRow}>
            <View style={styles.rowBetween}>
              <Text style={[styles.statName, { color: info.color }]}>
                {info.name} <Text style={styles.statTrains}>{info.trains}</Text>
              </Text>
              <Text style={styles.statLevel}>Lv {level.level}</Text>
            </View>
            <XpBar progress={level.progress} color={info.color} height={6} style={{ marginTop: 5 }} />
          </View>
        );
      })}
    </View>
  );
}

// ---------- Quests & achievements ----------

export function QuestList({ quests }: { quests: QuestStatus[] }) {
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      {quests.map((q, i) => (
        <View key={q.id} style={[styles.quest, i > 0 && styles.questBorder]}>
          <Ionicons
            name={q.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={q.done ? colors.success : colors.faint}
          />
          <View style={{ flex: 1, marginHorizontal: spacing.md }}>
            <Text style={[styles.questTitle, q.done && styles.questDone]}>{q.title}</Text>
            <Text style={styles.questText}>
              {q.description} · {q.progress}/{q.target}
            </Text>
            {!q.done && <XpBar progress={q.progress / q.target} color={colors.primary} height={4} style={{ marginTop: 5 }} />}
          </View>
          <Text style={[styles.questReward, q.done && { color: colors.success }]}>+{q.reward} XP</Text>
        </View>
      ))}
    </Card>
  );
}

const ACHIEVEMENT_ICONS: Record<Achievement['icon'], React.ComponentProps<typeof Ionicons>['name']> = {
  footsteps: 'footsteps',
  calendar: 'calendar',
  flame: 'flame',
  trophy: 'trophy',
  barbell: 'barbell',
  star: 'star',
  ribbon: 'ribbon',
};

export function AchievementList({ achievements }: { achievements: Achievement[] }) {
  const { settings } = useSettings();
  // Weight goals are kept in kg and shown in the user's unit.
  const amount = (a: Achievement, v: number) => formatNumber(Math.floor(a.weight ? kgToDisplay(v, settings.units) : v));
  // Unlocked first; of the locked ones, only the next step of each kind keeps the list short.
  const seen = new Set<string>();
  const shown = achievements.filter((a) => {
    if (a.unlocked) return true;
    if (seen.has(a.icon)) return false;
    seen.add(a.icon);
    return true;
  });
  const ordered = [...shown.filter((a) => a.unlocked), ...shown.filter((a) => !a.unlocked)];
  return (
    <View style={styles.achievements}>
      {ordered.map((a) => (
        <View key={a.id} style={[styles.achievement, !a.unlocked && { opacity: 0.55 }]}>
          <View style={[styles.achievementIcon, a.unlocked && { backgroundColor: colors.xpDim }]}>
            <Ionicons name={ACHIEVEMENT_ICONS[a.icon]} size={18} color={a.unlocked ? colors.xp : colors.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.achievementTitle} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={styles.achievementText} numberOfLines={2}>
              {a.description.replace('%s', `${amount(a, a.goal)} ${weightUnit(settings.units)}`)}
              {a.unlocked ? '' : ` · ${amount(a, a.value)}/${amount(a, a.goal)}`}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Workout reward ----------

/**
 * What a workout earned. With `celebrate` (right after finishing) the XP bar fills from where it
 * was, and a level-up gets its banner.
 */
export function RewardCard({ reward, celebrate }: { reward: WorkoutReward; celebrate?: boolean }) {
  const after = heroLevel(reward.xpAfter);
  const leveledUp = reward.levelAfter > reward.levelBefore;
  const rankBefore = rankFor(reward.levelBefore);
  const rankAfter = rankFor(reward.levelAfter);
  const lines: [string, number][] = [
    ['Sets', reward.setXp],
    [`Records beaten on ${reward.records} exercise${reward.records === 1 ? '' : 's'}`, reward.recordXp],
    ['Workout complete', reward.workoutXp],
    [`${reward.streakWeeks}-week streak`, reward.streakXp],
    ...reward.quests.map((q): [string, number] => [`Quest: ${q.title}`, q.reward]),
  ];
  return (
    <Card style={[styles.reward, celebrate && leveledUp && { borderColor: colors.xp, borderWidth: 1 }]}>
      {celebrate && leveledUp ? (
        <View style={styles.levelUp}>
          <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
          <Text style={styles.levelUpText}>
            Level {reward.levelBefore} <Ionicons name="arrow-forward" size={15} color={colors.text} /> {reward.levelAfter}
          </Text>
          {rankAfter.letter !== rankBefore.letter && (
            <View style={[styles.row, { marginTop: spacing.sm }]}>
              <RankBadge rank={rankAfter} size={32} />
              <Text style={[styles.rankUp, { color: rankAfter.color }]}>
                Rank {rankAfter.letter} · {rankAfter.title}
              </Text>
            </View>
          )}
        </View>
      ) : null}
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Ionicons name="flash" size={18} color={colors.xp} />
          <Text style={styles.rewardTotal}> +{formatNumber(reward.total)} XP</Text>
        </View>
        <Text style={styles.rewardLevel}>
          {leveledUp && !celebrate ? `Level ${reward.levelBefore} → ${reward.levelAfter}` : `Level ${reward.levelAfter}`}
        </Text>
      </View>
      {celebrate ? (
        <>
          <XpBar
            progress={after.progress}
            from={leveledUp ? 0 : heroLevel(reward.xpBefore).progress}
            delay={400}
            height={10}
            style={{ marginTop: spacing.sm }}
          />
          <Text style={styles.heroBarXp}>{xpToGo(after)}</Text>
        </>
      ) : null}
      <View style={{ marginTop: spacing.sm }}>
        {lines
          .filter(([, xp]) => xp > 0)
          .map(([label, xp]) => (
            <View key={label} style={[styles.rowBetween, { paddingVertical: 2 }]}>
              <Text style={styles.rewardLine}>{label}</Text>
              <Text style={styles.rewardLine}>+{formatNumber(xp)}</Text>
            </View>
          ))}
      </View>
      {reward.stats.length > 0 && (
        <View style={styles.statChips}>
          {reward.stats.map((s) => (
            <View key={s.stat} style={[styles.statChip, { borderColor: STAT_INFO[s.stat].color }]}>
              <Text style={[styles.statChipText, { color: STAT_INFO[s.stat].color }]}>
                {STAT_INFO[s.stat].name} +{formatNumber(s.xp)}
                {s.levelAfter > s.levelBefore ? `  Lv ${s.levelBefore} → ${s.levelAfter}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barTrack: { backgroundColor: colors.cardAlt, overflow: 'hidden', alignSelf: 'stretch' },
  rank: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: colors.background },

  heroBar: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginTop: spacing.sm },
  heroBarName: { color: colors.text, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  heroBarLevel: { color: colors.xp, fontWeight: '800' },
  heroBarMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  heroBarXp: { color: colors.faint, fontSize: 11, marginTop: 4, fontVariant: ['tabular-nums'] },

  heroCard: { flexDirection: 'row', alignItems: 'center' },
  heroName: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroClass: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 2 },
  levelLabel: { color: colors.faint, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  levelValue: { color: colors.xp, fontSize: 32, fontWeight: '900', lineHeight: 34 },
  nextRank: { color: colors.faint, fontSize: 11, marginTop: 2 },

  statRow: { paddingVertical: 7 },
  statName: { fontSize: 14, fontWeight: '800', flex: 1 },
  statTrains: { color: colors.faint, fontSize: 12, fontWeight: '400' },
  statLevel: { color: colors.text, fontSize: 13, fontWeight: '700', marginLeft: spacing.sm },

  quest: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  questBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  questTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  questDone: { color: colors.muted, textDecorationLine: 'line-through' },
  questText: { color: colors.muted, fontSize: 12, marginTop: 1 },
  questReward: { color: colors.xp, fontSize: 13, fontWeight: '800' },

  achievements: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  achievement: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  achievementIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
    marginRight: spacing.sm,
  },
  achievementTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  achievementText: { color: colors.muted, fontSize: 11 },

  reward: { marginTop: spacing.lg },
  levelUp: { alignItems: 'center', backgroundColor: colors.xpDim, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  levelUpTitle: { color: colors.xp, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  levelUpText: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  rankUp: { fontSize: 15, fontWeight: '800', marginLeft: spacing.sm },
  rewardTotal: { color: colors.xp, fontSize: 18, fontWeight: '800' },
  rewardLevel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  rewardLine: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  statChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  statChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statChipText: { fontSize: 12, fontWeight: '700' },
});
