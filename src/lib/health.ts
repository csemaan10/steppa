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
