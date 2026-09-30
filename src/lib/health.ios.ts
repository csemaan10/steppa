import {
  AuthorizationRequestStatus,
  configureBackgroundTypes,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  isProtectedDataAvailable,
  queryStatisticsCollectionForQuantity,
  queryStatisticsForQuantity,
  queryStatisticsForQuantitySeparateBySource,
  requestAuthorization,
  subscribeToChanges,
  UpdateFrequency,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';

import { addDays, startOfDay, toDayKey } from '@/lib/dates';
import type { DiagnosticLine } from '@/lib/health';

const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;

export const healthSourceName = 'Apple Health';

export async function isHealthAvailable(): Promise<boolean> {
  return isHealthDataAvailable();
}

// HealthKit never reveals whether read access was denied; `true` means the prompt was handled.
export async function requestHealthPermission(): Promise<boolean> {
  return requestAuthorization({ toRead: [STEP_COUNT] });
}

/**
 * False while the iPhone is locked. Apple Health is encrypted then, and a query only sees steps
 * logged since the phone locked (e.g. 1k instead of the day's 6k), so it must not be read.
 */
export function canReadHealthNow(): boolean {
  return isProtectedDataAvailable();
}

/**
 * Steps per day; `null` for days that couldn't be read.
 * Uses the same query as Apple's Health and Fitness apps: daily buckets from local midnight, with
 * phone and watch de-duplicated and samples that cross midnight split between the two days.
 * `days` must be consecutive local midnights, oldest first (as from `lastNDays`).
 */
export async function readDailySteps(days: Date[]): Promise<(number | null)[]> {
  // Locked: every day is unreadable rather than wrong, so nothing gets uploaded.
  if (!days.length || !canReadHealthNow()) return days.map(() => null);
  try {
    const buckets = await queryStatisticsCollectionForQuantity(
      STEP_COUNT,
      ['cumulativeSum'],
      days[0]!,
      { day: 1 },
      { filter: { date: { startDate: days[0]!, endDate: addDays(days[days.length - 1]!, 1) } } }
    );
    const byDay = new Map(
      buckets.flatMap((b) => (b.startDate ? [[toDayKey(b.startDate), Math.round(b.sumQuantity?.quantity ?? 0)]] : []))
    );
    // The read succeeded, so a day with no bucket had no steps.
    return days.map((day) => byDay.get(toDayKey(day)) ?? 0);
  } catch {
    return days.map(() => null);
  }
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

/**
 * Today's steps read several ways, for the Step check in Settings. Shows where a number comes from
 * when Steppa disagrees with the Health app. Never uploads anything.
 */
export async function diagnoseToday(): Promise<DiagnosticLine[]> {
  const now = new Date();
  const start = startOfDay(now);
  const end = addDays(start, 1);
  const lines: DiagnosticLine[] = [
    { label: 'Checked at', value: now.toString() },
    { label: 'Time zone', value: `${Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC${-now.getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-now.getTimezoneOffset() / 60})` },
    { label: 'Day window', value: `${start.toString()} → ${end.toString()}` },
  ];
  lines.push({ label: 'Phone unlocked', value: canReadHealthNow() ? 'yes' : 'no' });
  const filter = { date: { startDate: start, endDate: end } };
  const attempt = async (label: string, read: () => Promise<string>) => {
    try {
      lines.push({ label, value: await read() });
    } catch (e) {
      lines.push({ label, value: `error: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  await attempt('Day total (current method)', async () => {
    const r = await queryStatisticsForQuantity(STEP_COUNT, ['cumulativeSum'], { filter });
    const sources = r.sources.map((s) => s.name).join(', ') || 'none';
    return `${Math.round(r.sumQuantity?.quantity ?? 0)} (from: ${sources})`;
  });
  await attempt('Day total (Fitness method)', async () => {
    const buckets = await queryStatisticsCollectionForQuantity(STEP_COUNT, ['cumulativeSum'], start, { day: 1 }, { filter });
    return buckets.map((b) => `${b.startDate ? toDayKey(b.startDate) : '?'}: ${Math.round(b.sumQuantity?.quantity ?? 0)}`).join('; ') || 'no data';
  });
  await attempt('By source', async () => {
    const perSource = await queryStatisticsForQuantitySeparateBySource(STEP_COUNT, ['cumulativeSum'], { filter });
    return (
      perSource
        .map((s) => `${s.source.name} (${s.source.bundleIdentifier}): ${Math.round(s.sumQuantity?.quantity ?? 0)}`)
        .join('\n') || 'no sources'
    );
  });
  return lines;
}
