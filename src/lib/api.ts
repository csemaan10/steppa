import { addDays, lastNDays, startOfDay, toDayKey } from '@/lib/dates';
import { healthSourceName, readDailySteps } from '@/lib/health';
import { supabase } from '@/lib/supabase';

/** Leaderboard style chosen on the profile; shown around the name and avatar in every group. */
export type Flair = {
  /** Material Community Icons name shown next to the name. */
  flair_icon: string | null;
  /** Accent for the avatar ring, glow and badge. */
  flair_color: string | null;
  flair_glow: boolean;
};

export type Profile = Flair & {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_icon: string | null;
  daily_goal: number;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  owner_id: string;
  /** Material Community Icons name; null shows the name's first letter. */
  icon: string | null;
  color: string;
  created_at: string;
};

export type GroupWithCount = Group & { member_count: number };

export type LeaderboardRow = Partial<Flair> & {
  user_id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_icon: string | null;
  total_steps: number;
  /** Days in the period with steps > 0. */
  active_days: number;
  rank: number;
  prev_rank: number;
  streak: number;
  gold: number;
  silver: number;
  bronze: number;
};

export type ChatMessage = {
  id: number;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type DaySteps = { day: string; steps: number };

export type Period = 'today' | 'week' | 'month';

/** Average over days with steps > 0, so unsynced or empty days don't drag it down. */
export function activeAverage(total: number, activeDays: number): number {
  return activeDays > 0 ? Math.round(total / activeDays) : 0;
}

type Result<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Steps ----------

const BACKFILL_DAYS = 90;
const backfillKey = (userId: string) => `steppa:backfilled:${userId}`;

/**
 * Reads recent days from the phone's health store and upserts them.
 * The first sync on a device backfills 90 days; later syncs refresh the last week.
 */
export async function syncSteps(userId: string, days = 7): Promise<DaySteps[]> {
  const backfilled = localStorage.getItem(backfillKey(userId)) === '1';
  const rows = await uploadDays(userId, lastNDays(backfilled ? days : BACKFILL_DAYS));
  if (!backfilled) localStorage.setItem(backfillKey(userId), '1');
  return rows;
}

/** Re-imports up to `days` of history from the health store. Returns the number of days with steps. */
export async function importStepHistory(userId: string, days = 365): Promise<number> {
  const rows = await uploadDays(userId, lastNDays(days));
  return rows.filter((r) => r.steps > 0).length;
}

async function uploadDays(userId: string, dates: Date[]): Promise<DaySteps[]> {
  const counts = await readDailySteps(dates);
  const now = new Date().toISOString();
  // Skip unreadable days so a failed read never overwrites real data with 0.
  const rows = dates.flatMap((date, i) => {
    const count = counts[i];
    if (count === null || count === undefined) return [];
    return [
      {
        user_id: userId,
        day: toDayKey(date),
        steps: Math.min(Math.max(0, count), 200000),
        source: healthSourceName,
        updated_at: now,
      },
    ];
  });
  if (!rows.length) throw new Error(`Couldn't read steps from ${healthSourceName}`);
  const { error } = await supabase.from('daily_steps').upsert(rows, { onConflict: 'user_id,day' });
  if (error) throw new Error(error.message);
  return rows.map(({ day, steps }) => ({ day, steps }));
}

/** Step history for the last `days` days, oldest first, with missing days filled as 0. */
export async function getStepHistory(userId: string, days: number): Promise<DaySteps[]> {
  const dates = lastNDays(days);
  const rows = unwrap<DaySteps[]>(
    await supabase
      .from('daily_steps')
      .select('day, steps')
      .eq('user_id', userId)
      .gte('day', toDayKey(dates[0]))
      .lte('day', toDayKey(dates[dates.length - 1]))
  );
  const byDay = new Map(rows.map((r) => [r.day, r.steps]));
  return dates.map((d) => {
    const day = toDayKey(d);
    return { day, steps: byDay.get(day) ?? 0 };
  });
}

/** Steps for every day of a calendar month (month is 0-based), with missing days as 0. */
export async function getMonthSteps(userId: string, year: number, month: number): Promise<DaySteps[]> {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const dates = Array.from({ length: count }, (_, i) => addDays(first, i));
  const rows = unwrap<DaySteps[]>(
    await supabase
      .from('daily_steps')
      .select('day, steps')
      .eq('user_id', userId)
      .gte('day', toDayKey(dates[0]!))
      .lte('day', toDayKey(dates[count - 1]!))
  );
  const byDay = new Map(rows.map((r) => [r.day, r.steps]));
  return dates.map((d) => {
    const day = toDayKey(d);
    return { day, steps: byDay.get(day) ?? 0 };
  });
}

export function summarize(history: DaySteps[]) {
  const total = history.reduce((sum, d) => sum + d.steps, 0);
  return {
    today: history[history.length - 1]?.steps ?? 0,
    total,
    average: activeAverage(total, history.filter((d) => d.steps > 0).length),
    best: history.reduce((max, d) => Math.max(max, d.steps), 0),
  };
}

export function periodRange(period: Period): { from: string; to: string } {
  const today = startOfDay(new Date());
  const offset = period === 'today' ? 0 : period === 'week' ? 6 : 29;
  return { from: toDayKey(addDays(today, -offset)), to: toDayKey(today) };
}

// ---------- Profiles ----------

export async function getProfile(id: string): Promise<Profile> {
  return unwrap<Profile>(await supabase.from('profiles').select('*').eq('id', id).single());
}

export async function updateProfile(
  id: string,
  patch: Partial<
    Pick<Profile, 'display_name' | 'daily_goal' | 'avatar_color' | 'avatar_icon' | keyof Flair>
  >
): Promise<Profile> {
  return unwrap<Profile>(
    await supabase.from('profiles').update(patch).eq('id', id).select('*').single()
  );
}

/** Keeps the profile's IANA time zone in sync with the phone (used to decide when a day is final). */
export async function syncTimezone(userId: string): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = `steppa:tz:${userId}`;
  if (!tz || localStorage.getItem(key) === tz) return;
  const { error } = await supabase.from('profiles').update({ timezone: tz }).eq('id', userId);
  if (!error) localStorage.setItem(key, tz);
}

export type ProfileStats = {
  lifetime_steps: number;
  days_tracked: number;
  best_day: string | null;
  best_steps: number | null;
  current_streak: number;
  longest_streak: number;
  gold: number;
  silver: number;
  bronze: number;
  groups_count: number;
};

export async function getProfileStats(id: string): Promise<ProfileStats> {
  const rows = unwrap<ProfileStats[]>(await supabase.rpc('profile_stats', { uid: id }));
  const row = rows[0]!;
  return { ...row, lifetime_steps: Number(row.lifetime_steps) };
}

// ---------- Groups ----------

export async function getMyGroups(): Promise<GroupWithCount[]> {
  // RLS only returns groups the current user belongs to.
  const rows = unwrap<(Group & { group_members: { count: number }[] })[]>(
    await supabase
      .from('groups')
      .select('*, group_members(count)')
      .order('created_at', { ascending: false })
  );
  return rows.map(({ group_members, ...g }) => ({
    ...g,
    member_count: group_members[0]?.count ?? 0,
  }));
}

export async function getGroup(id: string): Promise<Group> {
  return unwrap<Group>(await supabase.from('groups').select('*').eq('id', id).single());
}

export async function createGroup(
  ownerId: string,
  name: string,
  description?: string
): Promise<Group> {
  return unwrap<Group>(
    await supabase
      .from('groups')
      .insert({ owner_id: ownerId, name: name.trim(), description: description?.trim() || null })
      .select('*')
      .single()
  );
}

export async function joinGroup(code: string): Promise<string> {
  return unwrap<string>(await supabase.rpc('join_group_by_code', { code }));
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<Group, 'name' | 'description' | 'icon' | 'color' | 'invite_code'>>
): Promise<Group> {
  return unwrap<Group>(
    await supabase.from('groups').update(patch).eq('id', groupId).select('*').single()
  );
}

/** Replaces the invite code so old codes stop working. */
export async function regenerateInviteCode(groupId: string): Promise<Group> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return updateGroup(groupId, { invite_code: code });
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}

export async function getLeaderboard(groupId: string, period: Period): Promise<LeaderboardRow[]> {
  const { from, to } = periodRange(period);
  return leaderboardBetween(groupId, from, to);
}

/** Leaderboard for a single day (`YYYY-MM-DD`), e.g. yesterday's podium. */
export async function getDayLeaderboard(groupId: string, day: string): Promise<LeaderboardRow[]> {
  return leaderboardBetween(groupId, day, day);
}

async function leaderboardBetween(groupId: string, from: string, to: string): Promise<LeaderboardRow[]> {
  const rows = unwrap<LeaderboardRow[]>(
    await supabase.rpc('group_leaderboard', { gid: groupId, from_day: from, to_day: to })
  );
  return rows.map((r) => ({ ...r, total_steps: Number(r.total_steps) }));
}

// ---------- Chat ----------

/** Most recent messages first. */
export async function getMessages(groupId: string, limit = 50): Promise<ChatMessage[]> {
  return unwrap<ChatMessage[]>(
    await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

/** Id of the newest message someone else posted in the group, or null if there are none. */
export async function getLatestMessageId(groupId: string, excludeUserId: string): Promise<number | null> {
  const row = unwrap<{ id: number } | null>(
    await supabase
      .from('group_messages')
      .select('id')
      .eq('group_id', groupId)
      .neq('user_id', excludeUserId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return row?.id ?? null;
}

export async function sendMessage(groupId: string, userId: string, body: string): Promise<ChatMessage> {
  return unwrap<ChatMessage>(
    await supabase
      .from('group_messages')
      .insert({ group_id: groupId, user_id: userId, body: body.trim() })
      .select('*')
      .single()
  );
}

// ---------- Moderation ----------

/** Reports a message for review; it's hidden for the reporter right away (by RLS). */
export async function reportMessage(messageId: number, reporterId: string): Promise<void> {
  const { error } = await supabase
    .from('message_reports')
    .insert({ message_id: messageId, reporter_id: reporterId });
  // Already reported by this user: treat as done.
  if (error && error.code !== '23505') throw new Error(error.message);
}

/** Hides everything this user posts in chat, for the blocker only. */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw new Error(error.message);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw new Error(error.message);
}

export type BlockedUser = Pick<Profile, 'id' | 'display_name' | 'avatar_color' | 'avatar_icon'>;

export async function getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  const blocks = unwrap<{ blocked_id: string }[]>(
    await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', blockerId)
  );
  if (!blocks.length) return [];
  return unwrap<BlockedUser[]>(
    await supabase
      .from('profiles')
      .select('id, display_name, avatar_color, avatar_icon')
      .in(
        'id',
        blocks.map((b) => b.blocked_id)
      )
      .order('display_name')
  );
}

// ---------- Account ----------

/** Permanently deletes the signed-in user and all their data (see migration 009). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}

let channelCount = 0;

/** Calls `onInsert` for every new message in the group; returns an unsubscribe function. */
export function subscribeToMessages(groupId: string, onInsert: (m: ChatMessage) => void): () => void {
  // Unique name per subscription: the chat and the unread dot can listen to the same group at once.
  const channel = supabase
    .channel(`group-chat:${groupId}:${++channelCount}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
