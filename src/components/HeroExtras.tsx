// Extra panels for the Hero tab: the monthly boss, the daily quest, recovery, streak and XP history.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatMonth, formatNumber, formatShortDate } from '@/lib/format';
import { useExerciseMap } from '@/lib/hooks';
import { STAT_INFO, STATS, type Progress, type RecoveryState } from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';
import { clean, formatWeight } from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';
import { LineChart } from './Charts';
import { XpBar } from './Hero';
import { Card } from './ui';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MAX_TOKENS = 2;

const dangerDim = 'rgba(239,68,68,0.14)';
const dangerBorder = 'rgba(239,68,68,0.4)';
const warningDim = 'rgba(245,158,11,0.14)';
const successDim = 'rgba(34,197,94,0.14)';

/** `now` if given, otherwise the time the component mounted (kept out of render to stay pure). */
function useNow(now?: number): number {
  const [mountedAt] = useState(() => Date.now());
  return now ?? mountedAt;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- Boss ----------

/** This month's boss fight: beat the target est. 1RM on one lift. Tapping opens the exercise. */
export function BossCard({ progress, now }: { progress: Progress; now?: number }) {
  const { boss } = progress;
  const { settings } = useSettings();
  const at = useNow(now);
  const exercises = useExerciseMap(boss ? [boss.exerciseId] : []);

  if (!boss) {
    return (
      <Card style={styles.row}>
        <View style={styles.iconTile}>
          <Ionicons name="skull-outline" size={22} color={colors.faint} />
        </View>
        <View style={styles.body}>
          <Text style={styles.emptyTitle}>No boss yet</Text>
          <Text style={styles.small}>
            Log a few weighted lifts and a boss will appear each month: one lift, one est. 1RM to beat.
          </Text>
        </View>
      </Card>
    );
  }

  const name = exercises.get(boss.exerciseId)?.name ?? 'Boss lift';
  const span = boss.targetE1rm - boss.baselineE1rm;
  const attempted = boss.bestE1rm > 0;
  const fraction = boss.defeated
    ? 1
    : !attempted
      ? 0
      : span > 0
        ? Math.min(1, Math.max(0, (boss.bestE1rm - boss.baselineE1rm) / span))
        : boss.bestE1rm >= boss.targetE1rm
          ? 1
          : 0;
  const start = new Date(boss.month);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime();
  const daysLeft = Math.ceil((monthEnd - at) / DAY_MS);
  const timeLeft = daysLeft <= 0 ? 'Month over' : daysLeft === 1 ? 'Last day' : `${daysLeft} days left`;
  const accent = boss.defeated ? colors.success : colors.danger;
  const weight = (kg: number) => formatWeight(kg, settings.units);

  return (
    <Card
      style={[styles.boss, { borderColor: boss.defeated ? colors.successDim : dangerBorder }]}
      onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(boss.exerciseId) } })}
    >
      <View style={styles.row}>
        <View style={[styles.iconTile, { backgroundColor: boss.defeated ? successDim : dangerDim }]}>
          <Ionicons name={boss.defeated ? 'skull-outline' : 'skull'} size={24} color={accent} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: accent }]}>BOSS · {formatMonth(boss.month).toUpperCase()}</Text>
          <Text style={[styles.bossName, boss.defeated && styles.struck]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {boss.defeated ? (
          <View style={styles.defeated}>
            <Text style={styles.defeatedText}>DEFEATED</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        )}
      </View>

      <Text style={styles.bossGoal}>
        {boss.defeated ? 'Beaten with ' : 'Hit an est. 1RM of '}
        <Text style={styles.bossGoalValue}>{weight(boss.defeated ? boss.bestE1rm : boss.targetE1rm)}</Text>
        {boss.defeated ? ` · target ${weight(boss.targetE1rm)}` : ''}
      </Text>

      <XpBar progress={fraction} color={accent} height={10} style={{ marginTop: spacing.sm }} />
      <View style={[styles.rowBetween, { marginTop: 4 }]}>
        <Text style={styles.tiny}>{weight(boss.baselineE1rm)}</Text>
        <Text style={styles.tiny}>
          {attempted ? `Best this month ${weight(boss.bestE1rm)}` : 'Not attempted this month'}
        </Text>
        <Text style={styles.tiny}>{weight(boss.targetE1rm)}</Text>
      </View>

      <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
        <View style={styles.row}>
          <Ionicons
            name={boss.defeated ? 'trophy' : 'hourglass-outline'}
            size={13}
            color={boss.defeated ? colors.xp : colors.muted}
          />
          <Text style={styles.meta}>
            {' '}
            {boss.defeated
              ? `${progress.bossesDefeated} ${progress.bossesDefeated === 1 ? 'boss' : 'bosses'} defeated`
              : timeLeft}
          </Text>
        </View>
        <Text style={[styles.reward, boss.defeated && { color: colors.success }]}>
          +{formatNumber(boss.reward)} XP{boss.defeated ? ' earned' : ''}
        </Text>
      </View>
    </Card>
  );
}

// ---------- Daily quest ----------

/** Today's quest as a single row; a sibling of the rows in QuestList. */
export function DailyQuestCard({ progress }: { progress: Progress }) {
  const q = progress.daily;
  const accent = q.stat ? STAT_INFO[q.stat].color : colors.primary;
  const fraction = q.target > 0 ? Math.min(1, Math.max(0, q.progress / q.target)) : q.done ? 1 : 0;
  return (
    <Card style={styles.daily}>
      <Ionicons name={q.done ? 'checkmark-circle' : 'sunny-outline'} size={24} color={q.done ? colors.success : accent} />
      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <Text style={[styles.questTitle, q.done && styles.questDone]}>{q.title}</Text>
        <Text style={styles.small}>
          {q.stat ? <Text style={{ color: accent, fontWeight: '700' }}>{STAT_INFO[q.stat].name} · </Text> : null}
          {q.description}
          {q.target > 1 ? ` · ${formatNumber(Math.min(q.progress, q.target))}/${formatNumber(q.target)}` : ''}
        </Text>
        {!q.done && <XpBar progress={fraction} color={accent} height={4} style={{ marginTop: 5 }} />}
      </View>
      <Text style={[styles.reward, q.done && { color: colors.success }]}>+{formatNumber(q.reward)} XP</Text>
    </Card>
  );
}

// ---------- Recovery ----------

const RECOVERY: Record<RecoveryState, { label: string; color: string; background: string }> = {
  rested: { label: 'Rested · +10% XP', color: colors.success, background: successDim },
  recovering: { label: 'Recovering', color: colors.warning, background: warningDim },
  fatigued: { label: 'Fatigued', color: colors.danger, background: dangerDim },
};

function trainedAgo(lastTrainedAt: number | null, now: number): string {
  if (lastTrainedAt == null) return 'not trained yet';
  const elapsed = Math.max(0, now - lastTrainedAt);
  if (elapsed < HOUR_MS) return 'trained just now';
  if (elapsed < 2 * DAY_MS) return `trained ${Math.floor(elapsed / HOUR_MS)}h ago`;
  return `trained ${Math.floor(elapsed / DAY_MS)}d ago`;
}

/** How recovered the muscles behind each stat are; rested ones earn bonus set XP. */
export function RecoveryCard({ progress, now }: { progress: Progress; now?: number }) {
  const at = useNow(now);
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      {STATS.map((s, i) => {
        const info = STAT_INFO[s];
        const { lastTrainedAt, state } = progress.recovery[s];
        const pill = RECOVERY[state];
        return (
          <View key={s} style={[styles.recoveryRow, i > 0 && styles.rowBorder]}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={[styles.statName, { color: info.color }]} numberOfLines={1}>
                {info.name}
              </Text>
              <Text style={styles.tiny} numberOfLines={1}>
                {trainedAgo(lastTrainedAt, at)}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: pill.background }]}>
              <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// ---------- Streak ----------

/** The weekly streak, the best one so far, and the tokens that protect it. */
export function StreakCard({ progress }: { progress: Progress }) {
  const { streakWeeks, bestStreak } = progress;
  const tokens = Math.min(MAX_TOKENS, Math.max(0, Math.floor(progress.streakTokens)));
  const active = streakWeeks > 0;
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.iconTile, active && { backgroundColor: warningDim }]}>
          <Ionicons name={active ? 'flame' : 'flame-outline'} size={24} color={active ? colors.warning : colors.faint} />
        </View>
        <View style={styles.body}>
          <Text style={styles.streakValue}>{active ? `${streakWeeks}-week streak` : 'No streak yet'}</Text>
          <Text style={styles.small}>
            {bestStreak > 0 ? `Best: ${plural(bestStreak, 'week')}` : 'Train this week to start one'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.row} accessibilityLabel={`${tokens} of ${MAX_TOKENS} streak tokens`}>
            {Array.from({ length: MAX_TOKENS }, (_, i) => (
              <Ionicons
                key={i}
                name={i < tokens ? 'shield' : 'shield-outline'}
                size={22}
                color={i < tokens ? colors.xp : colors.faint}
                style={{ marginLeft: 4 }}
              />
            ))}
          </View>
          <Text style={[styles.tiny, { marginTop: 2 }]}>
            {tokens}/{MAX_TOKENS} tokens
          </Text>
        </View>
      </View>
      <Text style={[styles.small, { marginTop: spacing.md }]}>
        A token saves your streak through one missed week. Earn one every 4 weeks.
      </Text>
    </Card>
  );
}

// ---------- XP over time ----------

const compactXp = (v: number) => (Math.abs(v) >= 10_000 ? `${clean(v / 1000, 1)}k` : formatNumber(Math.round(v)));

/** Total XP after each workout, with how much was earned in the last 30 days. */
export function XpChart({ progress, now }: { progress: Progress; now?: number }) {
  const at = useNow(now);
  const { timeline } = progress;
  if (timeline.length < 2) {
    return (
      <Card style={styles.chartEmpty}>
        <Ionicons name="trending-up" size={22} color={colors.faint} />
        <Text style={[styles.small, { marginTop: spacing.sm, textAlign: 'center' }]}>
          {timeline.length === 0
            ? 'Finish a workout to start your XP history.'
            : 'One more workout and your XP history will show up here.'}
        </Text>
      </Card>
    );
  }
  const cutoff = at - 30 * DAY_MS;
  let before = 0;
  for (const p of timeline) {
    if (p.at >= cutoff) break;
    before = p.xp;
  }
  const gained = Math.max(0, timeline[timeline.length - 1].xp - before);
  return (
    <Card>
      <View style={[styles.row, { marginBottom: spacing.sm }]}>
        <Ionicons name="flash" size={15} color={colors.xp} />
        <Text style={styles.chartCaption}>
          {' '}
          <Text style={{ color: colors.xp, fontWeight: '800' }}>+{formatNumber(gained)} XP</Text> in the last 30 days
        </Text>
      </View>
      <LineChart
        data={timeline.map((p) => ({ x: p.at, y: p.xp }))}
        height={170}
        color={colors.xp}
        formatX={formatShortDate}
        formatY={compactXp}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  body: { flex: 1, marginHorizontal: spacing.md },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  small: { color: colors.muted, fontSize: 12, marginTop: 1 },
  tiny: { color: colors.faint, fontSize: 11, fontVariant: ['tabular-nums'] },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  reward: { color: colors.xp, fontSize: 13, fontWeight: '800' },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },

  boss: { borderWidth: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  bossName: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 1 },
  struck: { color: colors.muted, textDecorationLine: 'line-through' },
  bossGoal: { color: colors.muted, fontSize: 13, marginTop: spacing.md },
  bossGoalValue: { color: colors.text, fontWeight: '800' },
  defeated: {
    borderWidth: 1.5,
    borderColor: colors.success,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ rotate: '-6deg' }],
  },
  defeatedText: { color: colors.success, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },

  daily: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  questTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  questDone: { color: colors.muted, textDecorationLine: 'line-through' },

  recoveryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  statName: { fontSize: 14, fontWeight: '800' },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },

  streakValue: { color: colors.text, fontSize: 18, fontWeight: '800' },

  chartEmpty: { alignItems: 'center', paddingVertical: spacing.xl },
  chartCaption: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
