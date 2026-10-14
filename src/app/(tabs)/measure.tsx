import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListItem, SectionTitle } from '@/components/ui';
import { latestMeasurements } from '@/db/repo';
import { formatShortDate } from '@/lib/format';
import { useFocusQuery } from '@/lib/hooks';
import { MEASUREMENT_LABELS, measurementToDisplay, measurementUnit } from '@/lib/measurements';
import { colors, radius, spacing } from '@/lib/theme';
import { MEASUREMENT_TYPES, type MeasurementType } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';

const CORE: MeasurementType[] = ['bodyweight', 'bodyfat'];
const BODY = MEASUREMENT_TYPES.filter((t) => !CORE.includes(t));

export default function MeasureScreen() {
  const { settings } = useSettings();
  const [latest] = useFocusQuery(latestMeasurements);

  const item = (t: MeasurementType) => {
    const m = latest?.get(t);
    return (
      <ListItem
        key={t}
        title={MEASUREMENT_LABELS[t]}
        subtitle={m ? formatShortDate(m.measuredAt) : undefined}
        onPress={() => router.push({ pathname: '/measurement/[type]', params: { type: t } })}
        right={
          <Text style={styles.value}>
            {m ? `${measurementToDisplay(t, m.value, settings.units)} ${measurementUnit(t, settings.units)}` : '–'}
          </Text>
        }
      />
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle>Core</SectionTitle>
      <View style={styles.list}>{CORE.map(item)}</View>
      <SectionTitle>Body part</SectionTitle>
      <View style={styles.list}>{BODY.map(item)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  list: { borderRadius: radius.lg, overflow: 'hidden' },
  value: { color: colors.text, fontWeight: '600' },
});
