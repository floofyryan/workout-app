import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BodyMap } from '@/components/BodyMap';
import { Button, Card, Chip, SectionTitle } from '@/components/ui';
import { SEED_EXERCISES } from '@/data/exercises';
import { exerciseUseCounts, listExercises, workoutsSince } from '@/db/repo';
import { FOCUS_LABELS, generateWorkout, SPLITS, type Focus } from '@/lib/generator';
import { activeGym } from '@/lib/gyms';
import { useFocusQuery, useNow } from '@/lib/hooks';
import { RECOVERY_WINDOW_MS, recoveryByPart, recoveryLevel, type RecoveryLevel } from '@/lib/recovery';
import { colors, radius, spacing } from '@/lib/theme';
import type { BodyPart, Template } from '@/lib/types';
import { useSettings } from '@/state/SettingsContext';
import { useBeginWorkout } from '@/state/useBeginWorkout';

// The hand-picked library exercises, preferred over the long tail of free-exercise-db.
const STAPLES = new Set(SEED_EXERCISES.map((e) => e.name));
const LEVEL_COLOR: Record<RecoveryLevel, string | null> = {
  worked: colors.danger,
  recovering: colors.warning,
  fresh: null,
};
const FOCUSES: Focus[] = ['auto', ...SPLITS];
const SIZES = [4, 5, 6];

/** The recovery map and a workout built from the muscles that are ready. */
export default function SuggestedWorkoutScreen() {
  const { settings } = useSettings();
  const begin = useBeginWorkout();
  const [data] = useFocusQuery(async (db) => ({
    exercises: await listExercises(db),
    counts: await exerciseUseCounts(db),
    recent: await workoutsSince(db, Date.now() - RECOVERY_WINDOW_MS),
  }));
  const now = useNow(60_000);
  const [focus, setFocus] = useState<Focus>('auto');
  const [size, setSize] = useState(5);
  const [seed, setSeed] = useState(1);
  const gym = activeGym(settings);

  const recovery = useMemo(() => (data ? recoveryByPart(data.recent, now) : null), [data, now]);
  const plan = useMemo(
    () =>
      data && recovery
        ? generateWorkout({
            exercises: data.exercises,
            recovery,
            gym,
            useCounts: data.counts,
            isStaple: (e) => STAPLES.has(e.name),
            focus,
            count: size,
            seed,
          })
        : null,
    [data, recovery, gym, focus, size, seed],
  );
  const byLevel = useMemo(() => {
    const out: Record<RecoveryLevel, BodyPart[]> = { worked: [], recovering: [], fresh: [] };
    for (const [part, r] of recovery ?? []) out[recoveryLevel(r.recovery)].push(part);
    return out;
  }, [recovery]);
  const shading = useMemo(() => {
    const map = new Map<BodyPart, string>();
    for (const level of ['worked', 'recovering'] as const) for (const part of byLevel[level]) map.set(part, LEVEL_COLOR[level]!);
    return map;
  }, [byLevel]);

  if (!data || !plan) return null;

  const caption =
    byLevel.worked.length + byLevel.recovering.length === 0
      ? 'Everything is recovered'
      : [
          byLevel.worked.length ? `Worked: ${byLevel.worked.join(', ')}` : '',
          byLevel.recovering.length ? `Recovering: ${byLevel.recovering.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · ');

  const start = () => {
    const template: Template = {
      id: -1, // an unsaved plan
      name: plan.name,
      notes: '',
      kind: 'workout',
      folder: null,
      programId: null,
      lastUsedAt: null,
      exercises: plan.exercises.map((p) => ({ exerciseId: p.exercise.id, restSeconds: null, notes: '', sets: p.sets })),
    };
    begin(template);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Red muscles were worked hard in the last few days, amber ones are still recovering. The suggestion trains what&apos;s
        ready{gym ? `, with the equipment at ${gym.name}` : ''}.
      </Text>
      <BodyMap shading={shading} caption={caption} />
      <View style={styles.legend}>
        <Legend color={colors.danger} label="Worked hard" />
        <Legend color={colors.warning} label="Recovering" />
        <Legend color={null} label="Ready" />
      </View>

      <View style={styles.section}>
        <SectionTitle right={<Button title={gym ? gym.name : 'Any gym'} icon="barbell-outline" small variant="ghost" onPress={() => router.push('/gyms')} />}>
          Suggested workout
        </SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {FOCUSES.map((f) => (
            <Chip key={f} label={FOCUS_LABELS[f]} selected={focus === f} onPress={() => setFocus(f)} />
          ))}
        </ScrollView>
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <Text style={styles.muted}>Exercises</Text>
          {SIZES.map((n) => (
            <Chip key={n} label={String(n)} selected={size === n} onPress={() => setSize(n)} />
          ))}
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.planName}>{plan.name}</Text>
          {focus === 'auto' ? <Text style={styles.muted}>The freshest split for today</Text> : null}
          {plan.exercises.length === 0 ? (
            <Text style={[styles.muted, { marginTop: spacing.sm }]}>
              Nothing fits this focus with the equipment you have. Try another focus or gym.
            </Text>
          ) : (
            plan.exercises.map((p) => (
              <View key={p.exercise.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exercise} numberOfLines={1}>
                    {p.exercise.name}
                  </Text>
                  <Text style={styles.part}>{p.part}</Text>
                </View>
                <Text style={styles.sets}>
                  {p.sets.length} × {p.sets[0].durationS ? `${p.sets[0].durationS} s` : p.sets[0].reps}
                </Text>
              </View>
            ))
          )}
        </Card>
        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <Button title="Shuffle" icon="shuffle" variant="secondary" onPress={() => setSeed((s) => s + 1)} style={{ flex: 1 }} />
          <Button title="Start workout" icon="play" onPress={start} disabled={plan.exercises.length === 0} style={{ flex: 1 }} />
        </View>
      </View>
    </ScrollView>
  );
}

/** A legend entry; a hollow dot stands for "not shaded" (whatever colour the figure is). */
function Legend({ color, label }: { color: string | null; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, color ? { backgroundColor: color } : styles.hollow]} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 60 },
  intro: { color: colors.muted, fontSize: 14, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hollow: { borderWidth: 1.5, borderColor: colors.muted },
  section: { paddingHorizontal: spacing.lg },
  chips: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { color: colors.muted, fontSize: 13 },
  planName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  exercise: { color: colors.text, fontSize: 15 },
  part: { color: colors.faint, fontSize: 12, marginTop: 1 },
  sets: { color: colors.muted, fontSize: 14, fontWeight: '600', borderRadius: radius.sm },
});
