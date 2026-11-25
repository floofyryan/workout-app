import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

// Scheduled local notifications for the rest and hold timers, so the phone still buzzes when the
// screen is locked or the app is in the background. While the app is open the in-app vibration
// and timer bars do the job, so notifications are suppressed in the foreground.

const CHANNEL_ID = 'workout-timers';
/** Silent channel for the "workout in progress" notice (high importance so it pops up). */
const ACTIVE_CHANNEL_ID = 'workout-active';
const ACTIVE_ID = 'workout-in-progress';
/** Marks notifications whose tap should open the live workout. */
export const OPEN_WORKOUT = 'open-workout';
let prepared: Promise<void> | null = null;

/** Sets up the foreground handler and the Android channels (once). Asks for nothing. */
function prepare(): Promise<void> {
  prepared ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Workout timers',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync(ACTIVE_CHANNEL_ID, {
        name: 'Workout in progress',
        importance: Notifications.AndroidImportance.HIGH,
        sound: null,
        enableVibrate: false,
        vibrationPattern: [0],
      });
    }
  })().catch(() => {
    prepared = null; // Try again next time.
  });
  return prepared;
}

export type NotificationAccess = 'allowed' | 'ask' | 'blocked' | 'unavailable';

/** Whether this app may post notifications right now. Checked fresh every time, never cached. */
export async function notificationAccess(): Promise<NotificationAccess> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'allowed';
    return p.canAskAgain ? 'ask' : 'blocked';
  } catch {
    return 'unavailable';
  }
}

/**
 * Asks for permission to post notifications, if it can still be asked. Only call this while the
 * app is on screen: Android can't show the question for an app in the background, and answers
 * "no" without asking. Resolves to whether notifications are allowed afterwards.
 */
export async function askForNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await prepare();
  const access = await notificationAccess();
  if (access === 'allowed') return true;
  if (access !== 'ask' || AppState.currentState !== 'active') return false;
  try {
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Gets notifications ready and says whether they're allowed. Asks for permission only when the app
 * is on screen; otherwise it just checks, so a call made while leaving the app can't turn into a
 * remembered "no".
 */
export async function setupTimerNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await prepare();
  if ((await notificationAccess()) === 'allowed') return true;
  return askForNotifications();
}

/** Schedules a notification at `at` (ms since epoch). Resolves to its id, or null if unavailable. */
export async function scheduleTimerNotification(at: number, title: string, body: string): Promise<string | null> {
  if (at <= Date.now() || !(await setupTimerNotifications())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { action: OPEN_WORKOUT } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
  } catch {
    return null;
  }
}

export function cancelTimerNotification(id: Promise<string | null> | null | undefined) {
  id?.then((resolved) => {
    if (resolved) Notifications.cancelScheduledNotificationAsync(resolved).catch(() => {});
  });
}

/**
 * Pops up a silent "workout in progress" notification (it can't be swiped away on Android) that
 * opens the workout when tapped. Showing it again replaces the previous one.
 */
export async function showWorkoutInProgress(title: string, body: string) {
  if (!(await setupTimerNotifications())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ACTIVE_ID,
      content: { title, body, sticky: true, autoDismiss: false, data: { action: OPEN_WORKOUT } },
      trigger: Platform.OS === 'android' ? { channelId: ACTIVE_CHANNEL_ID } : null,
    });
  } catch {
    // Notifications unavailable: nothing to show.
  }
}

export function hideWorkoutInProgress() {
  if (Platform.OS === 'web') return;
  Notifications.dismissNotificationAsync(ACTIVE_ID).catch(() => {});
}

/** Calls `onOpen` when a notification of ours is tapped, including the one that launched the app. */
export function onWorkoutNotificationTap(onOpen: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const isOurs = (r: Notifications.NotificationResponse | null) =>
    r?.notification.request.content.data?.action === OPEN_WORKOUT;
  const launched = Notifications.getLastNotificationResponse();
  if (isOurs(launched)) {
    Notifications.clearLastNotificationResponse();
    onOpen();
  }
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    if (isOurs(r)) onOpen();
  });
  return () => sub.remove();
}
