import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { WorkoutEditor } from '@/components/WorkoutEditor';
import { Button } from '@/components/ui';
import { getTemplate, saveTemplate } from '@/db/repo';
import { templateExercisesFromWorkout, workoutFromTemplate, type ActiveWorkout } from '@/lib/activeWorkout';
import { useExerciseMap } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';

export default function TemplateEditorScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<ActiveWorkout | null>(
    isNew ? { name: '', notes: '', startedAt: 0, templateId: null, exercises: [] } : null,
  );
  const exercises = useExerciseMap(draft?.exercises.map((e) => e.exerciseId) ?? []);

  useEffect(() => {
    if (isNew) return;
    getTemplate(db, Number(id)).then((t) => t && setDraft(workoutFromTemplate(t, 0)));
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
      exercises: templateExercisesFromWorkout(draft),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen
        options={{
          title: isNew ? 'New Template' : 'Edit Template',
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
});
