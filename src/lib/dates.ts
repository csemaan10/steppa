export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Local calendar day as YYYY-MM-DD (matches the Postgres `date` column). */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The last `n` days at local midnight, oldest first, ending today. */
export function lastNDays(n: number): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function shortWeekday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function formatSteps(steps: number): string {
  return Math.round(steps).toLocaleString();
}
