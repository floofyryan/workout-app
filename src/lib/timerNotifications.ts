import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Scheduled local notifications for the rest and hold timers, so the phone still buzzes when the
// screen is locked or the app is in the background. While the app is open the in-app vibration
// and timer bars do the job, so notifications are suppressed in the foreground.

const CHANNEL_ID = 'workout-timers';
/** Silent channel for the "workout in progress" notice (high importance so it pops up). */
const ACTIVE_CHANNEL_ID = 'workout-active';
const ACTIVE_ID = 'workout-in-progress';
/** Marks notifications whose tap should open the live workout. */
export const OPEN_WORKOUT = 'open-workout';
let ready: Promise<boolean> | null = null;

/** Sets up the handler and Android channel and asks for permission (once). */
export function setupTimerNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  ready ??= (async () => {
    try {
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
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  })();
  return ready;
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
