import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useSettings } from '@/state/SettingsContext';
import { HERO_NOTIFICATION_PREFIX, heroPlanKey, planHeroNotifications, type HeroNotification } from './heroNotificationPlan';
import type { Progress } from './rpg';
import { setupTimerNotifications } from './timerNotifications';

// Local reminders for the hero: a streak about to lapse, a weekly quest one workout from done,
// and the monthly boss before it leaves. What to send is decided in heroNotificationPlan.ts;
// this file only keeps the scheduled notifications in line with that plan.

export { HERO_NOTIFICATION_PREFIX, planHeroNotifications, type HeroNotification };

const CHANNEL_ID = 'hero-reminders';

/** Cancels every scheduled hero reminder. Timer alerts have generated ids and are left alone. */
async function cancelHeroNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(HERO_NOTIFICATION_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

async function applyPlan(plan: HeroNotification[]) {
  try {
    await cancelHeroNotifications();
    // Same handler and one-time permission request as the timer alerts, and only asked for once
    // there is something to schedule.
    if (plan.length === 0 || !(await setupTimerNotifications())) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Quest and streak reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    for (const n of plan) {
      if (n.at <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: CHANNEL_ID },
      });
    }
  } catch {
    // Reminders are a nicety; never let them break the app.
  }
}

/** Syncs run one after another, so a newer plan can't be undone by an older one still in flight. */
let queue: Promise<void> = Promise.resolve();

/**
 * Replaces the scheduled hero reminders with the ones planned for `progress`, or just clears
 * them when `enabled` is false. Does nothing on web.
 */
export function syncHeroNotifications(progress: Progress, enabled: boolean, now: number = Date.now()): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const plan = enabled ? planHeroNotifications(progress, now) : [];
  queue = queue.then(() => applyPlan(plan));
  return queue;
}

/** Keeps the reminders up to date with the hero; mount it wherever `useProgress()` is at hand. */
export function useHeroNotifications(progress: Progress | undefined) {
  const enabled = useSettings().settings.heroNotifications;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !progress) return;
    const now = Date.now();
    const key = enabled ? heroPlanKey(planHeroNotifications(progress, now)) : 'off';
    if (key === lastKey.current) return;
    lastKey.current = key;
    syncHeroNotifications(progress, enabled, now);
  }, [progress, enabled]);
}
