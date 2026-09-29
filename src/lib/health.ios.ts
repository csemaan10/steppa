import {
  AuthorizationRequestStatus,
  configureBackgroundTypes,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
  subscribeToChanges,
  UpdateFrequency,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';

import { addDays } from '@/lib/dates';

const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;

export const healthSourceName = 'Apple Health';

export async function isHealthAvailable(): Promise<boolean> {
  return isHealthDataAvailable();
}

// HealthKit never reveals whether read access was denied; `true` means the prompt was handled.
export async function requestHealthPermission(): Promise<boolean> {
  return requestAuthorization({ toRead: [STEP_COUNT] });
}

/** Steps per day; `null` for days that couldn't be read. */
export async function readDailySteps(days: Date[]): Promise<(number | null)[]> {
  const results: (number | null)[] = [];
  for (const day of days) {
    try {
      const result = await queryStatisticsForQuantity(STEP_COUNT, ['cumulativeSum'], {
        filter: { date: { startDate: day, endDate: addDays(day, 1) } },
      });
      results.push(Math.round(result.sumQuantity?.quantity ?? 0));
    } catch {
      results.push(null);
    }
  }
  return results;
}

export function openHealthSettings(): void {
  Linking.openURL('x-apple-health://');
}

/** True once the user has answered the Health prompt. Never shows UI, so it's safe in the background. */
export async function hasHealthPermission(): Promise<boolean> {
  const status = await getRequestStatusForAuthorization({ toRead: [STEP_COUNT] });
  return status === AuthorizationRequestStatus.unnecessary;
}

/**
 * Asks iOS to wake the app when new steps land in Apple Health (hourly at most for steps).
 * The library persists this and registers the observer natively on every later launch.
 * Call only after the Health prompt has been answered.
 */
export async function enableStepChangeDelivery(): Promise<void> {
  await configureBackgroundTypes([STEP_COUNT], UpdateFrequency.hourly);
}

/**
 * Calls `onChange` when Apple Health gets new steps, including when iOS launched the app for it.
 * Events that arrive before this is called are queued natively and delivered once it is.
 */
export function onStepsChanged(onChange: () => void): void {
  subscribeToChanges(STEP_COUNT, onChange);
}

// HealthKit has no separate history permission; read access covers past data.
export async function requestHistoryPermission(): Promise<void> {}
