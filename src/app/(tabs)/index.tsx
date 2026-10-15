import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { ActionSheet, PromptModal } from '@/components/Sheets';
import { ReorderSheet } from '@/components/Sortable';
import { Button, Card, SectionTitle } from '@/components/ui';
import { deleteTemplate, duplicateTemplate, listTemplates, reorderTemplates, setTemplateFolder } from '@/db/repo';
import { formatClock } from '@/lib/format';
import { useExerciseMap, useFocusQuery } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';
import type { Exercise, Template, TemplateKind } from '@/lib/types';
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
  const [folderFor, setFolderFor] = useState<Template | null>(null);
  const [reorderKind, setReorderKind] = useState<TemplateKind | null>(null);

  const saveOrder = async (kind: TemplateKind, keys: string[]) => {
    const others = (templates ?? []).filter((t) => t.kind !== kind).map((t) => t.id);
    await reorderTemplates(db, [...keys.map(Number), ...others]);
    reload();
  };
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

      <TemplateSection
        kind="workout"
        title="Workout templates"
        empty="No workout templates yet. Create one to plan your routine."
        templates={templates}
        exercises={exercises}
        onSelect={setSelected}
        onReorder={() => setReorderKind('workout')}
      />
      <TemplateSection
        kind="stretch"
        title="Stretch routines"
        empty="No stretch routines yet. Build one from the stretches in the exercise library."
        templates={templates}
        exercises={exercises}
        onSelect={setSelected}
        onReorder={() => setReorderKind('stretch')}
      />

      <ReorderSheet
        visible={reorderKind != null}
        title={reorderKind === 'stretch' ? 'Reorder stretch routines' : 'Reorder templates'}
        items={(templates ?? [])
          .filter((t) => t.kind === reorderKind)
          .map((t) => ({ key: String(t.id), label: t.name, sublabel: t.folder ?? undefined }))}
        onDone={(keys) => reorderKind && saveOrder(reorderKind, keys)}
        onClose={() => setReorderKind(null)}
      />
      <PromptModal
        visible={!!folderFor}
        title="Folder (leave empty for none)"
        initialValue={folderFor?.folder ?? ''}
        placeholder="e.g. PPL or Mobility"
        onSubmit={async (v) => {
          if (!folderFor) return;
          await setTemplateFolder(db, folderFor.id, v);
          reload();
        }}
        onClose={() => setFolderFor(null)}
      />

      <ActionSheet
        visible={!!selected}
        title={selected?.name}
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                {
                  label: selected.kind === 'stretch' ? 'Start Stretching' : 'Start Workout',
                  icon: 'play',
                  onPress: () => begin(selected),
                },
                {
                  label: selected.kind === 'stretch' ? 'Edit Routine' : 'Edit Template',
                  icon: 'create-outline',
                  onPress: () => router.push({ pathname: '/template/[id]', params: { id: String(selected.id) } }),
                },
                { label: 'Move to folder', icon: 'folder-outline', onPress: () => setFolderFor(selected) },
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

/** One group of template cards (workouts or stretch routines) with its own "+" button. */
function TemplateSection({
  kind,
  title,
  empty,
  templates,
  exercises,
  onSelect,
  onReorder,
}: {
  kind: TemplateKind;
  title: string;
  empty: string;
  templates: Template[] | undefined;
  exercises: Map<number, Exercise>;
  onSelect: (t: Template) => void;
  onReorder: () => void;
}) {
  const list = (templates ?? []).filter((t) => t.kind === kind);
  // Templates without a folder first, then one group per folder (A–Z).
  const folders = [...new Set(list.map((t) => t.folder).filter((f): f is string => !!f))].sort((a, b) =>
    a.localeCompare(b),
  );
  const groups: { folder: string | null; items: Template[] }[] = [
    { folder: null, items: list.filter((t) => !t.folder) },
    ...folders.map((folder) => ({ folder, items: list.filter((t) => t.folder === folder) })),
  ].filter((g) => g.items.length > 0);

  const card = (t: Template) => (
    <Card key={t.id} style={[styles.templateCard, kind === 'stretch' && styles.stretchCard]} onPress={() => onSelect(t)}>
      <Text style={styles.templateName} numberOfLines={1}>
        {t.name}
      </Text>
      {t.exercises.slice(0, 5).map((e, i) => (
        <Text key={i} style={styles.templateLine} numberOfLines={1}>
          {kind === 'stretch' && e.sets[0]?.durationS ? `${formatClock(e.sets[0].durationS)} · ` : `${e.sets.length} × `}
          {exercises.get(e.exerciseId)?.name ?? '…'}
        </Text>
      ))}
      {t.exercises.length > 5 && <Text style={styles.templateLine}>+{t.exercises.length - 5} more</Text>}
      <Text style={styles.lastUsed}>{daysAgo(t.lastUsedAt)}</Text>
    </Card>
  );

  return (
    <>
      <SectionTitle
        right={
          <View style={{ flexDirection: 'row' }}>
            {list.length > 1 && <Button title="Reorder" small variant="ghost" onPress={onReorder} />}
            <Button
              title={kind === 'stretch' ? 'Routine' : 'Template'}
              icon="add"
              small
              variant="ghost"
              onPress={() => router.push({ pathname: '/template/[id]', params: { id: 'new', kind } })}
            />
          </View>
        }
      >
        {title} ({list.length})
      </SectionTitle>
      {groups.map((g) => (
        <View key={g.folder ?? ''}>
          {g.folder ? (
            <View style={styles.folderHeader}>
              <Ionicons name="folder-open-outline" size={16} color={colors.muted} />
              <Text style={styles.folderName}>
                {g.folder} ({g.items.length})
              </Text>
            </View>
          ) : null}
          <View style={styles.grid}>{g.items.map(card)}</View>
        </View>
      ))}
      {templates && list.length === 0 && <Text style={{ color: colors.muted }}>{empty}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xl * 2 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  folderName: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  templateCard: { width: '48.5%', marginBottom: spacing.md, padding: spacing.md, minHeight: 140 },
  stretchCard: { borderColor: 'rgba(34,197,94,0.35)' },
  templateName: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: spacing.xs },
  templateLine: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lastUsed: { color: colors.faint, fontSize: 11, marginTop: 'auto', paddingTop: spacing.sm },
});
