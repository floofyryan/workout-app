import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';

/** Countdown shown while resting between sets, with ±15s and skip controls. */
export function RestTimerBar() {
  const { restTimer, adjustRest, stopRest } = useActiveWorkout();
  const now = useNow(250);
  if (!restTimer) return null;
  const remaining = Math.max(0, Math.ceil((restTimer.endsAt - now) / 1000));
  const progress = Math.min(1, Math.max(0, remaining / restTimer.duration));

  return (
    <View style={styles.container}>
      <View style={[styles.progress, { width: `${progress * 100}%` }]} />
      <View style={styles.content}>
        <Pressable onPress={() => adjustRest(-15)} style={styles.btn} hitSlop={6}>
          <Text style={styles.btnText}>−15</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.label}>Rest</Text>
          <Text style={styles.time}>{formatClock(remaining)}</Text>
        </View>
        <Pressable onPress={() => adjustRest(15)} style={styles.btn} hitSlop={6}>
          <Text style={styles.btnText}>+15</Text>
        </Pressable>
        <Pressable onPress={stopRest} style={[styles.btn, styles.skip]} hitSlop={6}>
          <Text style={[styles.btnText, { color: '#fff' }]}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  progress: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.primary, opacity: 0.6 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { color: '#dbeafe', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  time: { color: '#fff', fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  btn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  skip: { backgroundColor: 'rgba(0,0,0,0.25)' },
  btnText: { color: '#fff', fontWeight: '700' },
});
