import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Beeps for the end of the rest and hold timers while the app is open. Other apps' audio (music,
// podcasts) is ducked — turned down, not paused — for the length of the beep and comes back up
// when it finishes. (In the background the scheduled notification makes the sound instead.)

const SOURCES = {
  rest: require('../../assets/sounds/rest-over.wav'),
  hold: require('../../assets/sounds/hold-done.wav'),
  /** 3-2-1 pips and the end-of-rest beep in one sound, so other audio dips once (restCountdown.ts). */
  countdown: require('../../assets/sounds/countdown.wav'),
};
export type TimerSound = keyof typeof SOURCES;

const players: Partial<Record<TimerSound, AudioPlayer>> = {};
let configured: Promise<void> | null = null;

function configure(): Promise<void> {
  configured ??= setAudioModeAsync({
    // iOS only allows ducking other audio when playback ignores the silent switch.
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: false,
  }).catch(() => {});
  return configured;
}

function player(kind: TimerSound): AudioPlayer {
  return (players[kind] ??= createAudioPlayer(SOURCES[kind]));
}

/** Loads the sounds ahead of time so the first beep isn't late. */
export function preloadTimerSounds() {
  configure().then(() => {
    try {
      player('rest');
      player('hold');
      player('countdown');
    } catch {
      // Audio unavailable: timers still vibrate.
    }
  });
}

export async function playTimerSound(kind: TimerSound) {
  try {
    await configure();
    const p = player(kind);
    await p.seekTo(0);
    p.play();
  } catch {
    // Audio unavailable: timers still vibrate.
  }
}

/** Stops a sound that is playing (e.g. a countdown that no longer matches the timer). */
export function stopTimerSound(kind: TimerSound) {
  try {
    const p = players[kind];
    if (!p) return;
    p.pause();
    p.seekTo(0).catch(() => {});
  } catch {
    // Nothing playing, or audio unavailable.
  }
}
