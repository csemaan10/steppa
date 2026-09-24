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
  const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
  return granted.some(
    (p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read'
  );
}

export async function readDailySteps(days: Date[]): Promise<number[]> {
  if (!(await ensureInitialized())) return days.map(() => 0);
  return Promise.all(
    days.map(async (day) => {
      const result = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: day.toISOString(),
          endTime: addDays(day, 1).toISOString(),
        },
      });
      return result.COUNT_TOTAL ?? 0;
    })
  );
}

export function openHealthSettings(): void {
  openHealthConnectSettings();
}
