import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';

import { DurationInput, NumberInput } from '@/components/NumberInput';
import { Button, Card, Chip, SectionTitle } from '@/components/ui';
import { confirmAsync } from '@/lib/dialog';
import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import {
  describeIntervals,
  INTERVAL_DEFAULTS,
  INTERVAL_MODE_LABELS,
  phaseAlert,
  phasesFor,
  positionAt,
  PREP_SECONDS,
  totalSeconds,
  type IntervalConfig,
  type IntervalMode,
} from '@/lib/intervals';
import { colors, radius, spacing } from '@/lib/theme';
import { cancelTimerNotification, scheduleTimerNotification } from '@/lib/timerNotifications';
import { useSettings } from '@/state/SettingsContext';

const KEEP_AWAKE_TAG = 'interval-timer';
const MODES = Object.keys(INTERVAL_MODE_LABELS) as IntervalMode[];
// Phones cap how many alerts an app can have waiting, so only the next ones are scheduled.
const MAX_ALERTS = 40;

const MODE_HINTS: Record<IntervalMode, string> = {
  emom: 'Every minute on the minute: start your reps at the top of each interval and rest for whatever is left.',
  tabata: '20 seconds all-out, 10 seconds rest.',
  custom: 'Your own work and rest times.',
  amrap: 'As many rounds as possible before the time runs out. Tap +1 at the end of each round.',
};

/** Seconds run before the last start, plus the time since that start (null while paused). */
interface Run {
  since: number | null;
  before: number;
}

export default function IntervalTimerScreen() {
  const navigation = useNavigation();
  const { settings } = useSettings();
  const [config, setConfig] = useState<IntervalConfig>(INTERVAL_DEFAULTS.emom);
  const [run, setRun] = useState<Run | null>(null);
  const [roundsDone, setRoundsDone] = useState(0);
  const now = useNow(200);

  const phases = useMemo(() => phasesFor(config), [config]);
  const total = totalSeconds(phases);
  const lastRound = phases[phases.length - 1].round;
  const elapsed = run ? run.before + (run.since != null ? Math.max(0, now - run.since) / 1000 : 0) : 0;
  const { index, remaining } = positionAt(phases, elapsed);
  const done = run != null && index >= phases.length;
  const running = run?.since != null && !done;
  const phase = phases[Math.min(index, phases.length - 1)];
  const set = (patch: Partial<IntervalConfig>) => setConfig((c) => ({ ...c, ...patch }));

  // ---------- Alerts for when the screen is off ----------
  const alerts = useRef<Promise<string | null>[]>([]);
  const cancelAlerts = useCallback(() => {
    alerts.current.forEach(cancelTimerNotification);
    alerts.current = [];
  }, []);
  useEffect(() => cancelAlerts, [cancelAlerts]);
  const scheduleAlerts = (fromElapsed: number, startedAt: number) => {
    cancelAlerts();
    if (!settings.timerNotifications) return;
    const zero = startedAt - fromElapsed * 1000;
    alerts.current = phases
      .filter((p) => p.start > fromElapsed)
      .slice(0, MAX_ALERTS)
      .map((p) => {
        const { title, body } = phaseAlert(p, lastRound);
        return scheduleTimerNotification(zero + p.start * 1000, title, body);
      });
    alerts.current.push(scheduleTimerNotification(zero + total * 1000, 'Intervals done', describeIntervals(config)));
  };

  // ---------- Cues ----------
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [running]);

  // Buzz when a phase starts (but not on pressing Start).
  const shownIndex = useRef<number | null>(null);
  useEffect(() => {
    if (!run) {
      shownIndex.current = null;
      return;
    }
    const previous = shownIndex.current;
    shownIndex.current = index;
    if (previous == null || previous === index) return;
    if (index >= phases.length) {
      Vibration.vibrate([0, 500, 200, 500]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Vibration.vibrate(phases[index].kind === 'work' ? [0, 400] : [0, 200, 120, 200]);
    }
  }, [run, index, phases]);

  // A tick for each of the last three seconds.
  const secondsLeft = Math.ceil(remaining);
  useEffect(() => {
    if (running && secondsLeft >= 1 && secondsLeft <= 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [running, secondsLeft]);

  usePreventRemove(run != null && !done, ({ data }) => {
    confirmAsync('Stop the timer?', 'Leaving stops the interval timer.', 'Stop', true).then((ok) => {
      if (ok) navigation.dispatch(data.action);
    });
  });

  // ---------- Controls ----------
  const start = () => {
    const t = Date.now();
    setRun({ since: t, before: 0 });
    setRoundsDone(0);
    scheduleAlerts(0, t);
  };
  const pause = () => {
    if (run?.since == null) return;
    setRun({ since: null, before: run.before + (Date.now() - run.since) / 1000 });
    cancelAlerts();
  };
  const resume = () => {
    if (!run) return;
    const t = Date.now();
    setRun({ since: t, before: run.before });
    scheduleAlerts(run.before, t);
  };
  const stop = () => {
    setRun(null);
    cancelAlerts();
  };

  if (!run) {
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Type</SectionTitle>
        <View style={styles.wrap}>
          {MODES.map((m) => (
            <View key={m} style={styles.chipWrap}>
              <Chip label={INTERVAL_MODE_LABELS[m]} selected={config.mode === m} onPress={() => setConfig(INTERVAL_DEFAULTS[m])} />
            </View>
          ))}
        </View>
        <Text style={styles.hint}>{MODE_HINTS[config.mode]}</Text>
        <Card style={{ marginTop: spacing.md }}>
          {config.mode === 'emom' || config.mode === 'amrap' || config.mode === 'custom' ? (
            <Field label={config.mode === 'emom' ? 'Every' : config.mode === 'amrap' ? 'Time' : 'Work'}>
              <DurationInput value={config.work} onChange={(v) => v && set({ work: v })} style={styles.input} />
            </Field>
          ) : null}
          {config.mode === 'custom' ? (
            <Field label="Rest">
              <DurationInput value={config.rest} onChange={(v) => v != null && set({ rest: v })} style={styles.input} />
            </Field>
          ) : null}
          {config.mode !== 'amrap' ? (
            <Field label="Rounds">
              <NumberInput integer value={config.rounds} onChange={(v) => v && set({ rounds: v })} style={styles.input} />
            </Field>
          ) : null}
        </Card>
        <Text style={styles.summary}>
          {describeIntervals(config)} · {formatClock(total)} in all, after a {PREP_SECONDS} s countdown
        </Text>
        <Button title="Start" icon="play" onPress={start} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    );
  }

  const color = done ? colors.success : phase.kind === 'prep' ? colors.warning : phase.kind === 'work' ? colors.success : colors.primary;
  const label = done
    ? 'DONE'
    : phase.kind === 'prep'
      ? 'GET READY'
      : phase.kind === 'rest'
        ? 'REST'
        : config.mode === 'amrap'
          ? 'AMRAP'
          : 'WORK';
  const progress = done ? 1 : 1 - remaining / phase.duration;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.face, { borderColor: color }]}>
        <Text style={[styles.phase, { color }]}>{label}</Text>
        <Text style={styles.clock}>{formatClock(done ? 0 : secondsLeft)}</Text>
        {!done && phase.round > 0 && lastRound > 1 ? (
          <Text style={styles.round}>
            Round {phase.round} of {lastRound}
          </Text>
        ) : null}
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.totalLeft}>
          {done ? `Finished: ${describeIntervals(config)}` : `${formatClock(Math.ceil(total - elapsed))} left · ${describeIntervals(config)}`}
        </Text>
      </View>

      {config.mode === 'amrap' ? (
        <View style={styles.amrap}>
          <Text style={styles.roundsDone}>
            {roundsDone} round{roundsDone === 1 ? '' : 's'}
          </Text>
          <View style={styles.row}>
            {roundsDone > 0 ? (
              <Button title="−1" variant="secondary" onPress={() => setRoundsDone((r) => Math.max(0, r - 1))} />
            ) : null}
            <Button title="+1 round" icon="add" onPress={() => setRoundsDone((r) => r + 1)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      <View style={[styles.row, { marginTop: spacing.xl }]}>
        {!done ? (
          running ? (
            <Button title="Pause" icon="pause" variant="secondary" onPress={pause} style={{ flex: 1 }} />
          ) : (
            <Button title="Resume" icon="play" onPress={resume} style={{ flex: 1 }} />
          )
        ) : null}
        <Button
          title={done ? 'Done' : 'Stop'}
          icon={done ? 'checkmark' : 'stop'}
          variant={done ? 'primary' : 'danger'}
          onPress={stop}
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
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
  content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 60 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chipWrap: { marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: 14 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: colors.text, fontSize: 16 },
  input: { width: 100, fontSize: 18 },
  summary: { color: colors.muted, fontSize: 13, marginTop: spacing.md, textAlign: 'center' },
  face: {
    marginTop: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  phase: { fontSize: 20, fontWeight: '800', letterSpacing: 1.5 },
  clock: { color: colors.text, fontSize: 88, fontWeight: '800', fontVariant: ['tabular-nums'] },
  round: { color: colors.muted, fontSize: 18, fontWeight: '600' },
  bar: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, marginTop: spacing.lg, overflow: 'hidden' },
  fill: { height: '100%' },
  totalLeft: { color: colors.muted, fontSize: 14, marginTop: spacing.md, textAlign: 'center' },
  amrap: { marginTop: spacing.lg, alignItems: 'center', gap: spacing.md },
  roundsDone: { color: colors.text, fontSize: 28, fontWeight: '800' },
  row: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
});
