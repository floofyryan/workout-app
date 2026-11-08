// Interval timer schedules (EMOM, Tabata, work/rest, AMRAP). Pure: the screen works out where it is
// from the time elapsed, so it stays right however late the timers fire.
import { formatClock } from './format';

export type IntervalMode = 'emom' | 'tabata' | 'custom' | 'amrap';

export const INTERVAL_MODE_LABELS: Record<IntervalMode, string> = {
  emom: 'EMOM',
  tabata: 'Tabata',
  custom: 'Work / rest',
  amrap: 'AMRAP',
};

export interface IntervalConfig {
  mode: IntervalMode;
  /** Seconds of work: the interval for EMOM, the whole time for AMRAP. */
  work: number;
  /** Seconds of rest between rounds (work / rest only; Tabata is always 20 on, 10 off). */
  rest: number;
  rounds: number;
}

export const INTERVAL_DEFAULTS: Record<IntervalMode, IntervalConfig> = {
  emom: { mode: 'emom', work: 60, rest: 0, rounds: 10 },
  tabata: { mode: 'tabata', work: 20, rest: 10, rounds: 8 },
  custom: { mode: 'custom', work: 40, rest: 20, rounds: 8 },
  amrap: { mode: 'amrap', work: 12 * 60, rest: 0, rounds: 1 },
};

export const PREP_SECONDS = 10;

export interface Phase {
  kind: 'prep' | 'work' | 'rest';
  /** Round number from 1 (0 for the get-ready countdown). */
  round: number;
  /** Seconds from the start of the timer. */
  start: number;
  duration: number;
}

/** The config as it runs: Tabata's fixed times, one round for AMRAP, at least a second each. */
function effective(c: IntervalConfig): IntervalConfig {
  const rounds = c.mode === 'amrap' ? 1 : Math.max(1, Math.round(c.rounds));
  if (c.mode === 'tabata') return { ...c, work: 20, rest: 10, rounds };
  return {
    ...c,
    work: Math.max(1, Math.round(c.work)),
    rest: c.mode === 'custom' ? Math.max(0, Math.round(c.rest)) : 0,
    rounds,
  };
}

/** Get ready, then the rounds; no rest after the last one. */
export function phasesFor(config: IntervalConfig): Phase[] {
  const { work, rest, rounds } = effective(config);
  const phases: Phase[] = [{ kind: 'prep', round: 0, start: 0, duration: PREP_SECONDS }];
  let t = PREP_SECONDS;
  const add = (kind: Phase['kind'], round: number, duration: number) => {
    if (duration <= 0) return;
    phases.push({ kind, round, start: t, duration });
    t += duration;
  };
  for (let round = 1; round <= rounds; round++) {
    add('work', round, work);
    if (round < rounds) add('rest', round, rest);
  }
  return phases;
}

export function totalSeconds(phases: Phase[]): number {
  const last = phases[phases.length - 1];
  return last.start + last.duration;
}

/** The phase the timer is in after `elapsed` seconds (phases.length once it's done) and its time left. */
export function positionAt(phases: Phase[], elapsed: number): { index: number; remaining: number } {
  for (const [index, p] of phases.entries()) {
    if (elapsed < p.start + p.duration) return { index, remaining: p.start + p.duration - elapsed };
  }
  return { index: phases.length, remaining: 0 };
}

/** E.g. "10 × 1:00", "8 × 0:20 on / 0:10 off", "12:00". */
export function describeIntervals(config: IntervalConfig): string {
  const { work, rest, rounds, mode } = effective(config);
  if (mode === 'amrap') return `${formatClock(work)} AMRAP`;
  if (mode === 'emom') return `${rounds} × ${formatClock(work)}`;
  return rest > 0 ? `${rounds} × ${formatClock(work)} on / ${formatClock(rest)} off` : `${rounds} × ${formatClock(work)}`;
}

/** What a notification at the start of a phase says. */
export function phaseAlert(phase: Phase, rounds: number): { title: string; body: string } {
  if (phase.kind === 'rest') return { title: 'Rest', body: `Round ${phase.round} of ${rounds} done.` };
  return { title: rounds > 1 ? `Round ${phase.round} of ${rounds}` : 'Go!', body: 'Work!' };
}
