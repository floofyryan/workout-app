import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { NumberInput } from '@/components/NumberInput';
import { WorkoutEditor } from '@/components/WorkoutEditor';
import { Button, SectionTitle } from '@/components/ui';
import { getWorkout, saveWorkout } from '@/db/repo';
import { completedExercises, newActiveSet, newKey, type ActiveWorkout } from '@/lib/activeWorkout';
import { useExerciseMap } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';

export default function EditWorkoutScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [draft, setDraft] = useState<ActiveWorkout | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const exercises = useExerciseMap(draft?.exercises.map((e) => e.exerciseId) ?? []);

  useEffect(() => {
    getWorkout(db, Number(id)).then((w) => {
      if (!w) return;
      setDurationMin(Math.round((w.endedAt - w.startedAt) / 60000));
      setDraft({
        name: w.name,
        notes: w.notes,
        startedAt: w.startedAt,
        templateId: w.templateId,
        exercises: w.exercises.map((e) => ({
          key: newKey(),
          exerciseId: e.exercise.id,
          notes: e.notes,
          restSeconds: null,
          sets: e.sets.map((s) => ({ ...newActiveSet(s), completed: true })),
        })),
      });
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
    router.back();
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
