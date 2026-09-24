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

export async function readDailySteps(days: Date[]): Promise<number[]> {
  return Promise.all(
    days.map(async (day) => {
      const result = await queryStatisticsForQuantity(STEP_COUNT, ['cumulativeSum'], {
        filter: { date: { startDate: day, endDate: addDays(day, 1) } },
      });
      return Math.round(result.sumQuantity?.quantity ?? 0);
    })
  );
}

export function openHealthSettings(): void {
  Linking.openURL('x-apple-health://');
}
