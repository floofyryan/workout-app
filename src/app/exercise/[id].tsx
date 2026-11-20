import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LineChart, type Point } from '@/components/Charts';
import { ExerciseDemo } from '@/components/ExerciseMedia';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui';
import { getExercise, getExerciseHistory, type ExerciseHistoryEntry } from '@/db/repo';
import {
  computeRecords,
  estimate1RM,
  percentOf1RM,
  RECORD_LABELS,
  recordKeysFor,
  repMaxes,
  totalVolume,
  usesWeight,
  type RecordKey,
} from '@/lib/calc';
import { formatClock, formatDate, formatShortDate } from '@/lib/format';
import { useFocusQuery } from '@/lib/hooks';
import { formatSet, SET_TYPE_LABEL } from '@/lib/setFormat';
import { colors, radius, spacing } from '@/lib/theme';
import { EXERCISE_CATEGORY_LABELS, EXERCISE_TYPE_LABELS, exerciseCategory, type Exercise, type UnitSystem } from '@/lib/types';
import { clean, formatDistance, formatWeight, kgToDisplay, metresToDisplay, weightUnit } from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';

const TABS = ['About', 'History', 'Charts', 'Records'] as const;
type Tab = (typeof TABS)[number];

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab | null>(null);
  const [data] = useFocusQuery(
    async (db) => ({
      exercise: await getExercise(db, Number(id)),
      history: await getExerciseHistory(db, Number(id)),
    }),
    [id],
  );
  const exercise = data?.exercise;
  // Open on History once there is some, otherwise on About (instructions and photos).
  const activeTab: Tab = tab ?? (data && data.history.length > 0 ? 'History' : 'About');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: exercise?.name ?? '',
          headerRight: () =>
            exercise ? (
              <Button
                title="Edit"
                small
                variant="ghost"
                onPress={() => router.push({ pathname: '/exercise-edit', params: { id: String(exercise.id) } })}
              />
            ) : null,
        }}
      />
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, activeTab === t && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {exercise && data && (
        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'About' && <About exercise={exercise} sessions={data.history.length} />}
          {activeTab === 'History' && <History exercise={exercise} history={data.history} units={settings.units} />}
          {activeTab === 'Charts' && <Charts exercise={exercise} history={data.history} units={settings.units} />}
          {activeTab === 'Records' && <RecordsTab exercise={exercise} history={data.history} units={settings.units} />}
        </ScrollView>
      )}
    </View>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function About({ exercise, sessions }: { exercise: Exercise; sessions: number }) {
  const rows: [string, string][] = [
    ['Type', EXERCISE_CATEGORY_LABELS[exerciseCategory(exercise)]],
    ['Body part', exercise.bodyPart],
    ['Primary muscles', exercise.primaryMuscles.map(capitalize).join(', ')],
    ['Secondary muscles', exercise.secondaryMuscles.map(capitalize).join(', ')],
    ['Equipment', exercise.equipment],
    ['Level', capitalize(exercise.level ?? '')],
    ['Tracking', EXERCISE_TYPE_LABELS[exercise.type]],
    ['Rest timer', exercise.restSeconds != null ? formatClock(exercise.restSeconds) : 'Default'],
    ['Times performed', String(sessions)],
  ].filter((r): r is [string, string] => r[1] !== '');
  return (
    <>
      <ExerciseDemo exercise={exercise} />
      <Card style={exercise.images.length ? { marginTop: spacing.md } : undefined}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.aboutRow}>
            <Text style={styles.muted}>{k}</Text>
            <Text style={[styles.text, styles.aboutValue]}>{v}</Text>
          </View>
        ))}
        {exercise.notes ? (
          <>
            <Text style={[styles.muted, { marginTop: spacing.md }]}>Notes</Text>
            <Text style={[styles.text, { marginTop: 4 }]}>{exercise.notes}</Text>
          </>
        ) : null}
      </Card>
      {exercise.instructions.length > 0 && (
        <>
          <SectionTitle>Instructions</SectionTitle>
          <Card>
            {exercise.instructions.map((step, i) => (
              <View key={i} style={styles.step}>
                <Text style={styles.stepNo}>{i + 1}</Text>
                <Text style={[styles.text, { flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </Card>
          <Text style={styles.credit}>Photos and instructions: free-exercise-db (public domain)</Text>
        </>
      )}
    </>
  );
}

function History({ exercise, history, units }: { exercise: Exercise; history: ExerciseHistoryEntry[]; units: UnitSystem }) {
  if (history.length === 0) {
    return <EmptyState icon="time-outline" title="No history yet" message="Sets you complete for this exercise show up here." />;
  }
  const showE1rm = exercise.type === 'weight_reps' || exercise.type === 'weighted_bodyweight';
  return (
    <>
      {history.map((h) => {
        let n = 0;
        return (
          <Card
            key={h.workoutId}
            style={{ marginBottom: spacing.md }}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(h.workoutId) } })}
          >
            <Text style={styles.cardTitle}>{h.workoutName}</Text>
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{formatDate(h.startedAt)}</Text>
            {h.sets.map((s, i) => (
              <View key={i} style={styles.setLine}>
                <Text style={[styles.setNo, s.setType !== 'normal' && { color: colors.warning }]}>
                  {s.setType === 'normal' ? ++n : SET_TYPE_LABEL[s.setType]}
                </Text>
                <Text style={[styles.text, { flex: 1 }]}>{formatSet(exercise.type, s, units)}</Text>
                {showE1rm && s.weight && s.reps ? (
                  <Text style={styles.muted}>{formatWeight(estimate1RM(s.weight, s.reps), units)}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}
    </>
  );
}

function Charts({ exercise, history, units }: { exercise: Exercise; history: ExerciseHistoryEntry[]; units: UnitSystem }) {
  const charts = useMemo(() => {
    const chronological = [...history].reverse();
    const series = (fn: (h: ExerciseHistoryEntry) => number): Point[] =>
      chronological.map((h) => ({ x: h.startedAt, y: fn(h) })).filter((p) => p.y > 0);
    const wu = weightUnit(units);
    const out: { title: string; data: Point[]; formatY?: (v: number) => string }[] = [];
    if (exercise.type === 'weight_reps' || exercise.type === 'weighted_bodyweight') {
      out.push({
        title: `Best set (est. 1RM, ${wu})`,
        data: series((h) => clean(kgToDisplay(computeRecords(exercise.type, h.sets).e1rm, units), 1)),
      });
      out.push({
        title: `Heaviest weight (${wu})`,
        data: series((h) => clean(kgToDisplay(computeRecords(exercise.type, h.sets).maxWeight, units), 1)),
      });
      out.push({
        title: `Workout volume (${wu})`,
        data: series((h) => Math.round(kgToDisplay(totalVolume(exercise.type, h.sets), units))),
      });
    }
    if (usesWeight(exercise.type) || exercise.type === 'reps') {
      out.push({ title: 'Most reps in a set', data: series((h) => computeRecords(exercise.type, h.sets).maxReps) });
      out.push({
        title: 'Total reps',
        data: series((h) => h.sets.reduce((sum, s) => sum + (s.setType === 'warmup' ? 0 : (s.reps ?? 0)), 0)),
      });
    }
    if (exercise.type === 'distance_duration') {
      out.push({
        title: 'Distance',
        data: series((h) => clean(metresToDisplay(computeRecords(exercise.type, h.sets).maxDistance, units), 2)),
      });
    }
    if (exercise.type === 'duration' || exercise.type === 'distance_duration') {
      out.push({
        title: 'Longest duration',
        data: series((h) => computeRecords(exercise.type, h.sets).maxDuration),
        formatY: formatClock,
      });
    }
    return out;
  }, [exercise, history, units]);

  if (history.length === 0) return <EmptyState icon="stats-chart-outline" title="No data yet" />;
  return (
    <>
      {charts.map((c) => (
        <Card key={c.title} style={{ marginBottom: spacing.md }}>
          <Text style={[styles.cardTitle, { marginBottom: spacing.sm }]}>{c.title}</Text>
          <LineChart data={c.data} formatX={formatShortDate} formatY={c.formatY} />
        </Card>
      ))}
    </>
  );
}

function RecordsTab({ exercise, history, units }: { exercise: Exercise; history: ExerciseHistoryEntry[]; units: UnitSystem }) {
  const result = useMemo(() => {
    // Track when each record was set.
    const best: Partial<Record<RecordKey, { value: number; at: number }>> = {};
    for (const h of [...history].reverse()) {
      const r = computeRecords(exercise.type, h.sets);
      for (const k of recordKeysFor(exercise.type)) {
        if (r[k] > 0 && r[k] > (best[k]?.value ?? 0)) best[k] = { value: r[k], at: h.startedAt };
      }
    }
    return { best, reps: repMaxes(history.flatMap((h) => h.sets)) };
  }, [exercise, history]);

  if (history.length === 0) return <EmptyState icon="trophy-outline" title="No records yet" />;

  const fmt = (k: RecordKey, v: number) => {
    switch (k) {
      case 'e1rm':
      case 'maxWeight':
        return formatWeight(v, units);
      case 'maxSetVolume':
        return `${Math.round(kgToDisplay(v, units))} ${weightUnit(units)}`;
      case 'maxReps':
        return String(v);
      case 'maxDuration':
        return formatClock(v);
      case 'maxDistance':
        return formatDistance(v, units);
    }
  };

  const best1rm = result.best.e1rm?.value ?? 0;
  const showRepTable = exercise.type === 'weight_reps' || exercise.type === 'weighted_bodyweight';

  return (
    <>
      <SectionTitle>Personal records</SectionTitle>
      <Card>
        {recordKeysFor(exercise.type).map((k) => {
          const rec = result.best[k];
          return (
            <View key={k} style={styles.aboutRow}>
              <Text style={styles.muted}>{RECORD_LABELS[k]}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.text, { fontWeight: '700' }]}>{rec ? fmt(k, rec.value) : '–'}</Text>
                {rec && <Text style={styles.small}>{formatShortDate(rec.at)}</Text>}
              </View>
            </View>
          );
        })}
      </Card>
      {showRepTable && (
        <>
          <SectionTitle>Rep records</SectionTitle>
          <Card>
            <View style={styles.aboutRow}>
              <Text style={[styles.small, { flex: 1 }]}>REPS</Text>
              <Text style={[styles.small, { flex: 2, textAlign: 'right' }]}>BEST PERFORMANCE</Text>
              <Text style={[styles.small, { flex: 2, textAlign: 'right' }]}>PREDICTED</Text>
            </View>
            {result.reps.map((w, i) => (
              <View key={i} style={styles.aboutRow}>
                <Text style={[styles.text, { flex: 1 }]}>{i + 1}</Text>
                <Text style={[styles.text, { flex: 2, textAlign: 'right' }]}>{w != null ? formatWeight(w, units) : '–'}</Text>
                <Text style={[styles.muted, { flex: 2, textAlign: 'right' }]}>
                  {best1rm ? formatWeight(best1rm * percentOf1RM(i + 1), units) : '–'}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.cardAlt },
  tabText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.text },
  content: { padding: spacing.lg, paddingBottom: 60 },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.md,
  },
  aboutValue: { flexShrink: 1, textAlign: 'right' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  small: { color: colors.faint, fontSize: 12 },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  setLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  setNo: { color: colors.muted, width: 24, fontWeight: '700' },
  step: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6 },
  stepNo: { color: colors.primary, fontWeight: '700', width: 18 },
  credit: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
