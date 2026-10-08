// The morning podium recap: yesterday's final standings in each group, shown once a day from 5 am.

import 'expo-sqlite/localStorage/install';

import { getDayLeaderboard, getMyGroups, type GroupWithCount, type LeaderboardRow } from '@/lib/api';
import { addDays, startOfDay, toDayKey } from '@/lib/dates';

/** Local hour the new recap becomes available (and pops up). */
export const RECAP_HOUR = 5;
const SEEN_KEY = 'steppa:recap-seen-day';

export type GroupRecap = {
  group: GroupWithCount;
  /** Up to three players with steps, best first (ties share a rank). */
  podium: LeaderboardRow[];
  /** Everyone, in leaderboard order. */
  rows: LeaderboardRow[];
  /** The viewer's row, or null if they're no longer in the group. */
  me: LeaderboardRow | null;
};

export type Recap = { day: string; groups: GroupRecap[] };

/**
 * The day the recap covers: yesterday from 5 am, and the day before until then, so a late-night
 * check never shows a day that's still being finished.
 */
export function recapDay(now = new Date()): string {
  const morning = now.getHours() >= RECAP_HOUR ? now : addDays(now, -1);
  return toDayKey(addDays(startOfDay(morning), -1));
}

/** "Yesterday", or the weekday when the recap is older (before 5 am). */
export function recapDayLabel(day: string): string {
  if (day === toDayKey(addDays(startOfDay(new Date()), -1))) return 'Yesterday';
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
}

let cache: Recap | null = null;

/** Loads the recap for every group that had steps that day; cached for the recap screen. */
export async function loadRecap(userId: string, myGroups?: GroupWithCount[], day = recapDay()): Promise<Recap> {
  const groups = myGroups ?? (await getMyGroups());
  const all = await Promise.all(
    groups.map(async (group): Promise<GroupRecap> => {
      const rows = await getDayLeaderboard(group.id, day);
      return {
        group,
        rows,
        podium: rows.filter((r) => r.total_steps > 0).slice(0, 3),
        me: rows.find((r) => r.user_id === userId) ?? null,
      };
    })
  );
  cache = { day, groups: all.filter((g) => g.podium.length > 0) };
  return cache;
}

export function cachedRecap(day = recapDay()): Recap | null {
  return cache?.day === day ? cache : null;
}

/** True when this day's recap hasn't been shown on this phone yet. */
export function recapUnseen(day: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== day;
  } catch {
    return false;
  }
}

export function markRecapSeen(day: string) {
  try {
    localStorage.setItem(SEEN_KEY, day);
  } catch {}
}
