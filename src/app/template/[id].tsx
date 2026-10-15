import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { WorkoutEditor } from '@/components/WorkoutEditor';
import { Button, Chip } from '@/components/ui';
import { getTemplate, saveTemplate } from '@/db/repo';
import { templateExercisesFromWorkout, workoutFromTemplate, type ActiveWorkout } from '@/lib/activeWorkout';
import { useExerciseMap } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';
import type { TemplateKind } from '@/lib/types';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';

export default function TemplateEditorScreen() {
  const db = useSQLiteContext();
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = id === 'new';
  const [kind, setKind] = useState<TemplateKind>(kindParam === 'stretch' ? 'stretch' : 'workout');
  const [draft, setDraft] = useState<ActiveWorkout | null>(
    isNew ? { name: '', notes: '', startedAt: 0, templateId: null, exercises: [] } : null,
  );
  const [folder, setFolder] = useState('');
  const exercises = useExerciseMap(draft?.exercises.map((e) => e.exerciseId) ?? []);
  // What was loaded (or the blank new template), to tell whether anything has been edited.
  const snapshot = JSON.stringify({ draft, kind, folder });
  const [original, setOriginal] = useState<string | null>(isNew ? snapshot : null);
  const leave = useUnsavedChangesGuard(original != null && snapshot !== original);

  useEffect(() => {
    if (isNew) return;
    getTemplate(db, Number(id)).then((t) => {
      if (!t) return;
      const loaded = workoutFromTemplate(t, 0);
      setDraft(loaded);
      setKind(t.kind);
      setFolder(t.folder ?? '');
      setOriginal(JSON.stringify({ draft: loaded, kind: t.kind, folder: t.folder ?? '' }));
    });
  }, [db, id, isNew]);

  if (!draft) return null;

  const save = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Give your template a name.');
      return;
    }
    await saveTemplate(db, isNew ? null : Number(id), {
      name: draft.name,
      notes: draft.notes,
      kind,
      folder,
      exercises: templateExercisesFromWorkout(draft),
    });
    leave();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen
        options={{
          title: `${isNew ? 'New' : 'Edit'} ${kind === 'stretch' ? 'Stretch Routine' : 'Template'}`,
          headerRight: () => <Button title="Save" small onPress={save} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <WorkoutEditor
          mode="template"
          workout={draft}
          onChange={(fn) => setDraft((d) => (d ? fn(d) : d))}
          exercises={exercises}
          header={
            <View>
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                placeholder="Template name"
                placeholderTextColor={colors.faint}
                style={styles.name}
                autoFocus={isNew}
              />
              <TextInput
                value={draft.notes}
                onChangeText={(notes) => setDraft({ ...draft, notes })}
                placeholder="Notes"
                placeholderTextColor={colors.faint}
                style={styles.notes}
                multiline
              />
              <View style={styles.kinds}>
                <Chip label="Workout" selected={kind === 'workout'} onPress={() => setKind('workout')} />
                <Chip label="Stretch" selected={kind === 'stretch'} onPress={() => setKind('stretch')} />
              </View>
              <TextInput
                value={folder}
                onChangeText={setFolder}
                placeholder="Folder (optional), e.g. PPL or Mobility"
                placeholderTextColor={colors.faint}
                style={styles.folder}
              />
            </View>
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 200 },
  name: { color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: 4 },
  notes: { color: colors.muted, fontSize: 15, paddingVertical: 4 },
  kinds: { flexDirection: 'row', marginTop: spacing.sm },
  folder: {
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
});
