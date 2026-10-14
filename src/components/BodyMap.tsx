import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import { colors, radius, spacing } from '@/lib/theme';
import type { BodyPart } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';
import { CritterBody } from './CritterBody';
import { Chip } from './ui';

/** Which app body part each muscle on the anatomical figures belongs to. */
const SLUG_TO_PART: Partial<Record<Slug, BodyPart>> = {
  neck: 'Neck',
  trapezius: 'Back',
  'upper-back': 'Back',
  'lower-back': 'Back',
  deltoids: 'Shoulders',
  chest: 'Chest',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearm: 'Forearms',
  abs: 'Core',
  obliques: 'Core',
  gluteal: 'Glutes',
  adductors: 'Glutes',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  calves: 'Calves',
  tibialis: 'Calves',
};

const PART_SLUGS = new Map<BodyPart, Slug[]>();
for (const [slug, part] of Object.entries(SLUG_TO_PART) as [Slug, BodyPart][]) {
  PART_SLUGS.set(part, [...(PART_SLUGS.get(part) ?? []), slug]);
}

/** Body parts that aren't a single area on the figure. */
const EXTRA_PARTS: BodyPart[] = ['Full Body', 'Cardio', 'Other'];

// The figures are drawn in a 200 × 400 box at scale 1.
const FIGURE_WIDTH = 200;
const GAP = 12;

const FIGURES = [
  { value: 'critter', label: 'Critter' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

/**
 * Anatomical front and back figures; tapping a muscle selects its body part (tapping it again
 * clears the selection). The critter is our own (src/data/critterBody.ts); the male and
 * female figures come from react-native-body-highlighter (MIT).
 */
export function BodyMap({
  selected,
  onSelect,
  counts,
}: {
  selected: BodyPart | null;
  onSelect: (part: BodyPart | null) => void;
  /** Number of exercises per body part, shown in the caption. */
  counts?: Map<BodyPart, number>;
}) {
  const { settings, updateSettings } = useSettings();
  const [width, setWidth] = useState(0);
  const toggle = (part: BodyPart) => onSelect(selected === part ? null : part);

  const scale = width > 0 ? Math.min(0.9, (width - GAP) / 2 / FIGURE_WIDTH) : 0;
  const highlighted: ExtendedBodyPart[] = (selected ? (PART_SLUGS.get(selected) ?? []) : []).map((slug) => ({
    slug,
    intensity: 1,
  }));
  const onPressSlug = (slug: Slug | undefined) => {
    const mapped = slug ? SLUG_TO_PART[slug] : undefined;
    if (mapped) toggle(mapped);
  };
  const figureKind = settings.bodyMapGender === 'male' || settings.bodyMapGender === 'female' ? settings.bodyMapGender : 'critter';
  const caption = selected
    ? `${selected}${counts ? ` · ${counts.get(selected) ?? 0} exercises` : ''}`
    : 'Tap a muscle';

  const figure = (side: 'front' | 'back') => (
    <View style={styles.figure}>
      {figureKind === 'critter' ? (
        <CritterBody
          side={side}
          scale={scale}
          highlighted={new Set(highlighted.map((h) => h.slug as string))}
          highlightColor={colors.primary}
          onPress={onPressSlug}
        />
      ) : (
        <Body
          data={highlighted}
          side={side}
          gender={figureKind}
          scale={scale}
          colors={[colors.primary]}
          defaultFill="#3B414E"
          border={colors.faint}
          onBodyPartPress={(part) => onPressSlug(part.slug)}
        />
      )}
      <Text style={styles.sideLabel}>{side === 'front' ? 'FRONT' : 'BACK'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.figures} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {scale > 0 && (
          <>
            {figure('front')}
            {figure('back')}
          </>
        )}
      </View>
      <Text style={[styles.caption, selected && { color: colors.text }]}>{caption}</Text>
      <View style={styles.extras}>
        {EXTRA_PARTS.filter((part) => part !== 'Other' || (counts?.get('Other') ?? 0) > 0).map((part) => (
          <Chip key={part} label={part} selected={selected === part} onPress={() => toggle(part)} />
        ))}
      </View>
      <View style={styles.gender}>
        {FIGURES.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={figureKind === f.value}
            onPress={() => updateSettings({ bodyMapGender: f.value })}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  figures: { flexDirection: 'row', justifyContent: 'center', gap: GAP, alignSelf: 'stretch', minHeight: 1 },
  figure: { alignItems: 'center' },
  sideLabel: { color: colors.faint, fontSize: 11, fontWeight: '700', marginTop: 2 },
  caption: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  extras: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  gender: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm, opacity: 0.85 },
});
