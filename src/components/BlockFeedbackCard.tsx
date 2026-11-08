import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { adjustTemplateSets, getTemplate } from '@/db/repo';
import { FEEDBACK, type FeedbackKey } from '@/lib/blocks';
import { useFocusQuery } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';
import { Card, Chip } from './ui';

const delta = (key: FeedbackKey | undefined) => FEEDBACK.find((f) => f.key === key)?.delta ?? 0;

/**
 * After a training-block workout: how each exercise felt. "Too easy" gives it a set more next
 * time and "Too much" a set less; changing your mind applies the difference.
 */
export function BlockFeedbackCard({
  templateId,
  exercises,
}: {
  templateId: number;
  /** Exercises done in the workout (id and name). */
  exercises: { id: number; name: string }[];
}) {
  const db = useSQLiteContext();
  const [template] = useFocusQuery((db) => getTemplate(db, templateId), [templateId]);
  const [choices, setChoices] = useState<Record<number, FeedbackKey>>({});
  // Each change reads and rewrites the template, so they're applied one after another.
  const queue = useRef(Promise.resolve());

  const choose = (exerciseId: number, key: FeedbackKey) => {
    const change = delta(key) - delta(choices[exerciseId]);
    setChoices((c) => ({ ...c, [exerciseId]: key }));
    if (change !== 0) {
      queue.current = queue.current.then(() => adjustTemplateSets(db, templateId, exerciseId, change)).catch(() => {});
    }
  };

  // Only exercises that are in the template can be adjusted, each once.
  const inTemplate = new Set(template?.exercises.map((e) => e.exerciseId));
  const shown = exercises.filter((e, i) => inTemplate.has(e.id) && exercises.findIndex((x) => x.id === e.id) === i);
  if (!template || shown.length === 0) return null;

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <Text style={styles.title}>How did it feel?</Text>
      <Text style={styles.hint}>Too easy: a set more next week. Too much: a set less.</Text>
      {shown.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {e.name}
          </Text>
          <View style={styles.chips}>
            {FEEDBACK.map((f) => (
              <Chip key={f.key} label={f.label} selected={choices[e.id] === f.key} onPress={() => choose(e.id, f.key)} />
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontWeight: '700', fontSize: 16 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 2, marginBottom: spacing.xs },
  row: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: 14, marginBottom: 6 },
  chips: { flexDirection: 'row' },
});
