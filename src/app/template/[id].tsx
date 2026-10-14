import { router, Stack, useLocalSearchParams } from 'expo-router';
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

export default function TemplateEditorScreen() {
  const db = useSQLiteContext();
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = id === 'new';
  const [kind, setKind] = useState<TemplateKind>(kindParam === 'stretch' ? 'stretch' : 'workout');
  const [draft, setDraft] = useState<ActiveWorkout | null>(
    isNew ? { name: '', notes: '', startedAt: 0, templateId: null, exercises: [] } : null,
  );
  const exercises = useExerciseMap(draft?.exercises.map((e) => e.exerciseId) ?? []);

  useEffect(() => {
    if (isNew) return;
    getTemplate(db, Number(id)).then((t) => {
      if (!t) return;
      setDraft(workoutFromTemplate(t, 0));
      setKind(t.kind);
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
      exercises: templateExercisesFromWorkout(draft),
    });
    router.back();
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
});
