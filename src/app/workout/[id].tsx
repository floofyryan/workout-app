import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionSheet } from '@/components/Sheets';
import { Card, IconButton, Stat } from '@/components/ui';
import { workoutVolume } from '@/components/WorkoutCard';
import { deleteWorkout, getRecordsBefore, getWorkout, saveTemplate } from '@/db/repo';
import { computeRecords, estimate1RM, newRecords, RECORD_LABELS, type RecordKey } from '@/lib/calc';
import { formatDate, formatDuration, formatNumber, formatTime } from '@/lib/format';
import { useFocusQuery } from '@/lib/hooks';
import { formatSet, SET_TYPE_LABEL } from '@/lib/setFormat';
import { colors, radius, spacing } from '@/lib/theme';
import { exerciseCategory, type Template, type WorkoutDetail } from '@/lib/types';
import { formatWeight, kgToDisplay, weightUnit } from '@/lib/units';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';
import { useSettings } from '@/state/SettingsContext';

/** Converts a finished workout into an unsaved template (for "repeat" and "save as template"). */
function asTemplate(w: WorkoutDetail): Omit<Template, 'id' | 'lastUsedAt'> {
  return {
    name: w.name,
    notes: '',
    // A workout made up only of stretches becomes a stretch routine.
    kind: w.exercises.length > 0 && w.exercises.every((e) => exerciseCategory(e.exercise) === 'stretching') ? 'stretch' : 'workout',
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exercise.id,
      restSeconds: null,
      notes: e.notes,
      sets: e.sets,
    })),
  };
}

export default function WorkoutDetailScreen() {
  const db = useSQLiteContext();
  const { id, summary } = useLocalSearchParams<{ id: string; summary?: string }>();
  const { settings } = useSettings();
  const active = useActiveWorkout();
  const [menu, setMenu] = useState(false);
  const [data] = useFocusQuery(
    async (db) => {
      const workout = await getWorkout(db, Number(id));
      const prs = new Map<number, RecordKey[]>();
      if (workout) {
        for (const e of workout.exercises) {
          const before = await getRecordsBefore(db, e.exercise, workout.startedAt);
          prs.set(e.id, newRecords(e.exercise.type, before, computeRecords(e.exercise.type, e.sets)));
        }
      }
      return { workout, prs };
    },
    [id],
  );
  const w = data?.workout;
  const units = settings.units;

  if (data && !w) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Workout not found.</Text>
      </View>
    );
  }
  if (!w || !data) return null;

  const totalPrs = [...data.prs.values()].reduce((n, l) => n + l.length, 0);
  const volume = workoutVolume(w);

  const repeat = () => {
    const go = () => {
      active.start({ ...asTemplate(w), id: -1, lastUsedAt: null });
      // A repeated workout isn't tied to a template.
      active.update((cur) => ({ ...cur, templateId: null }));
      router.push('/active-workout');
    };
    if (active.workout) {
      Alert.alert('Workout in progress', 'Discard the current workout and start this one?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard & start', style: 'destructive', onPress: go },
      ]);
    } else go();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: summary ? 'Workout Complete' : 'Workout',
          headerRight: () => <IconButton name="ellipsis-horizontal" color={colors.primary} onPress={() => setMenu(true)} />,
        }}
      />
      {summary && (
        <View style={styles.banner}>
          <Ionicons name="trophy" size={28} color={colors.warning} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.bannerTitle}>Nice work!</Text>
            <Text style={styles.bannerText}>
              {totalPrs > 0 ? `You set ${totalPrs} personal record${totalPrs === 1 ? '' : 's'}.` : 'Workout saved.'}
            </Text>
          </View>
        </View>
      )}
      <Text style={styles.title}>{w.name}</Text>
      <Text style={styles.muted}>
        {formatDate(w.startedAt)} · {formatTime(w.startedAt)} – {formatTime(w.endedAt)}
      </Text>
      {w.notes ? <Text style={[styles.text, { marginTop: spacing.sm }]}>{w.notes}</Text> : null}

      <Card style={{ flexDirection: 'row', marginTop: spacing.lg }}>
        <Stat label="Duration" value={formatDuration((w.endedAt - w.startedAt) / 1000)} />
        <Stat label={`Volume (${weightUnit(units)})`} value={formatNumber(kgToDisplay(volume, units))} />
        <Stat label="PRs" value={String(totalPrs)} />
      </Card>

      {w.exercises.map((e) => {
        const prs = data.prs.get(e.id) ?? [];
        let n = 0;
        const showE1rm = e.exercise.type === 'weight_reps' || e.exercise.type === 'weighted_bodyweight';
        return (
          <Card key={e.id} style={{ marginTop: spacing.md }}>
            <Pressable onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(e.exercise.id) } })}>
              <Text style={styles.exName}>{e.exercise.name}</Text>
            </Pressable>
            {e.notes ? <Text style={styles.note}>{e.notes}</Text> : null}
            {e.sets.map((s, i) => (
              <View key={i} style={styles.setLine}>
                <Text style={[styles.setNo, s.setType !== 'normal' && { color: colors.warning }]}>
                  {s.setType === 'normal' ? ++n : SET_TYPE_LABEL[s.setType]}
                </Text>
                <Text style={[styles.text, { flex: 1 }]}>{formatSet(e.exercise.type, s, units)}</Text>
                {s.rpe ? <Text style={[styles.muted, { marginRight: spacing.md }]}>@{s.rpe}</Text> : null}
                {showE1rm && s.weight && s.reps ? (
                  <Text style={styles.muted}>{formatWeight(estimate1RM(s.weight, s.reps), units)}</Text>
                ) : null}
              </View>
            ))}
            {prs.length > 0 && (
              <View style={styles.prRow}>
                {prs.map((k) => (
                  <View key={k} style={styles.prChip}>
                    <Ionicons name="trophy" size={12} color={colors.warning} />
                    <Text style={styles.prText}>{RECORD_LABELS[k]}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={w.name}
        actions={[
          { label: 'Repeat workout', icon: 'repeat', onPress: repeat },
          {
            label: 'Edit workout',
            icon: 'create-outline',
            onPress: () => router.push({ pathname: '/workout-edit/[id]', params: { id: String(w.id) } }),
          },
          {
            label: 'Save as template',
            icon: 'bookmark-outline',
            onPress: async () => {
              const tid = await saveTemplate(db, null, asTemplate(w));
              router.push({ pathname: '/template/[id]', params: { id: String(tid) } });
            },
          },
          {
            label: 'Delete workout',
            icon: 'trash-outline',
            destructive: true,
            onPress: () =>
              Alert.alert('Delete workout?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteWorkout(db, w.id);
                    router.back();
                  },
                },
              ]),
          },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerTitle: { color: colors.text, fontWeight: '700', fontSize: 18 },
  bannerText: { color: colors.muted, marginTop: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14, marginTop: 2 },
  exName: { color: colors.primary, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
  note: { color: colors.warning, fontSize: 13, marginBottom: spacing.xs },
  setLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  setNo: { color: colors.muted, width: 24, fontWeight: '700' },
  prRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
});
