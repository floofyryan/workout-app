import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NumberInput } from '@/components/NumberInput';
import { Card, SectionTitle } from '@/components/ui';
import { estimate1RM, percentOf1RM, roundTo } from '@/lib/calc';
import { colors, radius, spacing } from '@/lib/theme';
import { weightUnit } from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';

const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

export default function OneRepMaxScreen() {
  const { settings } = useSettings();
  const wu = weightUnit(settings.units);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const increment = settings.units === 'metric' ? 2.5 : 5;
  const oneRm = weight && reps ? estimate1RM(weight, Math.min(reps, 30)) : 0;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.inputs}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Weight ({wu})</Text>
          <NumberInput value={weight} onChange={setWeight} style={styles.big} autoFocus />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Reps</Text>
          <NumberInput integer value={reps} onChange={setReps} style={styles.big} />
        </View>
      </View>

      <Card style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        <Text style={styles.label}>Estimated 1RM</Text>
        <Text style={styles.result}>{oneRm ? `${Math.round(oneRm * 10) / 10} ${wu}` : '–'}</Text>
      </Card>

      {oneRm > 0 && (
        <>
          <SectionTitle>Training percentages</SectionTitle>
          <Card>
            <View style={styles.row}>
              <Text style={[styles.head, { flex: 1 }]}>%</Text>
              <Text style={[styles.head, { flex: 2, textAlign: 'right' }]}>WEIGHT</Text>
              <Text style={[styles.head, { flex: 1, textAlign: 'right' }]}>~REPS</Text>
            </View>
            {PERCENTS.map((p) => {
              // Reps you could expect at this percentage (inverse of Epley).
              const expected = p === 100 ? 1 : Math.round(30 * (100 / p - 1));
              return (
                <View key={p} style={styles.row}>
                  <Text style={[styles.text, { flex: 1 }]}>{p}%</Text>
                  <Text style={[styles.text, { flex: 2, textAlign: 'right' }]}>
                    {roundTo((oneRm * p) / 100, increment)} {wu}
                  </Text>
                  <Text style={[styles.muted, { flex: 1, textAlign: 'right' }]}>{expected}</Text>
                </View>
              );
            })}
          </Card>
          <Text style={styles.hint}>
            Uses the Epley formula. A {Math.round(percentOf1RM(5) * 100)}% load is about a 5-rep max.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60 },
  inputs: { flexDirection: 'row', gap: spacing.md },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  big: { fontSize: 24, paddingVertical: 10, backgroundColor: colors.card, borderRadius: radius.md },
  result: { color: colors.text, fontSize: 36, fontWeight: '800' },
  row: { flexDirection: 'row', paddingVertical: 5 },
  head: { color: colors.faint, fontSize: 12, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 15 },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
});
