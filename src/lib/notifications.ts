// Notifications. Steppa sends two kinds and only these: a group's daily results (a push from the
// server, migration 017, to this phone's Expo push token) and pet milestones (local, see
// pet-milestones.ts). Without permission nothing is registered and the app carries on as before.

import 'expo-sqlite/localStorage/install';

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from '@/lib/api';
import { toDayKey } from '@/lib/dates';

/** Android channel the server sends the morning podium on (`channelId` in migration 017). */
const RECAP_CHANNEL = 'recap';
/** Android channel for pet milestones, so each kind can be silenced on its own in system settings. */
export const PET_CHANNEL = 'pet';
/** The token registered from this phone, with whose it is and the day it was last refreshed. */
const TOKEN_KEY = 'steppa:push-token';
/** Set once Steppa has asked for permission itself (Android shows the system prompt only twice). */
const ASKED_KEY = 'steppa:push-asked';

// Shown even while Steppa is open, quietly.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushPermission = 'granted' | 'undetermined' | 'denied';

export async function pushPermission(): Promise<PushPermission> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return granted ? 'granted' : canAskAgain ? 'undetermined' : 'denied';
}

/** Android 13 shows neither the permission prompt nor any notification until a channel exists. */
export async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(RECAP_CHANNEL, {
    name: 'Daily results',
    description: "When a group's results are in",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(PET_CHANNEL, {
    name: 'Pet milestones',
    description: 'When your pet reaches a milestone',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

type Stored = { userId: string; token: string; day: string };

function readStored(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Stored | null;
  } catch {
    return null;
  }
}

/**
 * Registers this phone's token if notifications are allowed. Refreshed once a day, since the server
 * drops tokens it hasn't heard from in 90 days. Never asks for permission.
 */
export async function syncPushToken(userId: string): Promise<void> {
  try {
    if ((await pushPermission()) !== 'granted') return;
    // Today reloads every minute; fetching the token asks Expo's servers, so once a day is plenty.
    const day = toDayKey(new Date());
    const stored = readStored();
    if (stored?.userId === userId && stored.day === day) return;
    await ensureChannels();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ userId, token, day }));
  } catch {
    // No token yet (e.g. Android without Firebase, a simulator, offline): try again next launch.
  }
}

/** Asks for permission (if it still can) and registers. Returns whether notifications are allowed. */
export async function askForPush(userId: string): Promise<boolean> {
  try {
    await ensureChannels();
    const { granted } = await Notifications.requestPermissionsAsync();
    if (granted) await syncPushToken(userId);
    return granted;
  } catch {
    return false;
  }
}

/**
 * Asks once, at the first moment one of the two notifications makes sense (closing a recap, adopting
 * a pet), if the phone hasn't decided yet.
 */
export async function askForPushOnce(userId: string): Promise<void> {
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    return;
  }
  if ((await pushPermission()) === 'undetermined') await askForPush(userId);
}

/** Stops pushes to this phone for the signed-in account; call before signing out. */
export async function forgetPushToken(): Promise<void> {
  const stored = readStored();
  if (!stored) return;
  try {
    await unregisterPushToken(stored.token);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}
