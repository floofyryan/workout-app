// When to start the 3-2-1 countdown sound so its final "go" beep lands exactly as the rest ends.
// Pure, so it can be tested; the sound itself is assets/sounds/countdown.wav.

/** Silence at the start of countdown.wav, which lets other apps' audio dip before the first pip. */
export const COUNTDOWN_LEAD_MS = 250;
/** Pips at 3, 2 and 1 seconds before the end, then GO at the end. */
export const COUNTDOWN_SECONDS = 3;
/** How far into the file the GO beep is. */
export const COUNTDOWN_GO_AT_MS = COUNTDOWN_LEAD_MS + COUNTDOWN_SECONDS * 1000;
/** A countdown that would start more than this late (the app was in the background) is skipped. */
export const COUNTDOWN_LATE_MS = 400;

/**
 * Milliseconds from `now` until the countdown sound should start for a rest ending at `endsAt`, or
 * null when there isn't time for the whole countdown (a short rest, or one already nearly over),
 * in which case the plain end-of-rest beep plays instead.
 */
export function countdownDelay(endsAt: number, now: number): number | null {
  const delay = endsAt - now - COUNTDOWN_GO_AT_MS;
  return delay >= 0 ? delay : null;
}

/** Whether a countdown that was due at `dueAt` should still start at `now` (not too late to line up). */
export function countdownStillOnTime(dueAt: number, now: number): boolean {
  return now - dueAt <= COUNTDOWN_LATE_MS;
}
