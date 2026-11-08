import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { exerciseUseCounts, listExercises } from '@/db/repo';
import { activeGym, availableIn, similarExercises } from '@/lib/gyms';
import { useFocusQuery } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import {
  BODY_PARTS,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  exerciseCategory,
  type BodyPart,
  type Exercise,
  type ExerciseCategory,
} from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';
import { BodyMap } from './BodyMap';
import { ExerciseThumb } from './ExerciseMedia';
import { Chip } from './ui';

type Sort = 'name' | 'frequency';

/** Searchable, filterable list of exercises. */
export function ExerciseList({
  selected,
  onPress,
  header,
  initialShowMap = true,
  similarTo,
}: {
  selected?: Set<number>;
  onPress: (e: Exercise) => void;
  header?: React.ReactElement;
  /** Whether the body map starts open (it can be toggled either way). */
  initialShowMap?: boolean;
  /** Exercise being replaced: stand-ins for it are suggested above the list. */
  similarTo?: number;
}) {
  const [data] = useFocusQuery(async (db) => ({
    exercises: await listExercises(db),
    counts: await exerciseUseCounts(db),
  }));
  const { settings } = useSettings();
  const gym = activeGym(settings);
  // With a gym picked, lists stick to its equipment unless this is switched off.
  const [gymOnly, setGymOnly] = useState(true);
  const gymFilter = gymOnly ? gym : null;
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [showMap, setShowMap] = useState(initialShowMap);
  const listRef = useRef<FlatList<Exercise>>(null);
  // Where the filter chips start, so picking a muscle can scroll the results into view. Worked out
  // from heights because web only reports layout when a size changes, not when something moves.
  const heights = useRef({ header: 0, filters: 0 });
  const selectFromMap = (part: BodyPart | null) => {
    setBodyPart(part);
    if (part) {
      const offset = heights.current.header - heights.current.filters;
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset, animated: true }));
    }
  };
  const [equipment, setEquipment] = useState<string | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [sort, setSort] = useState<Sort>('name');

  // Exercises matching every filter except body part (the body map shows counts per part).
  const matching = useMemo(() => {
    if (!data) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return data.exercises.filter(
      (e) =>
        availableIn(gymFilter, e) &&
        (!equipment || e.equipment === equipment) &&
        (!category || exerciseCategory(e) === category) &&
        words.every((w) => e.name.toLowerCase().includes(w)),
    );
  }, [data, query, equipment, category, gymFilter]);

  const similar = useMemo(() => {
    const target = data?.exercises.find((e) => e.id === similarTo);
    return target && data ? similarExercises(target, data.exercises, gymFilter, data.counts) : [];
  }, [data, similarTo, gymFilter]);

  const row = (item: Exercise) => (
    <ExerciseRow
      key={item.id}
      exercise={item}
      count={data?.counts.get(item.id) ?? 0}
      selected={!!selected?.has(item.id)}
      onPress={() => onPress(item)}
    />
  );

  const partCounts = useMemo(() => {
    const m = new Map<BodyPart, number>();
    for (const e of matching) m.set(e.bodyPart, (m.get(e.bodyPart) ?? 0) + 1);
    return m;
  }, [matching]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = matching.filter((e) => !bodyPart || e.bodyPart === bodyPart);
    if (sort === 'frequency') {
      list.sort((a, b) => (data.counts.get(b.id) ?? 0) - (data.counts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    }
    return list;
  }, [data, matching, bodyPart, sort]);

  return (
    <FlatList
      ref={listRef}
      data={filtered}
      keyExtractor={(e) => String(e.id)}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={20}
      ListHeaderComponent={
        <View onLayout={(e) => (heights.current.header = e.nativeEvent.layout.height)}>
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
            <Pressable
              onPress={() => setShowMap((v) => !v)}
              hitSlop={8}
              style={[styles.mapToggle, showMap && styles.mapToggleOn]}
              accessibilityLabel={showMap ? 'Hide body map' : 'Show body map'}
            >
              <Ionicons name="body-outline" size={16} color={showMap ? '#fff' : colors.primary} />
              <Text style={[styles.mapToggleText, showMap && { color: '#fff' }]}>Body map</Text>
            </Pressable>
          </View>
          {similar.length > 0 && !query ? (
            <View style={styles.similar}>
              <Text style={styles.similarTitle}>
                Similar exercises{gymFilter ? ` at ${gymFilter.name}` : ''}
              </Text>
              {similar.map(row)}
              <Text style={styles.similarTitle}>All exercises</Text>
            </View>
          ) : null}
          {showMap && <BodyMap selected={bodyPart} onSelect={selectFromMap} counts={partCounts} />}
          <View onLayout={(e) => (heights.current.filters = e.nativeEvent.layout.height)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              {gym ? <Chip label={`${gym.name} only`} selected={gymOnly} onPress={() => setGymOnly((v) => !v)} /> : null}
              <Chip
                label={sort === 'name' ? 'A–Z' : 'Most used'}
                selected
                onPress={() => setSort(sort === 'name' ? 'frequency' : 'name')}
              />
              <Chip label="Any body part" selected={!bodyPart} onPress={() => setBodyPart(null)} />
              {BODY_PARTS.map((b) => (
                <Chip
                  key={b}
                  label={b}
                  selected={bodyPart === b}
                  onPress={() => setBodyPart(bodyPart === b ? null : b)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              <Chip label="Any equipment" selected={!equipment} onPress={() => setEquipment(null)} />
              {EQUIPMENT.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  selected={equipment === e}
                  onPress={() => setEquipment(equipment === e ? null : e)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              <Chip label="Any type" selected={!category} onPress={() => setCategory(null)} />
              {EXERCISE_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={EXERCISE_CATEGORY_LABELS[c]}
                  selected={category === c}
                  onPress={() => setCategory(category === c ? null : c)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      }
      ListEmptyComponent={data ? <Text style={styles.empty}>No exercises found</Text> : null}
      renderItem={({ item }) => row(item)}
    />
  );
}

function ExerciseRow({
  exercise,
  count,
  selected,
  onPress,
}: {
  exercise: Exercise;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const kind = exerciseCategory(exercise);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && { opacity: 0.6 }]}
    >
      <ExerciseThumb exercise={exercise} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {exercise.bodyPart}
          {kind !== 'strength' && kind !== 'cardio' ? ` · ${EXERCISE_CATEGORY_LABELS[kind]}` : ''}
          {count > 0 ? ` · ${count}×` : ''}
          {exercise.isCustom ? ' · Custom' : ''}
        </Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
    </Pressable>
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
  mapToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  mapToggleOn: { backgroundColor: colors.primary },
  mapToggleText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
  },
  chips: { paddingHorizontal: spacing.lg, marginTop: spacing.sm, flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    gap: spacing.md,
  },
  itemSelected: { backgroundColor: 'rgba(59,130,246,0.12)' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.xl },
  similar: { marginTop: spacing.md },
  similarTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
