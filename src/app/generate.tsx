import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip } from '@/components/ui';
import { getKv, getPlan, listExercises, saveGeneratedProgram, setKv } from '@/db/repo';
import { formatClock } from '@/lib/format';
import {
  GEAR,
  GEAR_PRESETS,
  GOAL_LABELS,
  SPLIT_LABELS,
  generateProgram,
  recommendedSplit,
  type Gear,
  type Goal,
  type Split,
} from '@/lib/generator';
import { useFocusQuery } from '@/lib/hooks';
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/lib/plan';
import { colors, spacing } from '@/lib/theme';

const PREFS_KEY = 'generatorPrefs';

interface Prefs {
  gear: Gear[];
  goal: Goal;
  split: Split | 'auto';
  weekdays: number[];
}

const DEFAULT_PREFS: Prefs = { gear: [...GEAR], goal: 'muscle', split: 'auto', weekdays: [0, 2, 4] };

/** Builds a program of workout templates for the user's equipment, and optionally schedules it. */
export default function GenerateScreen() {
  const db = useSQLiteContext();
  const [library] = useFocusQuery((d) => listExercises(d));
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [seed, setSeed] = useState(0);
  const [replacePlan, setReplacePlan] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getKv(db, PREFS_KEY).then((raw) => {
      try {
        setPrefs(raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS);
      } catch {
        setPrefs(DEFAULT_PREFS);
      }
    });
  }, [db]);

  const update = (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSeed(0);
    setKv(db, PREFS_KEY, JSON.stringify(next));
  };

  const split: Split = prefs ? (prefs.split === 'auto' ? recommendedSplit(prefs.weekdays.length) : prefs.split) : 'full_body';
  const program = useMemo(
    () =>
      prefs && library && prefs.weekdays.length > 0
        ? generateProgram({ gear: prefs.gear, goal: prefs.goal, split, weekdays: prefs.weekdays, seed }, library)
        : null,
    [prefs, library, split, seed],
  );

  if (!prefs || !library) return null;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    if (!program) return;
    const go = async () => {
      setSaving(true);
      try {
        await saveGeneratedProgram(db, program, {
          folder: `${program.name} (generated)`,
          replacePlan,
        });
        router.back();
      } finally {
        setSaving(false);
      }
    };
    if (replacePlan && (await getPlan(db)).length > 0) {
      Alert.alert('Replace your weekly plan?', 'Your current plan will be replaced with this program. Your templates are kept.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', onPress: go },
      ]);
    } else {
      go();
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Your equipment</Text>
      <Text style={styles.hint}>Bodyweight exercises are always included.</Text>
      <View style={styles.chips}>
        {GEAR_PRESETS.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            selected={p.gear.length === prefs.gear.length && p.gear.every((g) => prefs.gear.includes(g))}
            onPress={() => update({ gear: p.gear })}
          />
        ))}
      </View>
      <View style={[styles.chips, { marginTop: spacing.sm }]}>
        {GEAR.map((g) => (
          <Chip key={g} label={g} selected={prefs.gear.includes(g)} onPress={() => update({ gear: toggle(prefs.gear, g) })} />
        ))}
      </View>

      <Text style={styles.label}>Training days</Text>
      <View style={styles.chips}>
        {WEEKDAY_SHORT.map((d, i) => (
          <Chip
            key={d}
            label={d}
            selected={prefs.weekdays.includes(i)}
            onPress={() => update({ weekdays: toggle(prefs.weekdays, i).sort((a, b) => a - b) })}
          />
        ))}
      </View>

      <Text style={styles.label}>Goal</Text>
      <View style={styles.chips}>
        {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
          <Chip key={g} label={GOAL_LABELS[g]} selected={prefs.goal === g} onPress={() => update({ goal: g })} />
        ))}
      </View>

      <Text style={styles.label}>Split</Text>
      <View style={styles.chips}>
        <Chip
          label={`Auto (${SPLIT_LABELS[recommendedSplit(prefs.weekdays.length)]})`}
          selected={prefs.split === 'auto'}
          onPress={() => update({ split: 'auto' })}
        />
        {(Object.keys(SPLIT_LABELS) as Split[]).map((s) => (
          <Chip key={s} label={SPLIT_LABELS[s]} selected={prefs.split === s} onPress={() => update({ split: s })} />
        ))}
      </View>

      {!program ? (
        <Text style={[styles.hint, { marginTop: spacing.lg }]}>Pick at least one training day.</Text>
      ) : (
        <>
          <View style={styles.previewHeader}>
            <Text style={styles.label}>Your program</Text>
            <Button title="Shuffle" icon="shuffle" small variant="ghost" onPress={() => setSeed((s) => s + 1)} />
          </View>
          {program.workouts.map((w, i) => {
            const days = program.schedule.filter((s) => s.workout === i).map((s) => WEEKDAY_NAMES[s.weekday]);
            return (
              <Card key={w.name} style={styles.workout}>
                <Text style={styles.workoutName}>{w.name}</Text>
                <Text style={styles.days}>{days.join(', ')}</Text>
                {w.exercises.map((e) => (
                  <View key={e.exerciseId} style={styles.exercise}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.sets}>
                      {e.sets.length} × {e.sets[0]?.durationS ? formatClock(e.sets[0].durationS) : e.sets[0]?.reps}
                    </Text>
                  </View>
                ))}
                {w.exercises.length < 4 && (
                  <Text style={[styles.hint, { marginTop: spacing.sm }]}>
                    Few exercises fit your equipment for this day — try adding more gear.
                  </Text>
                )}
              </Card>
            );
          })}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Use as my weekly plan</Text>
              <Text style={styles.hint}>Schedules these workouts on the days above.</Text>
            </View>
            <Switch value={replacePlan} onValueChange={setReplacePlan} />
          </View>
          <Button title="Save Program" icon="checkmark" loading={saving} onPress={save} style={{ marginTop: spacing.md }} />
          <Text style={[styles.hint, { marginTop: spacing.sm, textAlign: 'center' }]}>
            Saved as templates you can edit like any other. Weights fill in after your first session.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
  hint: { color: colors.faint, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workout: { padding: spacing.md, marginBottom: spacing.md },
  workoutName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  days: { color: colors.primary, fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
  exercise: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  exerciseName: { color: colors.text, flex: 1, fontSize: 14 },
  sets: { color: colors.muted, fontSize: 13, marginLeft: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.md },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
