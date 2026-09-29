import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { syncSteps } from '@/lib/api';
import { enableStepChangeDelivery, hasHealthPermission, onStepsChanged } from '@/lib/health';
import { supabase } from '@/lib/supabase';

const TASK_NAME = 'steppa-step-sync';
/** Minutes. The OS treats this as a floor and often runs the task less often. */
const INTERVAL_MINUTES = 15;
/** Today plus yesterday, so steps taken late last night still land after midnight. */
const DAYS = 2;

let inFlight: Promise<boolean> | null = null;

/** Uploads the last few days without any UI. Resolves false if the sync failed. */
function syncRecentSteps(): Promise<boolean> {
  // The periodic task and the step observer can fire together; share one upload.
  inFlight ??= (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      // Signed out, or no step access: nothing to do, and never prompt from the background.
      if (!userId || !(await hasHealthPermission())) return true;
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
    .then((granted) => (granted ? listenForStepChanges() : undefined))
    .catch(() => {});
}

/** Schedules background syncing. Safe to call on every launch; repeat calls are no-ops. */
export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;
  await listenForStepChanges();
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) return;
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: INTERVAL_MINUTES });
  } catch (e) {
    console.warn('Could not schedule background step sync', e);
  }
}
