import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { NumberInput } from '@/components/NumberInput';
import { Card, SectionTitle } from '@/components/ui';
import { calculatePlates } from '@/lib/calc';
import { colors, radius, spacing } from '@/lib/theme';
import { weightUnit } from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';

const PLATE_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#22C55E', '#E5E7EB', '#6B7280', '#A855F7'];

export default function PlateCalculatorScreen() {
  const { settings } = useSettings();
  const [target, setTarget] = useState<number | null>(settings.units === 'metric' ? 100 : 225);
  const [bar, setBar] = useState<number | null>(settings.barWeight);
  const wu = weightUnit(settings.units);
  const plates = [...settings.plates].sort((a, b) => b - a);
  const result = target != null && bar != null ? calculatePlates(target, bar, plates) : null;

  const colorFor = (p: number) => PLATE_COLORS[plates.indexOf(p) % PLATE_COLORS.length];
  const maxPlate = plates[0] ?? 1;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.inputs}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>Target ({wu})</Text>
          <NumberInput value={target} onChange={setTarget} style={styles.big} autoFocus />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Bar ({wu})</Text>
          <NumberInput value={bar} onChange={setBar} style={styles.big} />
        </View>
      </View>

      {result && (
        <>
          <SectionTitle>Each side</SectionTitle>
          <Card>
            <View style={styles.barViz}>
              <View style={styles.barSleeve} />
              {result.perSide.map((p, i) => (
                <View
                  key={i}
                  style={[
                    styles.plate,
                    { height: 40 + (p / maxPlate) * 80, backgroundColor: colorFor(p) },
                  ]}
                />
              ))}
            </View>
            {result.perSide.length === 0 ? (
              <Text style={styles.text}>Just the bar.</Text>
            ) : (
              <Text style={styles.text}>
                {Object.entries(
                  result.perSide.reduce<Record<string, number>>((acc, p) => {
                    acc[p] = (acc[p] ?? 0) + 1;
                    return acc;
                  }, {}),
                )
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([p, n]) => `${n} × ${p} ${wu}`)
                  .join('   ')}
              </Text>
            )}
            {result.remainder > 0 && (
              <Text style={[styles.text, { color: colors.warning, marginTop: spacing.sm }]}>
                Closest possible: {result.achieved} {wu} ({result.remainder} {wu} short)
              </Text>
            )}
          </Card>
        </>
      )}
      <Text style={styles.hint}>Change your bar and available plates in Settings.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60 },
  inputs: { flexDirection: 'row', gap: spacing.md },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  big: { fontSize: 24, paddingVertical: 10, backgroundColor: colors.card, borderRadius: radius.md },
  barViz: { flexDirection: 'row', alignItems: 'center', height: 130, marginBottom: spacing.md },
  barSleeve: { width: 40, height: 14, backgroundColor: colors.faint, borderRadius: 3 },
  plate: { width: 16, marginLeft: 3, borderRadius: 3 },
  text: { color: colors.text, fontSize: 16 },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: spacing.lg },
});
