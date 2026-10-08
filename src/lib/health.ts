// Fallback for platforms without a health store (web). Native builds use health.ios.ts / health.android.ts.

export const healthSourceName = 'Health';

export async function isHealthAvailable(): Promise<boolean> {
  return false;
}

export async function requestHealthPermission(): Promise<boolean> {
  return false;
}

export async function readDailySteps(days: Date[]): Promise<(number | null)[]> {
  return days.map(() => null);
}

export function openHealthSettings(): void {}

export async function hasHealthPermission(): Promise<boolean> {
  return false;
}

export async function enableStepChangeDelivery(): Promise<void> {}

export function onStepsChanged(_onChange: () => void): void {}

export async function requestHistoryPermission(): Promise<void> {}

export function canReadHealthNow(): boolean {
  return true;
}

export type DiagnosticLine = { label: string; value: string };

export async function diagnoseToday(): Promise<DiagnosticLine[]> {
  return [{ label: 'Step check', value: 'Only available in the iOS and Android apps.' }];
}

export async function backgroundAccess(): Promise<'granted' | 'denied' | 'unavailable'> {
  return 'unavailable';
}

export async function requestBackgroundAccess(): Promise<boolean> {
  return false;
}

export async function disableStepChangeDelivery(): Promise<void> {}
