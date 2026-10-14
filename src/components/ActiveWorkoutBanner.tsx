import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';

/** Bar above the tab bar that returns to the workout in progress. */
export function ActiveWorkoutBanner() {
  const { workout, restTimer, setTimer } = useActiveWorkout();
  const now = useNow(1000);
  if (!workout) return null;
  const rest = restTimer ? Math.max(0, Math.ceil((restTimer.endsAt - now) / 1000)) : null;
  const hold = setTimer ? Math.max(0, Math.ceil((setTimer.endsAt - now) / 1000)) : null;
  return (
    <Pressable style={styles.banner} onPress={() => router.push('/active-workout')}>
      <Ionicons name="chevron-up" size={18} color={colors.text} />
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={styles.name} numberOfLines={1}>
          {workout.name}
        </Text>
        <Text style={styles.time}>
          {formatClock((now - workout.startedAt) / 1000)}
          {rest != null ? `  ·  Rest ${formatClock(rest)}` : ''}
          {hold != null ? `  ·  Hold ${formatClock(hold)}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  time: { color: colors.success, fontSize: 13, fontVariant: ['tabular-nums'] },
});
