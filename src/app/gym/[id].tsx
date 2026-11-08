import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip, SectionTitle } from '@/components/ui';
import { newKey } from '@/lib/activeWorkout';
import { confirmAsync } from '@/lib/dialog';
import { GYM_EQUIPMENT, GYM_PRESETS } from '@/lib/gyms';
import { colors, radius, spacing } from '@/lib/theme';
import type { Equipment } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';

/** Name and equipment of a gym ("new" to add one). */
export default function GymEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, updateSettings } = useSettings();
  const existing = settings.gyms.find((g) => g.id === id);
  const [name, setName] = useState(existing?.name ?? (settings.gyms.length ? '' : 'Home'));
  const [equipment, setEquipment] = useState<Equipment[]>(existing?.equipment ?? GYM_PRESETS[1].equipment);
  const toggle = (e: Equipment) => setEquipment((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]));

  const save = () => {
    const gym = { id: existing?.id ?? newKey(), name: name.trim() || 'Gym', equipment: GYM_EQUIPMENT.filter((e) => equipment.includes(e)) };
    updateSettings(
      existing
        ? { gyms: settings.gyms.map((g) => (g.id === gym.id ? gym : g)) }
        : // A gym you just added is the one you're at.
          { gyms: [...settings.gyms, gym], activeGymId: gym.id },
    );
    router.back();
  };

  const remove = async () => {
    if (!existing || !(await confirmAsync('Delete gym?', `"${existing.name}" will be removed.`, 'Delete', true))) return;
    updateSettings({
      gyms: settings.gyms.filter((g) => g.id !== existing.id),
      activeGymId: settings.activeGymId === existing.id ? null : settings.activeGymId,
    });
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{ title: existing ? 'Edit Gym' : 'New Gym', headerRight: () => <Button title="Save" small onPress={save} /> }}
      />
      <SectionTitle>Name</SectionTitle>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Home or Work gym"
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
      <SectionTitle>Start from</SectionTitle>
      <View style={styles.wrap}>
        {GYM_PRESETS.map((p) => (
          <View key={p.name} style={styles.chipWrap}>
            <Chip label={p.name} onPress={() => setEquipment(p.equipment)} />
          </View>
        ))}
      </View>
      <SectionTitle>Equipment</SectionTitle>
      <View style={styles.wrap}>
        {GYM_EQUIPMENT.map((e) => (
          <View key={e} style={styles.chipWrap}>
            <Chip label={e} selected={equipment.includes(e)} onPress={() => toggle(e)} />
          </View>
        ))}
      </View>
      <Text style={styles.hint}>Bodyweight exercises and stretches are always included.</Text>
      {existing ? <Button title="Delete gym" variant="danger" onPress={remove} style={{ marginTop: spacing.xl }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 60 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: radius.md, padding: spacing.md, fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chipWrap: { marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
});
