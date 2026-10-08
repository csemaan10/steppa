import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { syncSteps } from '@/lib/api';
import {
  canReadHealthNow,
  disableStepChangeDelivery,
  enableStepChangeDelivery,
  hasHealthPermission,
  onStepsChanged,
} from '@/lib/health';
import { supabase } from '@/lib/supabase';

const TASK_NAME = 'steppa-step-sync';
/** Minutes. The OS treats this as a floor and often runs the task less often. */
const INTERVAL_MINUTES = 15;
/** Today plus yesterday, so steps taken late last night still land after midnight. */
const DAYS = 2;

/** The Settings switch. On unless the user turned it off. */
const ENABLED_KEY = 'steppa:background-sync';

export function isBackgroundSyncEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

let inFlight: Promise<boolean> | null = null;

/** Uploads the last few days without any UI. Resolves false if the sync failed. */
function syncRecentSteps(): Promise<boolean> {
  // The periodic task and the step observer can fire together; share one upload.
  inFlight ??= (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      // Switched off, signed out, or no step access: nothing to do; never prompt from the background.
      if (!isBackgroundSyncEnabled()) return true;
      if (!userId || !(await hasHealthPermission())) return true;
      // iPhone locked: Apple Health would only report steps since it locked. Skip; the next
      // sync with the phone unlocked picks up everything.
      if (!canReadHealthNow()) return true;
      await syncSteps(userId, DAYS);
      return true;
    } catch (e) {
      // Common on iOS while the phone is locked: Health data is unreadable until it's unlocked.
      console.warn('Background step sync failed', e);
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

let listening = false;

/** iOS: syncs whenever Apple Health gets new steps, even if iOS had to launch the app for it. */
async function listenForStepChanges(): Promise<void> {
  if (listening) return;
  listening = true;
  try {
    // Configure before subscribing so the callback attaches to the native observer that survives
    // app termination, rather than starting a second, foreground-only one.
    await enableStepChangeDelivery();
    onStepsChanged(() => void syncRecentSteps());
  } catch (e) {
    listening = false;
    console.warn('Could not listen for step changes', e);
  }
}

// Tasks and listeners must be set up at module scope, before the app renders; the entry file
// (index.ts) imports this file, because background launches never render a screen.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK_NAME, async () =>
    (await syncRecentSteps()) ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed
  );
  // Subscribing before the Health prompt is answered can crash HealthKit, so only resume if it was.
  hasHealthPermission()
    .then((granted) => (granted && isBackgroundSyncEnabled() ? listenForStepChanges() : undefined))
    .catch(() => {});
}

/** Schedules background syncing. Safe to call on every launch; repeat calls are no-ops. */
export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web' || !isBackgroundSyncEnabled()) return;
  await listenForStepChanges();
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) return;
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: INTERVAL_MINUTES });
  } catch (e) {
    console.warn('Could not schedule background step sync', e);
  }
}

/** Turns background syncing on or off (Settings). Syncing with the app open is unaffected. */
export async function setBackgroundSyncEnabled(on: boolean): Promise<void> {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable: the choice lasts until the app restarts.
  }
  if (Platform.OS === 'web') return;
  if (on) {
    await registerBackgroundSync();
    return;
  }
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    await disableStepChangeDelivery();
    listening = false;
  } catch (e) {
    console.warn('Could not stop background step sync', e);
  }
}
