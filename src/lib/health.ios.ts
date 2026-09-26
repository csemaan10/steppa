import {
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
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
