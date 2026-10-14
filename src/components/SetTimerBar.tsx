import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';

/** Countdown for a timed set (plank, wall sit…). The rest timer starts automatically when it ends. */
export function SetTimerBar() {
  const { setTimer, workout, exercises, adjustSetTimer, finishSetTimer, cancelSetTimer } = useActiveWorkout();
  const now = useNow(250);
  if (!setTimer) return null;

  const ex = workout?.exercises.find((e) => e.key === setTimer.exerciseKey);
  const name = ex ? exercises.get(ex.exerciseId)?.name : undefined;
  const setNo = ex ? ex.sets.findIndex((s) => s.key === setTimer.setKey) + 1 : 0;
  const remaining = Math.max(0, Math.ceil((setTimer.endsAt - now) / 1000));
  const progress = Math.min(1, Math.max(0, 1 - remaining / setTimer.duration));

  return (
    <View style={styles.container}>
      <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      <Text style={styles.title} numberOfLines={1}>
        {name ?? 'Timed set'}
        {setNo > 0 ? ` · Set ${setNo}` : ''}
      </Text>
      <View style={styles.content}>
        <Pressable onPress={() => adjustSetTimer(-15)} style={styles.btn} hitSlop={6}>
          <Text style={styles.btnText}>−15</Text>
        </Pressable>
        <Text style={styles.time}>{formatClock(remaining)}</Text>
        <Pressable onPress={() => adjustSetTimer(15)} style={styles.btn} hitSlop={6}>
          <Text style={styles.btnText}>+15</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={cancelSetTimer} style={[styles.btn, styles.flex]} hitSlop={6}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={finishSetTimer} style={[styles.btn, styles.flex, styles.done]} hitSlop={6}>
          <Text style={[styles.btnText, { color: colors.successDim }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.successDim,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  progress: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.success, opacity: 0.35 },
  title: { color: '#dcfce7', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.xs },
  time: { color: '#fff', fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
  },
  flex: { flex: 1 },
  done: { backgroundColor: '#fff' },
  btnText: { color: '#fff', fontWeight: '700' },
});
