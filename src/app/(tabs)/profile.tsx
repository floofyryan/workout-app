import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/Charts';
import { Card, IconButton, ListItem, SectionTitle, Stat } from '@/components/ui';
import { WorkoutCard } from '@/components/WorkoutCard';
import { listWorkouts, workoutCount, workoutStartTimes } from '@/db/repo';
import { formatShortDate, startOfDay, startOfWeek } from '@/lib/format';
import { useFocusQuery, useNow } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import { useSettings } from '@/state/SettingsContext';

const WEEKS = 12;
const WEEK_MS = 7 * 86_400_000;

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { settings } = useSettings();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton name="settings-outline" onPress={() => router.push('/settings')} style={{ marginRight: spacing.lg }} />
      ),
    });
  }, [navigation]);

  const [data] = useFocusQuery(async (db) => {
    const since = startOfWeek(Date.now()) - (WEEKS * 4 - 1) * WEEK_MS;
    return {
      total: await workoutCount(db),
      starts: await workoutStartTimes(db, since),
      recent: await listWorkouts(db, 1),
    };
  });

  const now = useNow(60_000);
  const stats = useMemo(() => {
    const thisWeek = startOfWeek(now);
    const perWeek = new Map<number, number>();
    for (const t of data?.starts ?? []) {
      const w = startOfWeek(t);
      perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
    }
    const bars = Array.from({ length: WEEKS }, (_, i) => {
      // Week starts can shift by an hour across DST changes, so normalise via startOfWeek.
      const w = startOfWeek(thisWeek - (WEEKS - 1 - i) * WEEK_MS + WEEK_MS / 2);
      return { label: formatShortDate(w), value: perWeek.get(w) ?? 0 };
    });
    // Consecutive weeks (including this one if it has a workout) with at least one workout.
    let streak = 0;
    let w = perWeek.get(thisWeek) ? thisWeek : startOfWeek(thisWeek - WEEK_MS / 2);
    while (perWeek.get(w)) {
      streak++;
      w = startOfWeek(w - WEEK_MS / 2);
    }
    const days = new Set((data?.starts ?? []).map(startOfDay));
    return { bars, thisWeek: perWeek.get(thisWeek) ?? 0, streak, days };
  }, [data, now]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={{ flexDirection: 'row' }}>
        <Stat label="Workouts" value={String(data?.total ?? 0)} />
        <Stat label="This week" value={String(stats.thisWeek)} />
        <Stat label="Week streak" value={String(stats.streak)} />
      </Card>

      <SectionTitle>Workouts per week</SectionTitle>
      <Card>
        <BarChart data={stats.bars} />
      </Card>

      <SectionTitle>{monthName()}</SectionTitle>
      <Card>
        <MonthCalendar days={stats.days} />
      </Card>

      {data?.recent[0] && (
        <>
          <SectionTitle>Last workout</SectionTitle>
          <WorkoutCard
            workout={data.recent[0]}
            units={settings.units}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(data.recent[0].id) } })}
          />
        </>
      )}

      <SectionTitle>Tools</SectionTitle>
      <View style={styles.list}>
        <ListItem icon="disc-outline" title="Plate calculator" onPress={() => router.push('/tools/plates')} />
        <ListItem icon="calculator-outline" title="1RM calculator" onPress={() => router.push('/tools/one-rep-max')} />
        <ListItem icon="settings-outline" title="Settings, import & export" onPress={() => router.push('/settings')} />
      </View>
    </ScrollView>
  );
}

function monthName() {
  return new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

/** Current month with workout days highlighted. */
function MonthCalendar({ days }: { days: Set<number> }) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday first
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const today = now.getDate();

  return (
    <View>
      <View style={styles.calRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={[styles.calCell, styles.calHead]}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.calRow}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            const trained = d != null && days.has(new Date(now.getFullYear(), now.getMonth(), d).getTime());
            return (
              <View key={i} style={styles.calCell}>
                {d != null && (
                  <View style={[styles.calDay, trained && styles.calTrained, d === today && styles.calToday]}>
                    <Text style={[styles.calText, trained && { color: '#fff', fontWeight: '700' }]}>{d}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  list: { borderRadius: radius.lg, overflow: 'hidden' },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  calHead: { color: colors.faint, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  calDay: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calTrained: { backgroundColor: colors.primary },
  calToday: { borderWidth: 1.5, borderColor: colors.success },
  calText: { color: colors.muted, fontSize: 13 },
});
