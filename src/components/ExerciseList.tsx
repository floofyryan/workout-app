import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { exerciseUseCounts, listExercises } from '@/db/repo';
import { useFocusQuery } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import { BODY_PARTS, EQUIPMENT, type Exercise } from '@/lib/types';
import { Chip } from './ui';

type Sort = 'name' | 'frequency';

/** Searchable, filterable list of exercises. */
export function ExerciseList({
  selected,
  onPress,
  header,
}: {
  selected?: Set<number>;
  onPress: (e: Exercise) => void;
  header?: React.ReactElement;
}) {
  const [data] = useFocusQuery(async (db) => ({
    exercises: await listExercises(db),
    counts: await exerciseUseCounts(db),
  }));
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('name');

  const filtered = useMemo(() => {
    if (!data) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = data.exercises.filter(
      (e) =>
        (!bodyPart || e.bodyPart === bodyPart) &&
        (!equipment || e.equipment === equipment) &&
        words.every((w) => e.name.toLowerCase().includes(w)),
    );
    if (sort === 'frequency') {
      list.sort((a, b) => (data.counts.get(b.id) ?? 0) - (data.counts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    }
    return list;
  }, [data, query, bodyPart, equipment, sort]);

  return (
    <FlatList
      data={filtered}
      keyExtractor={(e) => String(e.id)}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={20}
      ListHeaderComponent={
        <View>
          {header}
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.faint}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} keyboardShouldPersistTaps="handled">
            <Chip label={sort === 'name' ? 'A–Z' : 'Most used'} selected onPress={() => setSort(sort === 'name' ? 'frequency' : 'name')} />
            <Chip label="Any body part" selected={!bodyPart} onPress={() => setBodyPart(null)} />
            {BODY_PARTS.map((b) => (
              <Chip key={b} label={b} selected={bodyPart === b} onPress={() => setBodyPart(bodyPart === b ? null : b)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} keyboardShouldPersistTaps="handled">
            <Chip label="Any equipment" selected={!equipment} onPress={() => setEquipment(null)} />
            {EQUIPMENT.map((e) => (
              <Chip key={e} label={e} selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={data ? <Text style={styles.empty}>No exercises found</Text> : null}
      renderItem={({ item }) => {
        const isSelected = selected?.has(item.id);
        const count = data?.counts.get(item.id) ?? 0;
        return (
          <Pressable
            onPress={() => onPress(item)}
            style={({ pressed }) => [styles.item, isSelected && styles.itemSelected, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {item.bodyPart}
                {count > 0 ? ` · ${count}×` : ''}
                {item.isCustom ? ' · Custom' : ''}
              </Text>
            </View>
            {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 10, paddingHorizontal: spacing.sm, fontSize: 16 },
  chips: { paddingHorizontal: spacing.lg, marginTop: spacing.sm, flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    gap: spacing.md,
  },
  itemSelected: { backgroundColor: 'rgba(59,130,246,0.12)' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.xl },
});
