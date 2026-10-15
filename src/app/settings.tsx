import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { NumberInput } from '@/components/NumberInput';
import { Button, Card, Chip, SectionTitle } from '@/components/ui';
import { deleteAllWorkouts, exportBackup, exportWorkouts, importWorkouts, restoreBackup } from '@/db/repo';
import { dateStamp, pickTextFile, shareTextFile } from '@/lib/files';
import { formatClock, parseNumber } from '@/lib/format';
import { parseStrongCsv, workoutsToStrongCsv } from '@/lib/strongCsv';
import { colors, radius, spacing } from '@/lib/theme';
import type { UnitSystem } from '@/lib/types';
import { weightUnit } from '@/lib/units';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';
import { useSettings } from '@/state/SettingsContext';

const REST_OPTIONS = [30, 60, 90, 120, 150, 180, 240, 300];

function askUnits(): Promise<UnitSystem | null> {
  return new Promise((resolve) =>
    Alert.alert(
      'Weight unit in file',
      'Which unit were weights recorded in? (Used when the file does not say.)',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'lb', onPress: () => resolve('imperial') },
        { text: 'kg', onPress: () => resolve('metric') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { settings, updateSettings, reloadSettings } = useSettings();
  const { reloadFromStorage } = useActiveWorkout();
  const [platesText, setPlatesText] = useState(settings.plates.join(', '));
  const [busy, setBusy] = useState<string | null>(null);
  const wu = weightUnit(settings.units);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const importStrong = () =>
    run('import', async () => {
      const text = await pickTextFile(['text/csv', 'text/comma-separated-values', 'text/plain', '*/*']);
      if (text == null) return;
      const units = await askUnits();
      if (!units) return;
      const parsed = parseStrongCsv(text, units);
      if (parsed.workouts.length === 0) {
        Alert.alert('Nothing to import', 'No workouts were found in that file.');
        return;
      }
      const res = await importWorkouts(db, parsed.workouts);
      Alert.alert(
        'Import complete',
        `Imported ${res.workoutsImported} workouts.` +
          (res.workoutsSkipped ? `\nSkipped ${res.workoutsSkipped} already imported.` : '') +
          (res.exercisesCreated ? `\nCreated ${res.exercisesCreated} new exercises.` : ''),
      );
    });

  const exportCsv = () =>
    run('csv', async () => {
      const csv = workoutsToStrongCsv(await exportWorkouts(db), settings.units);
      await shareTextFile(`workouts-${dateStamp()}.csv`, csv, 'text/csv');
    });

  const backup = () =>
    run('backup', async () => {
      await shareTextFile(`workout-backup-${dateStamp()}.json`, await exportBackup(db), 'application/json');
    });

  const restore = () =>
    Alert.alert('Restore backup?', 'This replaces ALL current data with the backup.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Choose file',
        style: 'destructive',
        onPress: () =>
          run('restore', async () => {
            const text = await pickTextFile(['application/json', '*/*']);
            if (text == null) return;
            await restoreBackup(db, text);
            const restored = await reloadSettings();
            setPlatesText(restored.plates.join(', '));
            await reloadFromStorage();
            Alert.alert('Restored', 'Your workouts, templates, exercises and settings have been restored.');
          }),
      },
    ]);

  const wipe = () =>
    Alert.alert('Delete all workouts?', 'Your workout history will be permanently deleted. Templates and exercises are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run('wipe', () => deleteAllWorkouts(db)) },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle>Units</SectionTitle>
      <View style={styles.row}>
        <Chip label="Metric (kg, cm, km)" selected={settings.units === 'metric'} onPress={() => updateSettings({ units: 'metric' })} />
        <Chip
          label="Imperial (lb, in, mi)"
          selected={settings.units === 'imperial'}
          onPress={() => {
            updateSettings({ units: 'imperial' });
            setPlatesText([45, 35, 25, 10, 5, 2.5].join(', '));
          }}
        />
      </View>

      <SectionTitle>Default rest timer</SectionTitle>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {REST_OPTIONS.map((s) => (
          <View key={s} style={{ marginBottom: spacing.sm }}>
            <Chip label={formatClock(s)} selected={settings.defaultRestSeconds === s} onPress={() => updateSettings({ defaultRestSeconds: s })} />
          </View>
        ))}
        <View style={{ marginBottom: spacing.sm }}>
          <Chip label="Off" selected={settings.defaultRestSeconds === 0} onPress={() => updateSettings({ defaultRestSeconds: 0 })} />
        </View>
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <View style={styles.switchRow}>
          <Text style={styles.text}>Vibrate when rest ends</Text>
          <Switch value={settings.vibrateOnRestEnd} onValueChange={(v) => updateSettings({ vibrateOnRestEnd: v })} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.text}>Keep screen on during workouts</Text>
          <Switch value={settings.keepScreenOn} onValueChange={(v) => updateSettings({ keepScreenOn: v })} />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.text, { flex: 1, marginRight: spacing.md }]}>Timer alerts when the screen is off</Text>
          <Switch value={settings.timerNotifications} onValueChange={(v) => updateSettings({ timerNotifications: v })} />
        </View>
      </Card>

      <SectionTitle>Plate calculator</SectionTitle>
      <Card>
        <View style={styles.switchRow}>
          <Text style={styles.text}>Bar weight ({wu})</Text>
          <NumberInput
            value={settings.barWeight}
            onChange={(v) => v != null && updateSettings({ barWeight: v })}
            style={{ width: 80 }}
          />
        </View>
        <Text style={[styles.text, { marginTop: spacing.sm }]}>Available plates ({wu})</Text>
        <TextInput
          value={platesText}
          onChangeText={setPlatesText}
          onEndEditing={() => {
            const plates = platesText
              .split(/[,\s]+/)
              .map(parseNumber)
              .filter((n): n is number => n != null && n > 0)
              .sort((a, b) => b - a);
            if (plates.length) updateSettings({ plates });
            setPlatesText((plates.length ? plates : settings.plates).join(', '));
          }}
          style={styles.input}
          keyboardType="numbers-and-punctuation"
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Button title="Import from Strong (CSV)" icon="download-outline" variant="secondary" onPress={importStrong} loading={busy === 'import'} />
      <Text style={styles.hint}>
        In Strong: Settings → Export Strong Data. Then pick the CSV file here. Already imported workouts are skipped.
      </Text>
      <Button title="Export workouts (CSV)" icon="share-outline" variant="secondary" onPress={exportCsv} loading={busy === 'csv'} style={styles.gap} />
      <Button title="Back up all data (JSON)" icon="cloud-upload-outline" variant="secondary" onPress={backup} loading={busy === 'backup'} style={styles.gap} />
      <Button title="Restore from backup" icon="cloud-download-outline" variant="secondary" onPress={restore} loading={busy === 'restore'} style={styles.gap} />
      <Button title="Delete all workouts" icon="trash-outline" variant="danger" onPress={wipe} loading={busy === 'wipe'} style={{ marginTop: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  text: { color: colors.text, fontSize: 15 },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    fontSize: 15,
  },
  hint: { color: colors.faint, fontSize: 12, marginTop: spacing.sm },
  gap: { marginTop: spacing.md },
});
