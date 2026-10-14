import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionSheet } from '@/components/Sheets';
import { Button, Card, SectionTitle } from '@/components/ui';
import { deleteTemplate, duplicateTemplate, listTemplates } from '@/db/repo';
import { useExerciseMap, useFocusQuery } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';
import type { Template } from '@/lib/types';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';

function daysAgo(ts: number | null): string {
  if (!ts) return 'Never performed';
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days === 0) return 'Last performed today';
  if (days === 1) return 'Last performed yesterday';
  return `Last performed ${days} days ago`;
}

export default function StartWorkoutScreen() {
  const db = useSQLiteContext();
  const { workout, start } = useActiveWorkout();
  const [templates, reload] = useFocusQuery(listTemplates);
  const [selected, setSelected] = useState<Template | null>(null);
  const exercises = useExerciseMap((templates ?? []).flatMap((t) => t.exercises.map((e) => e.exerciseId)));

  const begin = (template?: Template) => {
    const go = () => {
      start(template);
      router.push('/active-workout');
    };
    if (!workout) return go();
    Alert.alert('Workout in progress', 'You already have a workout in progress.', [
      { text: 'Resume', onPress: () => router.push('/active-workout') },
      { text: 'Discard & start new', style: 'destructive', onPress: go },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <SectionTitle>Quick start</SectionTitle>
      <Button title={workout ? 'Resume Workout' : 'Start an Empty Workout'} onPress={() => (workout ? router.push('/active-workout') : begin())} />

      <SectionTitle
        right={
          <Button
            title="Template"
            icon="add"
            small
            variant="ghost"
            onPress={() => router.push({ pathname: '/template/[id]', params: { id: 'new' } })}
          />
        }
      >
        My templates ({templates?.length ?? 0})
      </SectionTitle>
      <View style={styles.grid}>
        {templates?.map((t) => (
          <Card key={t.id} style={styles.templateCard} onPress={() => setSelected(t)}>
            <Text style={styles.templateName} numberOfLines={1}>
              {t.name}
            </Text>
            {t.exercises.slice(0, 5).map((e, i) => (
              <Text key={i} style={styles.templateLine} numberOfLines={1}>
                {e.sets.length} × {exercises.get(e.exerciseId)?.name ?? '…'}
              </Text>
            ))}
            {t.exercises.length > 5 && <Text style={styles.templateLine}>+{t.exercises.length - 5} more</Text>}
            <Text style={styles.lastUsed}>{daysAgo(t.lastUsedAt)}</Text>
          </Card>
        ))}
      </View>
      {templates?.length === 0 && (
        <Text style={{ color: colors.muted }}>No templates yet. Create one to plan your routine.</Text>
      )}

      <ActionSheet
        visible={!!selected}
        title={selected?.name}
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                { label: 'Start Workout', icon: 'play', onPress: () => begin(selected) },
                {
                  label: 'Edit Template',
                  icon: 'create-outline',
                  onPress: () => router.push({ pathname: '/template/[id]', params: { id: String(selected.id) } }),
                },
                {
                  label: 'Duplicate',
                  icon: 'copy-outline',
                  onPress: async () => {
                    await duplicateTemplate(db, selected.id);
                    reload();
                  },
                },
                {
                  label: 'Delete',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () =>
                    Alert.alert('Delete template?', `"${selected.name}" will be deleted.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteTemplate(db, selected.id);
                          reload();
                        },
                      },
                    ]),
                },
              ]
            : []
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  templateCard: { width: '48.5%', marginBottom: spacing.md, padding: spacing.md, minHeight: 140 },
  templateName: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: spacing.xs },
  templateLine: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lastUsed: { color: colors.faint, fontSize: 11, marginTop: 'auto', paddingTop: spacing.sm },
});
