import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  addExercisesTo,
  addSetTo,
  insertSetsAtStart,
  leaveSuperset,
  removeExerciseFrom,
  removeSetFrom,
  reorderExercises,
  replaceExerciseIn,
  supersetWithNext,
  updateExerciseIn,
  updateSetIn,
  type ActiveExercise,
  type ActiveSet,
  type ActiveWorkout,
} from '@/lib/activeWorkout';
import { usesWeight, warmupSets } from '@/lib/calc';
import { formatClock } from '@/lib/format';
import { setPickerHandler } from '@/lib/picker';
import { formatSet } from '@/lib/setFormat';
import { colors, radius, spacing } from '@/lib/theme';
import type { Exercise, SetData, SetType } from '@/lib/types';
import {
  clean,
  displayToKg,
  displayToMetres,
  distanceUnit,
  kgToDisplay,
  metresToDisplay,
  weightUnit,
} from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';
import { DurationInput, NumberInput } from './NumberInput';
import { ActionSheet, PromptModal, type SheetAction } from './Sheets';
import { ReorderSheet, SwipeToDelete } from './Sortable';
import { Button } from './ui';

export type EditorMode = 'live' | 'edit' | 'template';

type Change = (fn: (w: ActiveWorkout) => ActiveWorkout) => void;

const BARBELL_LIKE = new Set(['Barbell', 'Smith Machine', 'EZ Bar', 'Trap Bar']);

/** Colours that tell supersets apart. */
const SUPERSET_COLORS = ['#A855F7', '#F59E0B', '#14B8A6', '#EC4899', '#22C55E'];

/** Colour for each exercise's superset (null when it isn't in one). */
export function supersetColors(exercises: { supersetId?: string | null }[]): (string | null)[] {
  const ids = new Map<string, string>();
  return exercises.map((e) => {
    if (!e.supersetId) return null;
    if (!ids.has(e.supersetId)) ids.set(e.supersetId, SUPERSET_COLORS[ids.size % SUPERSET_COLORS.length]);
    return ids.get(e.supersetId)!;
  });
}

/** Editable list of exercises and sets, used for live workouts, past workouts and templates. */
export function WorkoutEditor({
  workout,
  onChange,
  exercises,
  previous,
  mode,
  onToggleComplete,
  onStartTimer,
  timingSetKey,
  header,
  footer,
}: {
  workout: ActiveWorkout;
  onChange: Change;
  exercises: Map<number, Exercise>;
  previous?: Map<number, SetData[]>;
  mode: EditorMode;
  onToggleComplete?: (exerciseKey: string, setKey: string) => void;
  /** Starts the countdown for a timed set (live workouts only). */
  onStartTimer?: (exerciseKey: string, setKey: string) => void;
  /** The set whose countdown is running, if any. */
  timingSetKey?: string | null;
  header?: ReactElement;
  footer?: ReactElement;
}) {
  const { settings } = useSettings();
  const [sheet, setSheet] = useState<{ title: string; actions: SheetAction[] } | null>(null);
  const [prompt, setPrompt] = useState<{
    title: string;
    initial: string;
    numeric?: boolean;
    multiline?: boolean;
    onSubmit: (v: string) => void;
  } | null>(null);
  const [reordering, setReordering] = useState(false);
  const colorsBySuperset = supersetColors(workout.exercises);

  const addExercises = () => {
    setPickerHandler((ids) => onChange((w) => addExercisesTo(w, ids, mode === 'edit')));
    router.push('/exercise-picker');
  };

  const openExerciseMenu = (item: ActiveExercise, index: number) => {
    const ex = exercises.get(item.exerciseId);
    const actions: SheetAction[] = [
      {
        label: item.notes ? 'Edit note' : 'Add note',
        icon: 'create-outline',
        onPress: () =>
          setPrompt({
            title: 'Exercise note',
            initial: item.notes,
            multiline: true,
            onSubmit: (v) => onChange((w) => updateExerciseIn(w, item.key, { notes: v.trim() })),
          }),
      },
    ];
    if (mode !== 'edit') {
      actions.push({
        label: 'Rest timer',
        icon: 'timer-outline',
        onPress: () =>
          setPrompt({
            title: 'Rest time (seconds)',
            initial: String(item.restSeconds ?? ex?.restSeconds ?? settings.defaultRestSeconds),
            numeric: true,
            onSubmit: (v) => {
              const n = parseInt(v, 10);
              onChange((w) =>
                updateExerciseIn(w, item.key, { restSeconds: Number.isFinite(n) ? Math.max(0, n) : null }),
              );
            },
          }),
      });
    }
    if (ex && usesWeight(ex.type) && ex.type !== 'assisted_bodyweight') {
      actions.push({
        label: 'Add warm-up sets',
        icon: 'flame-outline',
        onPress: () => {
          const working =
            item.sets.find((s) => s.setType !== 'warmup' && s.weight)?.weight ??
            previous?.get(item.exerciseId)?.find((s) => s.setType !== 'warmup' && s.weight)?.weight ??
            null;
          if (!working) return;
          const barbell = BARBELL_LIKE.has(ex.equipment);
          const bar = barbell ? settings.barWeight : 0;
          const increment = settings.units === 'metric' ? 2.5 : 5;
          let ramp = warmupSets(kgToDisplay(working, settings.units), bar, increment);
          if (!barbell) ramp = ramp.slice(1);
          onChange((w) =>
            insertSetsAtStart(
              w,
              item.key,
              ramp.map((r) => ({
                setType: 'warmup' as SetType,
                weight: displayToKg(r.weight, settings.units),
                reps: r.reps,
              })),
            ),
          );
        },
      });
    }
    actions.push({
      label: 'Replace exercise',
      icon: 'swap-horizontal-outline',
      onPress: () => {
        setPickerHandler((ids) => {
          if (ids[0] != null) onChange((w) => replaceExerciseIn(w, item.key, ids[0]));
        });
        router.push({ pathname: '/exercise-picker', params: { single: '1' } });
      },
    });
    const next = workout.exercises[index + 1];
    if (next && (!item.supersetId || next.supersetId !== item.supersetId)) {
      actions.push({
        label: `Superset with ${exercises.get(next.exerciseId)?.name ?? 'next exercise'}`,
        icon: 'link-outline',
        onPress: () => onChange((w) => supersetWithNext(w, item.key)),
      });
    }
    if (item.supersetId) {
      actions.push({
        label: 'Remove from superset',
        icon: 'unlink-outline',
        onPress: () => onChange((w) => leaveSuperset(w, item.key)),
      });
    }
    if (workout.exercises.length > 1) {
      actions.push({ label: 'Reorder exercises', icon: 'reorder-three-outline', onPress: () => setReordering(true) });
    }
    actions.push({
      label: 'Remove exercise',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => onChange((w) => removeExerciseFrom(w, item.key)),
    });
    setSheet({ title: ex?.name ?? 'Exercise', actions });
  };

  const openSetMenu = (item: ActiveExercise, set: ActiveSet) => {
    const setType = (t: SetType) => () => onChange((w) => updateSetIn(w, item.key, set.key, { setType: t }));
    setSheet({
      title: 'Set type',
      actions: [
        { label: 'Normal set', icon: 'ellipse-outline', onPress: setType('normal') },
        { label: 'Warm-up set', icon: 'flame-outline', onPress: setType('warmup') },
        { label: 'Drop set', icon: 'trending-down', onPress: setType('drop') },
        { label: 'Failure set', icon: 'alert-circle-outline', onPress: setType('failure') },
        {
          label: 'Delete set',
          icon: 'trash-outline',
          destructive: true,
          onPress: () => onChange((w) => removeSetFrom(w, item.key, set.key)),
        },
      ],
    });
  };

  return (
    <>
      {header}
      {workout.exercises.map((item, index) => (
        <ExerciseBlock
          key={item.key}
          item={item}
          supersetColor={colorsBySuperset[index]}
          // Label the first exercise of each superset; tighten the gap within one.
          supersetStart={!!item.supersetId && workout.exercises[index - 1]?.supersetId !== item.supersetId}
          inSupersetAfterFirst={!!item.supersetId && workout.exercises[index - 1]?.supersetId === item.supersetId}
          exercise={exercises.get(item.exerciseId)}
          previous={previous?.get(item.exerciseId)}
          mode={mode}
          onMenu={() => openExerciseMenu(item, index)}
          onSetMenu={(set) => openSetMenu(item, set)}
          onUpdateSet={(setKey, patch) => onChange((w) => updateSetIn(w, item.key, setKey, patch))}
          onToggleComplete={onToggleComplete ? (setKey) => onToggleComplete(item.key, setKey) : undefined}
          onStartTimer={onStartTimer ? (setKey) => onStartTimer(item.key, setKey) : undefined}
          timingSetKey={timingSetKey}
          onAddSet={() => onChange((w) => addSetTo(w, item.key, mode === 'edit'))}
          onRemoveSet={(setKey) => onChange((w) => removeSetFrom(w, item.key, setKey))}
          onNotesChange={(notes) => onChange((w) => updateExerciseIn(w, item.key, { notes }))}
        />
      ))}
      <Button
        title="Add Exercises"
        variant="secondary"
        icon="add"
        onPress={addExercises}
        style={{ marginTop: spacing.lg }}
      />
      {footer}

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
      <ReorderSheet
        visible={reordering}
        title="Reorder exercises"
        items={workout.exercises.map((e, i) => ({
          key: e.key,
          label: exercises.get(e.exerciseId)?.name ?? 'Exercise',
          sublabel: `${e.sets.length} set${e.sets.length === 1 ? '' : 's'}${e.supersetId ? ' · superset' : ''}`,
          accent: colorsBySuperset[i],
        }))}
        onDone={(keys) => onChange((w) => reorderExercises(w, keys))}
        onClose={() => setReordering(false)}
      />
      <PromptModal
        visible={!!prompt}
        title={prompt?.title ?? ''}
        initialValue={prompt?.initial}
        keyboardType={prompt?.numeric ? 'number-pad' : 'default'}
        multiline={prompt?.multiline}
        onSubmit={(v) => prompt?.onSubmit(v)}
        onClose={() => setPrompt(null)}
      />
    </>
  );
}

function ExerciseBlock({
  item,
  exercise,
  previous,
  mode,
  onMenu,
  onSetMenu,
  onUpdateSet,
  onToggleComplete,
  onStartTimer,
  timingSetKey,
  onAddSet,
  onRemoveSet,
  onNotesChange,
  supersetColor,
  supersetStart,
  inSupersetAfterFirst,
}: {
  item: ActiveExercise;
  exercise: Exercise | undefined;
  previous: SetData[] | undefined;
  mode: EditorMode;
  onMenu: () => void;
  onSetMenu: (set: ActiveSet) => void;
  onUpdateSet: (setKey: string, patch: Partial<ActiveSet>) => void;
  onToggleComplete?: (setKey: string) => void;
  onStartTimer?: (setKey: string) => void;
  timingSetKey?: string | null;
  onAddSet: () => void;
  onRemoveSet: (setKey: string) => void;
  onNotesChange: (notes: string) => void;
  supersetColor?: string | null;
  supersetStart?: boolean;
  inSupersetAfterFirst?: boolean;
}) {
  const { settings } = useSettings();
  const units = settings.units;
  const type = exercise?.type ?? 'weight_reps';
  const wu = weightUnit(units).toUpperCase();
  const showCheck = mode === 'live';
  // Holds like planks get a countdown button that completes the set and starts the rest timer.
  const showTimer = mode === 'live' && type === 'duration' && !!onStartTimer;

  const columns: string[] = (() => {
    switch (type) {
      case 'weight_reps':
        return [wu, 'REPS'];
      case 'weighted_bodyweight':
        return [`+${wu}`, 'REPS'];
      case 'assisted_bodyweight':
        return [`−${wu}`, 'REPS'];
      case 'reps':
        return ['REPS'];
      case 'duration':
        return ['TIME'];
      case 'distance_duration':
        return [distanceUnit(units).toUpperCase(), 'TIME'];
    }
  })();

  let normalIndex = 0;

  return (
    <View
      style={[
        styles.block,
        supersetColor ? [styles.supersetBlock, { borderLeftColor: supersetColor }] : null,
        inSupersetAfterFirst && styles.supersetFollow,
      ]}
    >
      {supersetStart && supersetColor ? (
        <View style={styles.supersetTag}>
          <Ionicons name="link" size={12} color={supersetColor} />
          <Text style={[styles.supersetTagText, { color: supersetColor }]}>SUPERSET</Text>
        </View>
      ) : null}
      <View style={styles.blockHeader}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => exercise && router.push({ pathname: '/exercise/[id]', params: { id: String(exercise.id) } })}
        >
          <Text style={styles.exerciseName}>{exercise?.name ?? 'Loading…'}</Text>
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={10} style={styles.menuButton} accessibilityLabel="Exercise options">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.primary} />
        </Pressable>
      </View>
      {item.notes ? (
        <TextInput
          value={item.notes}
          onChangeText={onNotesChange}
          multiline
          style={styles.notes}
          placeholderTextColor={colors.faint}
        />
      ) : null}
      {mode !== 'edit' && item.restSeconds != null ? (
        <Text style={styles.restLabel}>Rest: {formatClock(item.restSeconds)}</Text>
      ) : null}

      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.colSet, styles.headerText]}>SET</Text>
        <Text style={[styles.colPrev, styles.headerText]}>PREVIOUS</Text>
        {columns.map((c) => (
          <Text key={c} style={[styles.colInput, styles.headerText]}>
            {c}
          </Text>
        ))}
        {showTimer && <View style={styles.colCheck} />}
        {showCheck && <View style={styles.colCheck} />}
      </View>

      {item.sets.map((set, i) => {
        const prev = previous?.[i];
        const label = set.setType === 'normal' ? String(++normalIndex) : set.setType[0].toUpperCase();
        const labelColor =
          set.setType === 'warmup'
            ? colors.warning
            : set.setType === 'drop'
              ? colors.purple
              : set.setType === 'failure'
                ? colors.danger
                : colors.text;
        const fillFromPrev = () => {
          if (!prev) return;
          onUpdateSet(set.key, {
            weight: prev.weight,
            reps: prev.reps,
            durationS: prev.durationS,
            distanceM: prev.distanceM,
          });
        };
        const ph = (v: number | null | undefined) => (v == null ? '' : String(v));
        return (
          <SwipeToDelete key={set.key} onDelete={() => onRemoveSet(set.key)}>
            <View
              style={[
                styles.row,
                styles.setRow,
                styles.setRowBg,
                set.completed && showCheck && styles.completedRow,
                timingSetKey === set.key && styles.timingRow,
              ]}
            >
              <Pressable onPress={() => onSetMenu(set)} style={styles.colSet} hitSlop={4}>
                <Text style={[styles.setLabel, { color: labelColor }]}>{label}</Text>
              </Pressable>
              <Pressable onPress={fillFromPrev} style={styles.colPrev}>
                <Text style={styles.prevText} numberOfLines={1}>
                  {prev ? formatSet(type, prev, units) : '–'}
                </Text>
              </Pressable>
              {usesWeight(type) && (
                <NumberInput
                  value={set.weight == null ? null : kgToDisplay(set.weight, units)}
                  onChange={(v) => onUpdateSet(set.key, { weight: v == null ? null : displayToKg(v, units) })}
                  placeholder={prev?.weight != null ? ph(clean(kgToDisplay(prev.weight, units), 1)) : ''}
                  style={[styles.colInput, styles.input, set.completed && showCheck && styles.inputDone]}
                />
              )}
              {type === 'distance_duration' && (
                <NumberInput
                  value={set.distanceM == null ? null : metresToDisplay(set.distanceM, units)}
                  onChange={(v) => onUpdateSet(set.key, { distanceM: v == null ? null : displayToMetres(v, units) })}
                  placeholder={prev?.distanceM != null ? ph(clean(metresToDisplay(prev.distanceM, units), 2)) : ''}
                  style={[styles.colInput, styles.input, set.completed && showCheck && styles.inputDone]}
                />
              )}
              {type !== 'duration' && type !== 'distance_duration' && (
                <NumberInput
                  integer
                  value={set.reps}
                  onChange={(v) => onUpdateSet(set.key, { reps: v })}
                  placeholder={ph(prev?.reps)}
                  style={[styles.colInput, styles.input, set.completed && showCheck && styles.inputDone]}
                />
              )}
              {(type === 'duration' || type === 'distance_duration') && (
                <DurationInput
                  value={set.durationS}
                  onChange={(v) => onUpdateSet(set.key, { durationS: v })}
                  placeholder={prev?.durationS != null ? formatClock(prev.durationS) : ''}
                  style={[styles.colInput, styles.input, set.completed && showCheck && styles.inputDone]}
                />
              )}
              {showTimer && (
                <Pressable
                  onPress={() => onStartTimer?.(set.key)}
                  disabled={set.completed || timingSetKey === set.key}
                  style={[
                    styles.colCheck,
                    styles.check,
                    styles.play,
                    (set.completed || timingSetKey === set.key) && { opacity: 0.35 },
                  ]}
                  hitSlop={6}
                  accessibilityLabel="Start set timer"
                >
                  <Ionicons
                    name={timingSetKey === set.key ? 'hourglass-outline' : 'play'}
                    size={16}
                    color={colors.primary}
                  />
                </Pressable>
              )}
              {showCheck && (
                <Pressable
                  onPress={() => onToggleComplete?.(set.key)}
                  style={[styles.colCheck, styles.check, set.completed && styles.checkDone]}
                  hitSlop={6}
                  accessibilityLabel={set.completed ? 'Mark set incomplete' : 'Complete set'}
                >
                  <Ionicons name="checkmark" size={18} color={set.completed ? '#fff' : colors.muted} />
                </Pressable>
              )}
            </View>
          </SwipeToDelete>
        );
      })}

      <Pressable onPress={onAddSet} style={({ pressed }) => [styles.addSet, pressed && { opacity: 0.6 }]}>
        <Text style={styles.addSetText}>+ Add Set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.xl },
  supersetBlock: { borderLeftWidth: 3, paddingLeft: spacing.sm, borderRadius: 2 },
  supersetFollow: { marginTop: spacing.md },
  supersetTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  supersetTagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  setRowBg: { backgroundColor: colors.background },
  blockHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  exerciseName: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  menuButton: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  notes: {
    color: colors.warning,
    fontSize: 14,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  restLabel: { color: colors.muted, fontSize: 12, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRow: { paddingVertical: 4 },
  headerText: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  setRow: { paddingVertical: 4, paddingHorizontal: 2, borderRadius: radius.sm },
  completedRow: { backgroundColor: 'rgba(34,197,94,0.18)' },
  timingRow: { borderWidth: 1, borderColor: colors.success },
  colSet: { width: 32, alignItems: 'center' },
  colPrev: { flex: 1.5, alignItems: 'center', minWidth: 0 },
  colInput: { flex: 1, minWidth: 0 },
  colCheck: { width: 34 },
  setLabel: { fontWeight: '700', fontSize: 15, textAlign: 'center' },
  prevText: { color: colors.faint, fontSize: 13 },
  input: { paddingVertical: 5 },
  inputDone: { backgroundColor: 'transparent' },
  check: {
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success },
  play: { backgroundColor: 'rgba(59,130,246,0.15)' },
  addSet: {
    marginTop: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addSetText: { color: colors.text, fontWeight: '600' },
});
