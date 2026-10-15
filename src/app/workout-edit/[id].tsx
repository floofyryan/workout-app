import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { NumberInput } from '@/components/NumberInput';
import { WorkoutEditor } from '@/components/WorkoutEditor';
import { Button, SectionTitle } from '@/components/ui';
import { getWorkout, saveWorkout } from '@/db/repo';
import {
  completedExercises,
  newActiveSet,
  newKey,
  supersetIdsFromGroups,
  type ActiveWorkout,
} from '@/lib/activeWorkout';
import { useExerciseMap } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import { useUnsavedChangesGuard } from '@/lib/useUnsavedChangesGuard';

export default function EditWorkoutScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState<ActiveWorkout | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const exercises = useExerciseMap(draft?.exercises.map((e) => e.exerciseId) ?? []);
  // What was loaded, to tell whether anything has been edited.
  const [original, setOriginal] = useState<string | null>(null);
  const snapshot = JSON.stringify({ draft, durationMin });
  const leave = useUnsavedChangesGuard(original != null && snapshot !== original);

  useEffect(() => {
    getWorkout(db, Number(id)).then((w) => {
      if (!w) return;
      const minutes = Math.round((w.endedAt - w.startedAt) / 60000);
      const supersetIds = supersetIdsFromGroups(w.exercises.map((e) => e.supersetGroup));
      const loaded: ActiveWorkout = {
        name: w.name,
        notes: w.notes,
        startedAt: w.startedAt,
        templateId: w.templateId,
        exercises: w.exercises.map((e, i) => ({
          key: newKey(),
          exerciseId: e.exercise.id,
          notes: e.notes,
          restSeconds: null,
          sets: e.sets.map((s) => ({ ...newActiveSet(s), completed: true })),
          supersetId: supersetIds[i],
        })),
      };
      setDraft(loaded);
      setDurationMin(minutes);
      setOriginal(JSON.stringify({ draft: loaded, durationMin: minutes }));
    });
  }, [db, id]);

  if (!draft) return null;

  const save = async () => {
    const done = completedExercises(draft);
    if (done.length === 0) {
      Alert.alert('Nothing to save', 'A workout needs at least one set with values.');
      return;
    }
    await saveWorkout(db, Number(id), {
      name: draft.name.trim() || 'Workout',
      notes: draft.notes,
      startedAt: draft.startedAt,
      endedAt: draft.startedAt + Math.max(1, durationMin ?? 1) * 60000,
      templateId: draft.templateId,
      exercises: done,
    });
    leave();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack.Screen options={{ headerRight: () => <Button title="Save" small onPress={save} /> }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <WorkoutEditor
          mode="edit"
          workout={draft}
          onChange={(fn) => setDraft((d) => (d ? fn(d) : d))}
          exercises={exercises}
          header={
            <View>
              <SectionTitle>Name</SectionTitle>
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                style={styles.input}
                placeholderTextColor={colors.faint}
              />
              <SectionTitle>Duration (minutes)</SectionTitle>
              <NumberInput integer value={durationMin} onChange={setDurationMin} style={[styles.input, styles.left]} />
              <SectionTitle>Notes</SectionTitle>
              <TextInput
                value={draft.notes}
                onChangeText={(notes) => setDraft({ ...draft, notes })}
                style={styles.input}
                multiline
                placeholder="Notes"
                placeholderTextColor={colors.faint}
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
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, padding: spacing.md, fontSize: 16 },
  left: { textAlign: 'left', fontWeight: '400' },
});
