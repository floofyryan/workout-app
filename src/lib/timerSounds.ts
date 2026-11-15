import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// The rest and hold timers' sounds: a tick on each of the last seconds and a ding at zero.
// They play over whatever music is on (without pausing it) and with the phone on silent.

/** Seconds before the end on which a tick plays. */
export const TICK_SECONDS = [3, 2, 1] as const;

let players: { tick: AudioPlayer; ding: AudioPlayer } | null = null;

/** Loads the sounds. Safe to call often; call it when a timer starts so the first tick isn't late. */
export function prepareTimerSounds() {
  if (players) return;
  try {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(
      () => {},
    );
    players = {
      tick: createAudioPlayer(require('../../assets/sounds/tick.wav')),
      ding: createAudioPlayer(require('../../assets/sounds/ding.wav')),
    };
  } catch {
    players = null;
  }
}

function play(which: 'tick' | 'ding') {
  prepareTimerSounds();
  const player = players?.[which];
  if (!player) return;
  // Rewind first: a player that has finished stays at its end.
  player
    .seekTo(0)
    .catch(() => {})
    .then(() => {
      try {
        player.play();
      } catch {
        // Sound is a nicety; never let it break the timer.
      }
    });
}

export const playTick = () => play('tick');
export const playDing = () => play('ding');
