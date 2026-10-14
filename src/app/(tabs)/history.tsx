import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { SectionList, StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/ui';
import { WorkoutCard } from '@/components/WorkoutCard';
import { listWorkouts } from '@/db/repo';
import { formatMonth } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import type { WorkoutDetail } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';

const PAGE = 25;

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const [workouts, setWorkouts] = useState<WorkoutDetail[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reload the first page (keeping the number already loaded) whenever the tab is focused.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const count = Math.max(PAGE, workouts?.length ?? 0);
      listWorkouts(db, count).then((list) => {
        if (!active) return;
        setWorkouts(list);
        setHasMore(list.length === count);
      });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]),
  );

  const loadMore = async () => {
    if (!workouts || !hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = await listWorkouts(db, PAGE, workouts.length);
    setWorkouts([...workouts, ...next]);
    setHasMore(next.length === PAGE);
    setLoadingMore(false);
  };

  const sections: { title: string; data: WorkoutDetail[] }[] = [];
  for (const w of workouts ?? []) {
    const title = formatMonth(w.startedAt);
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(w);
    else sections.push({ title, data: [w] });
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(w) => String(w.id)}
      contentContainerStyle={styles.container}
      stickySectionHeadersEnabled={false}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      renderSectionHeader={({ section }) => (
        <Text style={styles.month}>
          {section.title} · {section.data.length} workout{section.data.length === 1 ? '' : 's'}
        </Text>
      )}
      renderItem={({ item }) => (
        <WorkoutCard
          workout={item}
          units={settings.units}
          onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(item.id) } })}
        />
      )}
      ListEmptyComponent={
        workouts ? (
          <EmptyState
            icon="time-outline"
            title="No workouts yet"
            message="Finished workouts appear here. You can also import your history from Strong in Settings."
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  month: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
