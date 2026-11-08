import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { Gym } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';

/** Where you train: picking a gym makes exercise lists and swaps stick to its equipment. */
export default function GymsScreen() {
  const { settings, updateSettings } = useSettings();
  const edit = (id: string) => router.push({ pathname: '/gym/[id]', params: { id } });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Pick where you&apos;re training. Exercise lists and the suggestions when you replace an exercise then only show
        what you can do there. Bodyweight exercises and stretches are always included.
      </Text>
      <View style={styles.list}>
        <GymRow
          title="Anywhere"
          subtitle="All equipment"
          active={settings.activeGymId == null}
          onPress={() => updateSettings({ activeGymId: null })}
        />
        {settings.gyms.map((g) => (
          <GymRow
            key={g.id}
            title={g.name}
            subtitle={equipmentList(g)}
            active={g.id === settings.activeGymId}
            onPress={() => updateSettings({ activeGymId: g.id })}
            onEdit={() => edit(g.id)}
          />
        ))}
      </View>
      <Button title="Add gym" icon="add" variant="secondary" onPress={() => edit('new')} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const equipmentList = (g: Gym) => (g.equipment.length ? g.equipment.join(', ') : 'Bodyweight only');

function GymRow({
  title,
  subtitle,
  active,
  onPress,
  onEdit,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onPress: () => void;
  onEdit?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.primary : colors.faint} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {onEdit ? <Button title="Edit" small variant="ghost" onPress={onEdit} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60 },
  hint: { color: colors.muted, fontSize: 14, marginBottom: spacing.lg },
  list: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
