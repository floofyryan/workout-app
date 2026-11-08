import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { PromptModal } from '@/components/Sheets';
import { Button, Card } from '@/components/ui';
import { PROGRAMS, type ProgramDef } from '@/data/programs';
import { createProgram, installProgram } from '@/db/repo';
import { describeImport, errorText, pickAndImportShared } from '@/lib/sharing';
import { colors, spacing } from '@/lib/theme';
import { useSettings } from '@/state/SettingsContext';

/** The program library: add a ready-made program, or start an empty one. */
export default function ProgramLibraryScreen() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

  const open = (id: number) => router.replace({ pathname: '/program/[id]', params: { id: String(id) } });
  const add = async (def: ProgramDef) => {
    setBusy(def.key);
    try {
      open(await installProgram(db, def, settings.units));
    } finally {
      setBusy(null);
    }
  };
  const importFile = async () => {
    setBusy('import');
    try {
      const result = await pickAndImportShared(db);
      if (!result) return;
      if (result.programId != null) return open(result.programId);
      // A single template goes with the other templates on the Workout tab.
      Alert.alert('Imported', describeImport(result));
      router.back();
    } catch (e) {
      Alert.alert('Could not import', errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        A program is a set of workouts you do in turn. Every exercise has a rule for moving on: add weight when you get all
        your reps, or add reps up to the top of a range and then weight. Your first session sets the starting weights.
      </Text>
      {PROGRAMS.map((p) => (
        <Card key={p.key} style={styles.card}>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.schedule}>{p.schedule}</Text>
          <Text style={styles.notes}>{p.notes}</Text>
          {p.workouts.map((w) => (
            <Text key={w.name} style={styles.workout} numberOfLines={2}>
              <Text style={styles.workoutName}>{w.name}: </Text>
              {w.exercises.map((x) => x.name).join(', ')}
            </Text>
          ))}
          <Button
            title="Add program"
            icon="add"
            small
            loading={busy === p.key}
            disabled={busy != null}
            onPress={() => add(p)}
            style={styles.add}
          />
        </Card>
      ))}
      <Button title="Start from scratch" icon="create-outline" variant="secondary" onPress={() => setNaming(true)} />
      <Button
        title="Import a shared program"
        icon="document-attach-outline"
        variant="secondary"
        loading={busy === 'import'}
        disabled={busy != null}
        onPress={importFile}
        style={{ marginTop: spacing.md }}
      />
      <PromptModal
        visible={naming}
        title="Program name"
        placeholder="e.g. My split"
        onSubmit={async (name) => open(await createProgram(db, name))}
        onClose={() => setNaming(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60 },
  intro: { color: colors.muted, fontSize: 14, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  schedule: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  notes: { color: colors.text, fontSize: 14, marginTop: spacing.sm },
  workout: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  workoutName: { color: colors.text, fontWeight: '600' },
  add: { marginTop: spacing.md, alignSelf: 'flex-start' },
});
