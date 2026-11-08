import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { Achievement } from '@/lib/achievements';
import { formatDate } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import type { IconName } from './ui';

const EARNED_BG = 'rgba(245,158,11,0.15)';

/** An achievement's icon in a circle: gold once earned, grey before. */
export function AchievementBadge({ achievement, size = 40 }: { achievement: Achievement; size?: number }) {
  const earned = achievement.earnedAt != null;
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: earned ? EARNED_BG : colors.cardAlt },
      ]}
    >
      <Ionicons name={achievement.icon as IconName} size={size * 0.5} color={earned ? colors.warning : colors.faint} />
    </View>
  );
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Badge, title and description, then when it was earned or how far along it is. */
export function AchievementRow({ achievement: a }: { achievement: Achievement }) {
  return (
    <View style={styles.row} accessibilityLabel={`achievement-${a.key}`}>
      <AchievementBadge achievement={a} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, a.earnedAt == null && { color: colors.muted }]}>{a.title}</Text>
        <Text style={styles.description}>{a.description}</Text>
        {a.earnedAt != null ? (
          <Text style={styles.earned}>Earned {formatDate(a.earnedAt)}</Text>
        ) : a.progressText ? (
          <View style={styles.progress}>
            <ProgressBar value={a.progress} />
            <Text style={styles.progressText}>{a.progressText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 13, marginTop: 1 },
  earned: { color: colors.warning, fontSize: 12, fontWeight: '600', marginTop: 4 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  progressText: { color: colors.faint, fontSize: 12 },
});
