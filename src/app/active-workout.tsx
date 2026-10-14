import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RestTimerBar } from '@/components/RestTimerBar';
import { SetTimerBar } from '@/components/SetTimerBar';
import { WorkoutEditor } from '@/components/WorkoutEditor';
import { Button } from '@/components/ui';
import { getTemplate, saveTemplate } from '@/db/repo';
import {
  completedExercises,
  countIncompleteSets,
  differsFromTemplate,
  templateExercisesFromWorkout,
} from '@/lib/activeWorkout';
import { confirmAsync } from '@/lib/dialog';
import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { colors, radius, spacing } from '@/lib/theme';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';
import { useSettings } from '@/state/SettingsContext';

const KEEP_AWAKE_TAG = 'active-workout';

export default function ActiveWorkoutScreen() {
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const active = useActiveWorkout();
  const { workout, update, finish, discard } = active;
  const now = useNow(1000);
  const [saving, setSaving] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    if (!settings.keepScreenOn) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [settings.keepScreenOn]);

  // Leave the screen once the workout is gone (finished or discarded), unless we're navigating to its summary.
  useEffect(() => {
    if (!workout && !finishing.current && router.canGoBack()) router.back();
  }, [workout]);

  if (!workout) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const onFinish = async () => {
    if (completedExercises(workout).length === 0) {
      Alert.alert('No completed sets', 'Tick off at least one set before finishing, or cancel the workout.');
      return;
    }
    const incomplete = countIncompleteSets(workout);
    const ok = await confirmAsync(
      'Finish workout?',
      incomplete > 0
        ? `${incomplete} incomplete set${incomplete === 1 ? '' : 's'} will be discarded.`
        : 'All sets are complete. Nice work!',
      'Finish',
    );
    if (!ok) return;

    setSaving(true);
    try {
      if (workout.templateId != null) {
        const template = await getTemplate(db, workout.templateId);
        if (template && differsFromTemplate(workout, template)) {
          const updateTemplate = await confirmAsync(
            'Update template?',
            `You changed the exercises or sets compared to "${template.name}". Update the template to match?`,
            'Update template',
          );
          if (updateTemplate) {
            await saveTemplate(db, template.id, {
              name: template.name,
              notes: template.notes,
              kind: template.kind,
              exercises: templateExercisesFromWorkout(workout),
            });
          }
        }
      }
      finishing.current = true;
      const id = await finish();
      if (id != null) {
        router.replace({ pathname: '/workout/[id]', params: { id: String(id), summary: '1' } });
        return;
      }
      finishing.current = false;
    } catch (e) {
      finishing.current = false;
      Alert.alert('Could not save workout', String(e));
    }
    setSaving(false);
  };

  const onCancel = async () => {
    const ok = await confirmAsync('Cancel workout?', 'All progress in this workout will be lost.', 'Cancel workout', true);
    if (ok) discard();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Minimize">
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.timer}>
          <Ionicons name="time-outline" size={16} color={colors.muted} />
          <Text style={styles.timerText}>{formatClock((now - workout.startedAt) / 1000)}</Text>
        </View>
        <Button title="Finish" variant="success" small onPress={onFinish} loading={saving} />
      </View>
      <SetTimerBar />
      <RestTimerBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <WorkoutEditor
            mode="live"
            workout={workout}
            onChange={update}
            exercises={active.exercises}
            previous={active.previous}
            onToggleComplete={active.toggleSetComplete}
            onStartTimer={active.startSetTimer}
            timingSetKey={active.setTimer?.setKey}
            header={
              <View>
                <TextInput
                  value={workout.name}
                  onChangeText={(name) => update((w) => ({ ...w, name }))}
                  style={styles.name}
                  placeholder="Workout name"
                  placeholderTextColor={colors.faint}
                />
                <TextInput
                  value={workout.notes}
                  onChangeText={(notes) => update((w) => ({ ...w, notes }))}
                  style={styles.notes}
                  placeholder="Notes"
                  placeholderTextColor={colors.faint}
                  multiline
                />
              </View>
            }
            footer={<Button title="Cancel Workout" variant="danger" onPress={onCancel} style={{ marginTop: spacing.md }} />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: 4 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { color: colors.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 200 },
  name: { color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: 4 },
  notes: { color: colors.muted, fontSize: 15, paddingVertical: 4 },
});
