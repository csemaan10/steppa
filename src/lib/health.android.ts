import 'expo-sqlite/localStorage/install';
import {
  aggregateGroupByPeriod,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { addDays, startOfDay, toDayKey } from '@/lib/dates';
import type { DiagnosticLine } from '@/lib/health';

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
 * Asks for access to steps from before the first grant. `getGrantedPermissions` never reports this
 * one, so it can't be checked; Health Connect only shows its dialog if it isn't granted yet.
 * Without it, reads can't reach more than 30 days before the first grant.
 */
export async function requestHistoryPermission(): Promise<void> {
  if (!(await ensureInitialized())) return;
  await requestPermission([{ accessType: 'read', recordType: 'ReadHealthDataHistory' }]);
}

/**
 * Steps per day, for consecutive days oldest first; `null` for days that couldn't be read.
 * Uses one daily-bucketed aggregate per chunk instead of a call per day, which ran into
 * Health Connect's rate limit on backfills and imports (and then silently dropped the newest days).
 * Buckets are local-time days, matching `toDayKey`.
 */
export async function readDailySteps(days: Date[]): Promise<(number | null)[]> {
  if (!days.length || !(await ensureInitialized())) return days.map(() => null);
  const byDay = new Map<string, number | null>();

  // Newest chunk first. Without the history permission, Health Connect rejects any read that
  // reaches too far back, so the first chunk that fails is where readable history ends: keep its
  // readable part and stop, since every older chunk would fail too.
  for (let end = days.length; end > 0; end -= CHUNK_DAYS) {
    const chunk = days.slice(Math.max(0, end - CHUNK_DAYS), end);
    if (await readRange(chunk, byDay)) continue;
    await readNewestReadable(chunk, byDay);
    break;
  }

  return days.map((day) => byDay.get(toDayKey(day)) ?? null);
}

/** One aggregate read of consecutive days into `byDay`. Returns false if Health Connect rejected it. */
async function readRange(range: Date[], byDay: Map<string, number | null>): Promise<boolean> {
  try {
    const buckets = await aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: range[0]!.toISOString(),
        endTime: addDays(range[range.length - 1]!, 1).toISOString(),
      },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });
    // Days with no data may have no bucket; the read succeeded, so they're 0.
    for (const day of range) byDay.set(toDayKey(day), 0);
    for (const bucket of buckets) {
      // startTime is a local date-time like "2026-09-26T00:00".
      byDay.set(bucket.startTime.slice(0, 10), bucket.result.COUNT_TOTAL ?? 0);
    }
    return true;
  } catch (e) {
    console.warn('Health Connect read failed', e);
    return false;
  }
}

/** Binary-searches a chunk whose full read failed for its oldest readable day, reading from there on. */
async function readNewestReadable(chunk: Date[], byDay: Map<string, number | null>): Promise<void> {
  // chunk[hi..] has been read; chunk[..lo) is known to be unreadable.
  let lo = 0;
  let hi = chunk.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await readRange(chunk.slice(mid, hi), byDay)) hi = mid;
    else lo = mid + 1;
  }
}

export function openHealthSettings(): void {
  openHealthConnectSettings();
}

// Health Connect has no change delivery; Android relies on the periodic background task alone.
export async function enableStepChangeDelivery(): Promise<void> {}

export function onStepsChanged(_onChange: () => void): void {}

/** Health Connect can always be read while the app runs; only iOS locks its store. */
export function canReadHealthNow(): boolean {
  return true;
}

/** Today's steps from Health Connect, for the Step check in Settings. Never uploads anything. */
export async function diagnoseToday(): Promise<DiagnosticLine[]> {
  const now = new Date();
  const start = startOfDay(now);
  const end = addDays(start, 1);
  const lines: DiagnosticLine[] = [
    { label: 'Checked at', value: now.toString() },
    { label: 'Time zone', value: `${Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC${-now.getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-now.getTimezoneOffset() / 60})` },
    { label: 'Day window', value: `${start.toString()} → ${end.toString()}` },
  ];
  try {
    if (!(await ensureInitialized())) throw new Error('Health Connect not available');
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    lines.push({ label: 'Day total', value: String(result.COUNT_TOTAL ?? 0) });
    lines.push({ label: 'Sources', value: result.dataOrigins.join(', ') || 'none' });
  } catch (e) {
    lines.push({ label: 'Day total', value: `error: ${e instanceof Error ? e.message : String(e)}` });
  }
  return lines;
}
