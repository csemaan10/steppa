import 'expo-sqlite/localStorage/install';
import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { addDays, toDayKey } from '@/lib/dates';

export const healthSourceName = 'Health Connect';

/** Days per aggregate request; keeps each response small while a year import stays at ~5 calls. */
const CHUNK_DAYS = 90;

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

type GrantedPermission = { accessType: string; recordType: string };

const hasStepsRead = (perms: GrantedPermission[]) =>
  perms.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
const hasBackgroundRead = (perms: GrantedPermission[]) =>
  perms.some((p) => p.recordType === 'BackgroundAccessPermission');

/** Set once we've asked for background access, so users who decline aren't asked on every sync. */
const BACKGROUND_ASKED_KEY = 'steppa:hc-background-asked';

export async function requestHealthPermission(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  const current = await getGrantedPermissions();

  // Only show the dialog when something is missing; this runs on every sync.
  if (hasStepsRead(current)) {
    // Users who granted steps before background sync existed get asked for it once.
    if (!hasBackgroundRead(current) && localStorage.getItem(BACKGROUND_ASKED_KEY) !== '1') {
      localStorage.setItem(BACKGROUND_ASKED_KEY, '1');
      await requestPermission([{ accessType: 'read', recordType: 'BackgroundAccessPermission' }]);
    }
    return true;
  }

  // History lets us read data older than 30 days before the first grant; background lets the
  // periodic task sync while the app is closed. Both are optional, only Steps is required.
  localStorage.setItem(BACKGROUND_ASKED_KEY, '1');
  const granted = await requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'ReadHealthDataHistory' },
    { accessType: 'read', recordType: 'BackgroundAccessPermission' },
  ]);
  return hasStepsRead(granted.filter((p) => 'accessType' in p));
}

/** True if steps can be read. Never shows UI, so it's safe in the background. */
export async function hasHealthPermission(): Promise<boolean> {
  if (!(await isHealthAvailable()) || !(await ensureInitialized())) return false;
  return hasStepsRead(await getGrantedPermissions());
}

/**
 * Steps per day; `null` for days that couldn't be read.
 * Uses one daily-bucketed aggregate per chunk instead of a call per day, which ran into
 * Health Connect's rate limit on backfills and imports (and then silently dropped the newest days).
 * Buckets are local-time days, matching `toDayKey`.
 */
export async function readDailySteps(days: Date[]): Promise<(number | null)[]> {
  if (!days.length || !(await ensureInitialized())) return days.map(() => null);
  const byDay = new Map<string, number | null>();

  for (let i = 0; i < days.length; i += CHUNK_DAYS) {
    const chunk = days.slice(i, i + CHUNK_DAYS);
    try {
      const buckets = await aggregateGroupByPeriod({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: chunk[0]!.toISOString(),
          endTime: addDays(chunk[chunk.length - 1]!, 1).toISOString(),
        },
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });
      // Days with no data may have no bucket; the read succeeded, so they're 0.
      for (const day of chunk) byDay.set(toDayKey(day), 0);
      for (const bucket of buckets) {
        // startTime is a local date-time like "2026-09-26T00:00".
        byDay.set(bucket.startTime.slice(0, 10), bucket.result.COUNT_TOTAL ?? 0);
      }
    } catch (e) {
      console.warn('Health Connect read failed', e);
      for (const day of chunk) byDay.set(toDayKey(day), null);
    }
  }

  return days.map((day) => byDay.get(toDayKey(day)) ?? null);
}

export function openHealthSettings(): void {
  openHealthConnectSettings();
}
