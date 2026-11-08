import { useState } from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, Text, View } from 'react-native';

import { usesWeight } from '@/lib/calc';
import { defaultProgression, describeProgression, progressionKinds } from '@/lib/progression';
import { colors, radius, spacing } from '@/lib/theme';
import type { ExerciseType, Progression, UnitSystem } from '@/lib/types';
import { clean, displayToKg, kgToDisplay, weightUnit } from '@/lib/units';
import { NumberInput } from './NumberInput';
import { Button, Chip } from './ui';

type Kind = Progression['kind'] | 'none';

const KIND_LABELS: Record<Kind, string> = {
  none: 'None',
  linear: 'Add each time',
  double: 'Rep range',
};

/** Form values; weights are in the user's unit. Both rules keep their values while switching. */
interface Form {
  kind: Kind;
  linearStep: number | null;
  deloadAfter: number | null;
  deloadPercent: number | null;
  minReps: number | null;
  maxReps: number | null;
  doubleStep: number | null;
}

function toForm(value: Progression | null, type: ExerciseType, units: UnitSystem): Form {
  const weighted = usesWeight(type);
  const linear = value?.kind === 'linear' ? value : defaultProgression('linear', type, units);
  const double = value?.kind === 'double' ? value : defaultProgression('double', type, units);
  const show = (kg: number) => clean(kgToDisplay(kg, units), 2);
  return {
    kind: value?.kind ?? 'none',
    linearStep: weighted ? show(linear.increment) : linear.increment,
    deloadAfter: linear.kind === 'linear' ? linear.deloadAfter : 3,
    deloadPercent: linear.kind === 'linear' ? linear.deloadPercent : 10,
    minReps: double.kind === 'double' ? double.minReps : 8,
    maxReps: double.kind === 'double' ? double.maxReps : 12,
    doubleStep: show(double.increment),
  };
}

/** The rule the form describes, null for none, or undefined while a value is missing or invalid. */
function fromForm(
  f: Form,
  type: ExerciseType,
  units: UnitSystem,
  previous: Progression | null,
): Progression | null | undefined {
  if (f.kind === 'none') return null;
  if (f.kind === 'linear') {
    const { linearStep: step, deloadAfter, deloadPercent } = f;
    if (step == null || step <= 0 || deloadAfter == null || deloadAfter < 1) return undefined;
    if (deloadPercent == null || deloadPercent < 0 || deloadPercent >= 100) return undefined;
    return {
      kind: 'linear',
      increment: usesWeight(type) ? displayToKg(step, units) : step,
      deloadAfter: Math.round(deloadAfter),
      deloadPercent,
      // Editing a rule keeps the misses counted so far.
      misses: previous?.kind === 'linear' ? (previous.misses ?? 0) : 0,
    };
  }
  const { minReps, maxReps, doubleStep: step } = f;
  if (minReps == null || maxReps == null || minReps < 1 || maxReps <= minReps) return undefined;
  if (step == null || step <= 0) return undefined;
  return { kind: 'double', minReps, maxReps, increment: displayToKg(step, units) };
}

/** Sets how an exercise's targets move on after each session, or turns that off. */
export function ProgressionSheet({
  visible,
  exerciseName,
  type,
  value,
  units,
  onSave,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  type: ExerciseType;
  value: Progression | null;
  units: UnitSystem;
  onSave: (rule: Progression | null) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => toForm(value, type, units));
  const [wasVisible, setWasVisible] = useState(visible);
  // Start from the exercise's current rule each time the sheet opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setForm(toForm(value, type, units));
  }
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const rule = fromForm(form, type, units, value);
  const weighted = usesWeight(type);
  const linearUnit = weighted ? weightUnit(units) : type === 'duration' ? 'seconds' : 'reps';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.center}>
        <View style={styles.dialog}>
          <Text style={styles.title}>Progression</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {exerciseName}
          </Text>
          <View style={styles.kinds}>
            {(['none', ...progressionKinds(type)] as Kind[]).map((k) => (
              <Chip key={k} label={KIND_LABELS[k]} selected={form.kind === k} onPress={() => set({ kind: k })} />
            ))}
          </View>

          {form.kind === 'linear' && (
            <>
              <Field label={`Add (${linearUnit})`}>
                <NumberInput value={form.linearStep} onChange={(v) => set({ linearStep: v })} integer={!weighted} style={styles.input} />
              </Field>
              <Text style={styles.hint}>
                {type === 'duration' ? 'when every hold lasts its time.' : 'when every set hits its reps.'}
              </Text>
              <Field label="Misses in a row before a deload">
                <NumberInput integer value={form.deloadAfter} onChange={(v) => set({ deloadAfter: v })} style={styles.input} />
              </Field>
              <Field label="Deload by (%)">
                <NumberInput integer value={form.deloadPercent} onChange={(v) => set({ deloadPercent: v })} style={styles.input} />
              </Field>
            </>
          )}
          {form.kind === 'double' && (
            <>
              <Field label="Lowest reps">
                <NumberInput integer value={form.minReps} onChange={(v) => set({ minReps: v })} style={styles.input} />
              </Field>
              <Field label="Highest reps">
                <NumberInput integer value={form.maxReps} onChange={(v) => set({ maxReps: v })} style={styles.input} />
              </Field>
              <Field label={`Then add (${weightUnit(units)})`}>
                <NumberInput value={form.doubleStep} onChange={(v) => set({ doubleStep: v })} style={styles.input} />
              </Field>
            </>
          )}

          <Text style={styles.summary}>
            {rule === undefined
              ? 'Fill in every value (the highest reps must be above the lowest).'
              : rule === null
                ? 'Targets stay as you set them.'
                : `${describeProgression(rule, type, units)}. Applied when you finish a workout started from this template.`}
          </Text>
          <View style={styles.buttons}>
            <Button title="Cancel" variant="secondary" small onPress={onClose} />
            <Button
              title="Save"
              small
              disabled={rule === undefined}
              onPress={() => {
                if (rule === undefined) return;
                onSave(rule);
                onClose();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 2 },
  kinds: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.md },
  label: { color: colors.text, fontSize: 15, flex: 1 },
  input: { width: 80 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  summary: { color: colors.muted, fontSize: 13, marginTop: spacing.md },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.sm },
});
