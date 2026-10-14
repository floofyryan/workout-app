import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NumberInput } from '@/components/NumberInput';
import { Button, Chip, SectionTitle } from '@/components/ui';
import { createExercise, findExerciseByName, getExercise, setExerciseArchived, updateExercise } from '@/db/repo';
import { colors, radius, spacing } from '@/lib/theme';
import {
  BODY_PARTS,
  EQUIPMENT,
  EXERCISE_TYPE_LABELS,
  EXERCISE_TYPES,
  type BodyPart,
  type Equipment,
  type Exercise,
  type ExerciseType,
} from '@/lib/types';

export default function ExerciseEditScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing, setExisting] = useState<Exercise | null>(null);
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<Equipment>('Barbell');
  const [bodyPart, setBodyPart] = useState<BodyPart>('Chest');
  const [type, setType] = useState<ExerciseType>('weight_reps');
  const [notes, setNotes] = useState('');
  const [rest, setRest] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    getExercise(db, Number(id)).then((e) => {
      if (!e) return;
      setExisting(e);
      setName(e.name);
      setEquipment(e.equipment);
      setBodyPart(e.bodyPart);
      setType(e.type);
      setNotes(e.notes);
      setRest(e.restSeconds);
    });
  }, [db, id]);

  // Built-in exercises keep their name and category so imports keep matching them.
  const lockCore = existing != null && !existing.isCustom;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert('Name required', 'Give the exercise a name.');
    const clash = await findExerciseByName(db, trimmed);
    if (clash && clash.id !== existing?.id) {
      return Alert.alert('Already exists', `An exercise called "${clash.name}" already exists.`);
    }
    const input = { name: trimmed, equipment, bodyPart, type, notes, restSeconds: rest };
    if (existing) await updateExercise(db, existing.id, input);
    else await createExercise(db, input);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit Exercise' : 'New Exercise' }} />
      <SectionTitle>Name</SectionTitle>
      <TextInput
        value={name}
        onChangeText={setName}
        editable={!lockCore}
        placeholder="e.g. Incline Row (Dumbbell)"
        placeholderTextColor={colors.faint}
        style={[styles.input, lockCore && { opacity: 0.6 }]}
      />

      {!lockCore && (
        <>
          <SectionTitle>Equipment</SectionTitle>
          <View style={styles.wrap}>
            {EQUIPMENT.map((e) => (
              <View key={e} style={styles.chipWrap}>
                <Chip
                  label={e}
                  selected={equipment === e}
                  onPress={() => {
                    setEquipment(e);
                    // Bodyweight movements default to reps only.
                    if (e === 'Bodyweight' && type === 'weight_reps') setType('reps');
                  }}
                />
              </View>
            ))}
          </View>

          <SectionTitle>Body part</SectionTitle>
          <View style={styles.wrap}>
            {BODY_PARTS.map((b) => (
              <View key={b} style={styles.chipWrap}>
                <Chip label={b} selected={bodyPart === b} onPress={() => setBodyPart(b)} />
              </View>
            ))}
          </View>

          <SectionTitle>Tracking</SectionTitle>
          <View style={styles.wrap}>
            {EXERCISE_TYPES.map((t) => (
              <View key={t} style={styles.chipWrap}>
                <Chip label={EXERCISE_TYPE_LABELS[t]} selected={type === t} onPress={() => setType(t)} />
              </View>
            ))}
          </View>
        </>
      )}

      <SectionTitle>Rest timer (seconds)</SectionTitle>
      <NumberInput
        integer
        value={rest}
        onChange={setRest}
        placeholder="Use default"
        style={[styles.input, { textAlign: 'left', fontWeight: '400' }]}
      />

      <SectionTitle>Notes</SectionTitle>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Form cues, seat settings…"
        placeholderTextColor={colors.faint}
        style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
      />

      <Button title="Save" onPress={save} style={{ marginTop: spacing.xl }} />
      {existing?.isCustom && (
        <Button
          title={existing.archived ? 'Restore exercise' : 'Archive exercise'}
          variant="danger"
          style={{ marginTop: spacing.md }}
          onPress={async () => {
            await setExerciseArchived(db, existing.id, !existing.archived);
            router.back();
          }}
        />
      )}
      {existing?.isCustom && !existing.archived && (
        <Text style={styles.hint}>Archived exercises are hidden from lists but keep their history.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: 0, paddingBottom: 60 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chipWrap: { marginBottom: spacing.sm },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});
