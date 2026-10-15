import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Scheduled local notifications for the rest and hold timers, so the phone still buzzes when the
// screen is locked or the app is in the background. While the app is open the in-app vibration
// and timer bars do the job, so notifications are suppressed in the foreground.

const CHANNEL_ID = 'workout-timers';
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
      content: { title, body, sound: 'default' },
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
