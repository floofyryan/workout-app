import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { WEEKDAY_SHORT, weekProgress, type PlanDay, type PlanStatus } from '@/lib/plan';
import { colors, radius, spacing } from '@/lib/theme';
import type { Template } from '@/lib/types';

const STATUS_COLOR: Record<PlanStatus, string> = {
  done: colors.success,
  missed: colors.danger,
  today: colors.primary,
  upcoming: colors.faint,
  inactive: colors.border,
};

/** "This week" on the Workout tab: a day strip with progress and today's planned templates. */
export function WeekPlanCard({
  week,
  templates,
  onStart,
}: {
  week: PlanDay[];
  templates: Map<number, Template>;
  onStart: (t: Template) => void;
}) {
  const { done, total } = weekProgress(week);

  if (week.every((d) => d.sessions.length === 0)) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Plan your week</Text>
        <Text style={styles.muted}>
          Schedule templates on the days you train, or generate a program for the equipment you have.
        </Text>
        <View style={styles.actions}>
          <Button title="Generate" icon="sparkles-outline" small onPress={() => router.push('/generate')} />
          <Button title="Set up plan" icon="calendar-outline" small variant="secondary" onPress={() => router.push('/plan')} />
        </View>
      </Card>
    );
  }

  const today = week.find((d) => d.isToday);
  const open = today?.sessions.filter((s) => s.status !== 'done') ?? [];
  const missed = week.flatMap((d) => d.sessions).filter((s) => s.status === 'missed');

  return (
    <Card style={styles.card} onPress={() => router.push('/plan')}>
      <View style={styles.header}>
        <Text style={styles.title}>This week</Text>
        {total > 0 && (
          <Text style={styles.progress}>
            {done}/{total} done
          </Text>
        )}
      </View>

      <View style={styles.strip}>
        {week.map((d) => (
          <View key={d.weekday} style={[styles.dayCell, d.isToday && styles.todayCell]}>
            <Text style={[styles.dayLabel, d.isToday && { color: colors.text }]}>{WEEKDAY_SHORT[d.weekday][0]}</Text>
            <View style={styles.dots}>
              {d.sessions.length === 0 && d.extraWorkouts === 0 ? (
                <View style={[styles.dot, styles.restDot]} />
              ) : (
                <>
                  {d.sessions.map((s, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: STATUS_COLOR[s.status] }]} />
                  ))}
                  {Array.from({ length: d.extraWorkouts }, (_, i) => (
                    <View key={`x${i}`} style={[styles.dot, { backgroundColor: colors.purple }]} />
                  ))}
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      {today && today.sessions.length === 0 && <Text style={styles.muted}>Rest day today.</Text>}
      {today && today.sessions.length > 0 && open.length === 0 && (
        <Text style={[styles.muted, { color: colors.success }]}>Today&apos;s plan is done. Nice work!</Text>
      )}
      {open.map((s, i) => {
        const t = templates.get(s.templateId);
        if (!t) return null;
        return (
          <Pressable key={i} style={({ pressed }) => [styles.todayRow, pressed && { opacity: 0.7 }]} onPress={() => onStart(t)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayKicker}>Today</Text>
              <Text style={styles.todayName} numberOfLines={1}>
                {t.name}
              </Text>
            </View>
            <Ionicons name="play-circle" size={34} color={colors.primary} />
          </Pressable>
        );
      })}
      {missed.length > 0 && (
        <Text style={styles.missed}>
          Missed: {missed.map((s) => templates.get(s.templateId)?.name ?? '…').join(', ')}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: spacing.xs },
  progress: { color: colors.muted, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  strip: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.sm },
  dayCell: { alignItems: 'center', flex: 1, paddingVertical: 6, borderRadius: radius.sm },
  todayCell: { backgroundColor: colors.cardAlt },
  dayLabel: { color: colors.faint, fontWeight: '700', fontSize: 13 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 6, minHeight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  restDot: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  todayKicker: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  todayName: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  missed: { color: colors.faint, fontSize: 12, marginTop: spacing.sm },
});
