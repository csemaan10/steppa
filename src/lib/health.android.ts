import {
  aggregateRecord,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { addDays } from '@/lib/dates';

export const healthSourceName = 'Health Connect';

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    initialized = await initialize();
  }
  return initialized;
}

export async function isHealthAvailable(): Promise<boolean> {
  const status = await getSdkStatus();
  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
}

export async function requestHealthPermission(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  // History permission lets us read data older than 30 days before the first grant.
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'ReadHealthDataHistory' },
  ]);
  return granted.some(
    (p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read'
  );
}

/** Steps per day; `null` for days that couldn't be read. Sequential to stay under Health Connect's rate limit. */
export async function readDailySteps(days: Date[]): Promise<(number | null)[]> {
  if (!(await ensureInitialized())) return days.map(() => null);
  const results: (number | null)[] = [];
  for (const day of days) {
    try {
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: day.toISOString(),
          endTime: addDays(day, 1).toISOString(),
        },
      });
      results.push(result.COUNT_TOTAL ?? 0);
    } catch {
      results.push(null);
    }
  }
  return results;
}

export function openHealthSettings(): void {
  openHealthConnectSettings();
}
