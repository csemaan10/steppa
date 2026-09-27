import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { syncSteps } from '@/lib/api';
import { hasHealthPermission } from '@/lib/health';
import { supabase } from '@/lib/supabase';

const TASK_NAME = 'steppa-step-sync';
/** Minutes. The OS treats this as a floor and often runs the task less often. */
const INTERVAL_MINUTES = 15;
/** Today plus yesterday, so steps taken late last night still land after midnight. */
const DAYS = 2;

// Tasks must be defined at module scope, before the app renders; the root layout imports this file.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      // Signed out, or no step access: nothing to do, and never prompt from the background.
      if (!userId || !(await hasHealthPermission())) return BackgroundTask.BackgroundTaskResult.Success;
      await syncSteps(userId, DAYS);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      // Common on iOS while the phone is locked: Health data is unreadable until it's unlocked.
      console.warn('Background step sync failed', e);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Schedules the periodic sync. Safe to call on every launch; re-registering is a no-op. */
export async function registerBackgroundSync(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) return;
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: INTERVAL_MINUTES });
  } catch (e) {
    console.warn('Could not schedule background step sync', e);
  }
}
