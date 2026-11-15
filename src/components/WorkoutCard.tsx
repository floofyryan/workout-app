import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { totalVolume } from '@/lib/calc';
import { formatDate, formatDuration, formatNumber } from '@/lib/format';
import { bestSet, formatSet } from '@/lib/setFormat';
import type { WorkoutReward } from '@/lib/rpg';
import { colors, spacing } from '@/lib/theme';
import type { UnitSystem, WorkoutDetail } from '@/lib/types';
import { kgToDisplay, weightUnit } from '@/lib/units';
import { Card } from './ui';

export function workoutVolume(w: WorkoutDetail): number {
  return w.exercises.reduce((sum, e) => sum + totalVolume(e.exercise.type, e.sets), 0);
}

/** History card: name, date, stats and a two-column "Exercise | Best set" summary. */
export function WorkoutCard({
  workout,
  units,
  onPress,
  onLongPress,
  reward,
}: {
  workout: WorkoutDetail;
  units: UnitSystem;
  /** What the workout earned; adds "+N XP" and a level-up marker. */
  reward?: WorkoutReward;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const volume = workoutVolume(workout);
  return (
    <Card style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.top}>
        <Text style={[styles.name, { flex: 1 }]}>{workout.name}</Text>
        {reward && reward.total > 0 ? (
          <View style={styles.xp}>
            <Ionicons name="flash" size={13} color={colors.xp} />
            <Text style={styles.xpText}>+{formatNumber(reward.total)} XP</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.top}>
        <Text style={[styles.date, { flex: 1 }]}>{formatDate(workout.startedAt)}</Text>
        {reward && reward.levelAfter > reward.levelBefore ? (
          <View style={styles.levelUp}>
            <Ionicons name="arrow-up-circle" size={12} color={colors.xp} />
            <Text style={styles.levelUpText}>
              Level {reward.levelBefore} → {reward.levelAfter}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.stats}>
        <Stat icon="time-outline" text={formatDuration((workout.endedAt - workout.startedAt) / 1000)} />
        {volume > 0 && (
          <Stat icon="barbell-outline" text={`${formatNumber(kgToDisplay(volume, units))} ${weightUnit(units)}`} />
        )}
        <Stat icon="list-outline" text={`${workout.exercises.reduce((n, e) => n + e.sets.length, 0)} sets`} />
      </View>
      <View style={styles.header}>
        <Text style={[styles.headerText, { flex: 3 }]}>Exercise</Text>
        <Text style={[styles.headerText, { flex: 2 }]}>Best set</Text>
      </View>
      {workout.exercises.map((e) => {
        const best = bestSet(e.exercise.type, e.sets);
        return (
          <View key={e.id} style={styles.line}>
            <Text style={[styles.lineText, { flex: 3 }]} numberOfLines={1}>
              {e.sets.length} × {e.exercise.name}
            </Text>
            <Text style={[styles.lineText, styles.best, { flex: 2 }]} numberOfLines={1}>
              {best ? formatSet(e.exercise.type, best, units) : '–'}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

function Stat({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Text style={styles.statText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: spacing.sm },
  xpText: { color: colors.xp, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  levelUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing.sm,
    marginTop: 2,
    backgroundColor: colors.xpDim,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  levelUpText: { color: colors.xp, fontSize: 11, fontWeight: '800' },
  date: { color: colors.muted, fontSize: 13, marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: 'row', marginTop: spacing.md, marginBottom: 2 },
  headerText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  line: { flexDirection: 'row', paddingVertical: 2 },
  lineText: { color: colors.muted, fontSize: 13 },
  best: { color: colors.muted },
});
