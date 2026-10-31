// Pet milestone notifications: "Biscuit reached 100,000 steps", as soon as the steps that got there
// sync, in the app or in the background. Local notifications: the phone that syncs the steps is the
// first to know, so they need no server, only permission.

import 'expo-sqlite/localStorage/install';

import * as Notifications from 'expo-notifications';

import { getWorld } from '@/lib/api';
import { formatSteps } from '@/lib/dates';
import { ensureChannels, PET_CHANNEL, pushPermission } from '@/lib/notifications';
import { milestoneTreats } from '@/lib/treats';
import { describeUnlock, levelOf, unlockAt, WORLDS } from '@/lib/world';

/** The Settings switch. On unless the user turned it off. */
const ENABLED_KEY = 'steppa:pet-push';
/** The highest milestone this phone has told each account about. */
const notifiedKey = (userId: string) => `steppa:pet-notified:${userId}`;
/** A milestone notification waiting for the morning, to call off if the Pet tab shows it first. */
const SCHEDULED_KEY = 'steppa:pet-scheduled';
/** Nothing between 10 pm and 7 am: a milestone reached late is told at 7. */
const QUIET_FROM = 22;
const QUIET_UNTIL = 7;

export function isPetPushEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setPetPushEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {}
}

/** 7 am next if it's night now, else null (straight away). */
function nextDaytime(now = new Date()): Date | null {
  const hour = now.getHours();
  if (hour >= QUIET_UNTIL && hour < QUIET_FROM) return null;
  const at = new Date(now);
  at.setHours(QUIET_UNTIL, 0, 0, 0);
  if (hour >= QUIET_FROM) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Tells about the pet's newest milestone if it hasn't been celebrated in the app or told about yet.
 * Call after syncing steps; it's quiet when there's nothing new, no pet, or no permission.
 */
export async function notifyPetMilestone(userId: string): Promise<void> {
  if (!isPetPushEnabled()) return;
  try {
    if ((await pushPermission()) !== 'granted') return;
    const status = await getWorld(userId);
    const def = status && WORLDS[status.world.kind];
    if (!status || !def) return;
    const level = levelOf(status.steps);
    const notified = Number(localStorage.getItem(notifiedKey(userId)) ?? -1);
    if (level === 0 || level < status.world.celebrated || level <= notified) return;
    localStorage.setItem(notifiedKey(userId), String(level));

    const unlock = unlockAt(def, level);
    const name = status.world.picks[status.world.kind]?.name || `Your ${def.title.toLowerCase()}`;
    const at = nextDaytime();
    await ensureChannels();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${name} reached ${formatSteps(unlock.steps)} steps`,
        // The bonus treats are collected when the Pet tab next opens (see claim_treats, migration 019).
        body: `${describeUnlock(unlock) || 'A new milestone together'} · +${milestoneTreats(level)} treats`,
        data: { url: '/pet' },
      },
      trigger: at
        ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: PET_CHANNEL }
        : { channelId: PET_CHANNEL },
    });
    if (at) localStorage.setItem(SCHEDULED_KEY, id);
  } catch {
    // Offline or no pet table yet (before migration 015): the next sync tries again.
  }
}

/** The Pet tab is celebrating this milestone itself, so no notification about it is needed. */
export function markPetMilestoneShown(userId: string, level: number) {
  try {
    if (level > Number(localStorage.getItem(notifiedKey(userId)) ?? -1)) {
      localStorage.setItem(notifiedKey(userId), String(level));
    }
    const waiting = localStorage.getItem(SCHEDULED_KEY);
    if (waiting) {
      localStorage.removeItem(SCHEDULED_KEY);
      Notifications.cancelScheduledNotificationAsync(waiting).catch(() => {});
    }
  } catch {}
}
