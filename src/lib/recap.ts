// The morning podium recap: yesterday's final standings in each group. A group's results come out at
// 5 am wherever in the group the day ends last (see isRecapReleased), so a member in Japan with
// friends in Ottawa sees them in the evening, once Ottawa's day is over too.

import 'expo-sqlite/localStorage/install';

import { getDayLeaderboard, getMyGroups, isRecapReleased, type GroupWithCount, type LeaderboardRow } from '@/lib/api';
import { addDays, startOfDay, toDayKey } from '@/lib/dates';

/** Local hour the new recap day starts (results then come out group by group). */
export const RECAP_HOUR = 5;
const SEEN_KEY = 'steppa:recap-seen';
/** Before groups were tracked one by one: the day whose recap was seen in full. */
const LEGACY_SEEN_KEY = 'steppa:recap-seen-day';

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

/** Loads the recap for every group whose results are out and that had steps that day; cached for the recap screen. */
export async function loadRecap(userId: string, myGroups?: GroupWithCount[], day = recapDay()): Promise<Recap> {
  const groups = myGroups ?? (await getMyGroups());
  const all = await Promise.all(
    groups.map(async (group): Promise<GroupRecap | null> => {
      const [rows, released] = await Promise.all([getDayLeaderboard(group.id, day), isRecapReleased(group.id, day)]);
      if (!released) return null;
      return {
        group,
        rows,
        podium: rows.filter((r) => r.total_steps > 0).slice(0, 3),
        me: rows.find((r) => r.user_id === userId) ?? null,
      };
    })
  );
  cache = { day, groups: all.filter((g): g is GroupRecap => !!g && g.podium.length > 0) };
  return cache;
}

export function cachedRecap(day = recapDay()): Recap | null {
  return cache?.day === day ? cache : null;
}

function seenGroups(day: string): Set<string> | 'all' {
  try {
    if (localStorage.getItem(LEGACY_SEEN_KEY) === day) return 'all';
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as { day: string; groups: string[] } | null;
    return new Set(seen?.day === day ? seen.groups : []);
  } catch {
    return 'all';
  }
}

/** The first group whose results this phone hasn't shown yet, or -1. Groups come out at different times. */
export function firstUnseenGroup(recap: Recap): number {
  const seen = seenGroups(recap.day);
  if (seen === 'all') return -1;
  return recap.groups.findIndex((g) => !seen.has(g.group.id));
}

export function markRecapSeen(recap: Recap) {
  const seen = seenGroups(recap.day);
  if (seen === 'all') return;
  for (const g of recap.groups) seen.add(g.group.id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day: recap.day, groups: [...seen] }));
  } catch {}
}

let showing = false;

/** Set while the recap screen is open, so the Today screen doesn't open a second one over it. */
export function setRecapShowing(open: boolean) {
  showing = open;
}

export function isRecapShowing(): boolean {
  return showing;
}
