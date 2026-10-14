import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { NumberInput } from '@/components/NumberInput';
import { Button, Card, ListItem } from '@/components/ui';
import { addMeasurement, deleteMeasurement, listMeasurements } from '@/db/repo';
import { formatDate, formatShortDate } from '@/lib/format';
import { useFocusQuery } from '@/lib/hooks';
import { MEASUREMENT_LABELS, measurementFromDisplay, measurementToDisplay, measurementUnit } from '@/lib/measurements';
import { colors, radius, spacing } from '@/lib/theme';
import type { MeasurementType } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';

export default function MeasurementScreen() {
  const db = useSQLiteContext();
  const { type } = useLocalSearchParams<{ type: MeasurementType }>();
  const { settings } = useSettings();
  const [entries, reload] = useFocusQuery((db) => listMeasurements(db, type), [type]);
  const [value, setValue] = useState<number | null>(null);
  const unit = measurementUnit(type, settings.units);

  const add = async () => {
    if (value == null || value <= 0) return;
    await addMeasurement(db, type, measurementFromDisplay(type, value, settings.units), Date.now());
    setValue(null);
    reload();
  };

  const chart = [...(entries ?? [])]
    .reverse()
    .map((m) => ({ x: m.measuredAt, y: measurementToDisplay(type, m.value, settings.units) }));

  return (
    <FlatList
      data={entries ?? []}
      keyExtractor={(m) => String(m.id)}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ padding: spacing.lg }}>
          <Stack.Screen options={{ title: MEASUREMENT_LABELS[type] ?? '' }} />
          <Card>
            <LineChart data={chart} formatX={formatShortDate} formatY={(v) => String(Math.round(v * 10) / 10)} />
          </Card>
          <View style={styles.addRow}>
            <NumberInput value={value} onChange={setValue} placeholder={`New entry (${unit})`} style={styles.input} selectTextOnFocus={false} />
            <Button title="Add" icon="add" onPress={add} disabled={value == null} />
          </View>
          <Text style={styles.history}>History</Text>
        </View>
      }
      renderItem={({ item }) => (
        <ListItem
          title={`${measurementToDisplay(type, item.value, settings.units)} ${unit}`}
          subtitle={formatDate(item.measuredAt)}
          onLongPress={() =>
            Alert.alert('Delete entry?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteMeasurement(db, item.id);
                  reload();
                },
              },
            ])
          }
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
      ListFooterComponent={
        entries?.length ? <Text style={styles.hint}>Long-press an entry to delete it.</Text> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  input: {
    flex: 1,
    textAlign: 'left',
    fontWeight: '400',
    fontSize: 16,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  history: { color: colors.muted, fontWeight: '700', marginTop: spacing.xl, textTransform: 'uppercase', fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  hint: { color: colors.faint, textAlign: 'center', fontSize: 12, padding: spacing.lg },
});
