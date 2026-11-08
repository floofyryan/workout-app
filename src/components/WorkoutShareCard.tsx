import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RecordKey } from '@/lib/calc';
import { shareViewAsImage } from '@/lib/files';
import { formatDate, formatDuration, formatNumber } from '@/lib/format';
import { bestSet, formatSet } from '@/lib/setFormat';
import { errorText } from '@/lib/sharing';
import { colors, radius, spacing } from '@/lib/theme';
import type { UnitSystem, WorkoutDetail } from '@/lib/types';
import { kgToDisplay, weightUnit } from '@/lib/units';
import { Button } from './ui';
import { workoutVolume } from './WorkoutCard';

const MAX_EXERCISES = 8;

/** A finished workout as a picture: name, stats and each exercise's best set. */
export function WorkoutShareCard({
  workout,
  prs,
  units,
}: {
  workout: WorkoutDetail;
  /** Records set, by workout exercise id. */
  prs: Map<number, RecordKey[]>;
  units: UnitSystem;
}) {
  const volume = workoutVolume(workout);
  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const totalPrs = [...prs.values()].reduce((n, l) => n + l.length, 0);
  const shown = workout.exercises.slice(0, MAX_EXERCISES);
  return (
    <View style={styles.card}>
      <Text style={styles.date}>{formatDate(workout.startedAt).toUpperCase()}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {workout.name}
      </Text>
      <View style={styles.stats}>
        <Stat value={formatDuration((workout.endedAt - workout.startedAt) / 1000)} label="Time" />
        {volume > 0 ? (
          <Stat value={`${formatNumber(kgToDisplay(volume, units))} ${weightUnit(units)}`} label="Volume" />
        ) : null}
        <Stat value={String(sets)} label={sets === 1 ? 'Set' : 'Sets'} />
        {totalPrs > 0 ? <Stat value={String(totalPrs)} label={totalPrs === 1 ? 'Record' : 'Records'} gold /> : null}
      </View>
      <View style={styles.list}>
        {shown.map((e) => {
          const best = bestSet(e.exercise.type, e.sets);
          const pr = (prs.get(e.id) ?? []).length > 0;
          return (
            <View key={e.id} style={styles.line}>
              <Text style={styles.exercise} numberOfLines={1}>
                <Text style={styles.count}>{e.sets.length} × </Text>
                {e.exercise.name}
              </Text>
              {pr ? <Ionicons name="trophy" size={13} color={colors.warning} /> : null}
              <Text style={styles.best} numberOfLines={1}>
                {best ? formatSet(e.exercise.type, best, units) : ''}
              </Text>
            </View>
          );
        })}
        {workout.exercises.length > shown.length ? (
          <Text style={styles.more}>+{workout.exercises.length - shown.length} more</Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Ionicons name="barbell" size={14} color={colors.primary} />
        <Text style={styles.footerText}>Logged with Workout</Text>
      </View>
    </View>
  );
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, gold && { color: colors.warning }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Preview of the card with a button to share it as an image. */
export function ShareCardModal({
  visible,
  onClose,
  workout,
  prs,
  units,
}: {
  visible: boolean;
  onClose: () => void;
  workout: WorkoutDetail;
  prs: Map<number, RecordKey[]>;
  units: UnitSystem;
}) {
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (!card.current) return;
    setBusy(true);
    try {
      await shareViewAsImage(card.current, workout.name);
    } catch (e) {
      Alert.alert('Could not share', errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.sheet}>
          {/* Not collapsable, so Android keeps a real view to take the picture of. */}
          <View ref={card} collapsable={false}>
            <WorkoutShareCard workout={workout} prs={prs} units={units} />
          </View>
          <View style={styles.buttons}>
            <Button title="Close" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Share image" icon="share-outline" onPress={share} loading={busy} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  date: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  name: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2, textTransform: 'uppercase', fontWeight: '600' },
  list: { marginTop: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  exercise: { color: colors.text, fontSize: 14, flex: 1 },
  count: { color: colors.muted },
  best: { color: colors.muted, fontSize: 13, maxWidth: 130 },
  more: { color: colors.faint, fontSize: 13, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg },
  footerText: { color: colors.faint, fontSize: 12, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, width: 340 },
});
