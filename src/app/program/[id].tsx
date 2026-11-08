import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { ActionSheet, PromptModal } from '@/components/Sheets';
import { ReorderSheet } from '@/components/Sortable';
import { Button, Card, IconButton, SectionTitle } from '@/components/ui';
import { deleteProgram, deleteTemplate, duplicateTemplate, getProgram, renameProgram, reorderTemplates } from '@/db/repo';
import { confirmAsync } from '@/lib/dialog';
import { useExerciseMap, useFocusQuery } from '@/lib/hooks';
import { describeProgression, summarizeTargets } from '@/lib/progression';
import { colors, radius, spacing } from '@/lib/theme';
import type { Template } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';
import { useBeginWorkout } from '@/state/useBeginWorkout';

export default function ProgramScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useSettings();
  const begin = useBeginWorkout();
  const [program, reload] = useFocusQuery((db) => getProgram(db, Number(id)), [id]);
  const exercises = useExerciseMap((program?.templates ?? []).flatMap((t) => t.exercises.map((e) => e.exerciseId)));
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);

  if (program === null) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Program not found.</Text>
      </View>
    );
  }
  if (!program) return null;
  const units = settings.units;

  const addWorkout = () =>
    router.push({ pathname: '/template/[id]', params: { id: 'new', programId: String(program.id) } });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: program.name,
          headerRight: () => (
            <IconButton name="ellipsis-horizontal" color={colors.primary} onPress={() => setMenu(true)} accessibilityLabel="Program options" />
          ),
        }}
      />
      {program.notes ? <Text style={styles.notes}>{program.notes}</Text> : null}
      <Text style={styles.hint}>
        Do the workouts in turn. When you finish one, exercises with a progression rule set their own targets for next
        time. Edit a workout to change its exercises or rules.
      </Text>

      <SectionTitle right={<Button title="Workout" icon="add" small variant="ghost" onPress={addWorkout} />}>
        Workouts ({program.templates.length})
      </SectionTitle>
      {program.templates.map((t, i) => {
        const next = t.id === program.nextTemplateId;
        return (
          <Card key={t.id} style={[styles.card, next && styles.nextCard]} onPress={() => setSelected(t)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {i + 1}. {t.name}
              </Text>
              {next ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>UP NEXT</Text>
                </View>
              ) : null}
            </View>
            {t.exercises.length === 0 && <Text style={styles.muted}>No exercises yet.</Text>}
            {t.exercises.map((e, j) => {
              const ex = exercises.get(e.exerciseId);
              return (
                <View key={j} style={styles.exercise}>
                  <View style={styles.exerciseLine}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {ex?.name ?? '…'}
                    </Text>
                    <Text style={styles.muted}>{ex ? summarizeTargets(e.sets, ex.type, units) : ''}</Text>
                  </View>
                  {e.progression && ex ? (
                    <View style={styles.rule}>
                      <Ionicons name="trending-up" size={12} color={colors.success} />
                      <Text style={styles.ruleText}>{describeProgression(e.progression, ex.type, units)}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        );
      })}
      {program.templates.length === 0 && (
        <Text style={styles.muted}>No workouts yet. Add one, then give its exercises progression rules.</Text>
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
                  label: 'Edit Workout',
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
                  label: 'Delete Workout',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: async () => {
                    const ok = await confirmAsync('Delete workout?', `"${selected.name}" will be removed from the program.`, 'Delete', true);
                    if (!ok) return;
                    await deleteTemplate(db, selected.id);
                    reload();
                  },
                },
              ]
            : []
        }
      />
      <ActionSheet
        visible={menu}
        title={program.name}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'Rename', icon: 'pencil-outline', onPress: () => setRenaming(true) },
          ...(program.templates.length > 1
            ? [{ label: 'Reorder workouts', icon: 'reorder-three-outline' as const, onPress: () => setReordering(true) }]
            : []),
          {
            label: 'Delete program',
            icon: 'trash-outline',
            destructive: true,
            onPress: async () => {
              const ok = await confirmAsync(
                'Delete program?',
                `"${program.name}" and its workouts will be deleted. Workouts you've done stay in your history.`,
                'Delete',
                true,
              );
              if (!ok) return;
              await deleteProgram(db, program.id);
              router.back();
            },
          },
        ]}
      />
      <PromptModal
        visible={renaming}
        title="Program name"
        initialValue={program.name}
        onSubmit={async (v) => {
          await renameProgram(db, program.id, v);
          reload();
        }}
        onClose={() => setRenaming(false)}
      />
      <ReorderSheet
        visible={reordering}
        title="Reorder workouts"
        items={program.templates.map((t) => ({ key: String(t.id), label: t.name, sublabel: `${t.exercises.length} exercises` }))}
        onDone={async (keys) => {
          await reorderTemplates(db, keys.map(Number));
          reload();
        }}
        onClose={() => setReordering(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notes: { color: colors.text, fontSize: 15, marginTop: spacing.sm },
  hint: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  muted: { color: colors.muted, fontSize: 13 },
  card: { marginBottom: spacing.md, padding: spacing.md },
  nextCard: { borderColor: colors.primary, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 },
  badge: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  exercise: { paddingVertical: 3 },
  exerciseLine: { flexDirection: 'row', gap: spacing.sm },
  exerciseName: { color: colors.text, fontSize: 14, flex: 1 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  ruleText: { color: colors.success, fontSize: 12, flexShrink: 1 },
});
