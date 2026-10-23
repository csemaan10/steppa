import type { CharacterLook } from '@/lib/character';
import { addDays, lastNDays, startOfDay, toDayKey } from '@/lib/dates';
import { healthSourceName, readDailySteps } from '@/lib/health';
import { getRoute, progressOn, type Route } from '@/lib/journeys';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_icon: string | null;
  /** Podium character as stored; read it through normalizeLook (src/lib/character.ts). */
  podium_character?: CharacterLook | null;
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

export type LeaderboardRow = {
  /** Podium character as stored (null until the player makes one); see normalizeLook. */
  podium_character?: CharacterLook | null;
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
  edited_at: string | null;
};

/** Stored reaction keys; the chat maps them to emoji. Must match the check in migration 011. */
export type ReactionKey = 'like' | 'love' | 'laugh' | 'fire' | 'shoe' | 'wow';

export type Reaction = { message_id: number; user_id: string; emoji: ReactionKey };

export type DaySteps = { day: string; steps: number };

export type Period = 'today' | 'yesterday' | 'week' | 'month';

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

/**
 * One sync at a time. The Today screen, the background task and Apple Health's change wake-up can
 * all start a sync; run in parallel, an older (lower) reading could reach Supabase after a newer one
 * and overwrite it. Chaining them keeps "read order" and "saved order" the same.
 */
let syncQueue: Promise<unknown> = Promise.resolve();
/** How long a sync waits for the one ahead of it; a hung request mustn't block syncing forever. */
const SYNC_WAIT_MS = 30_000;

function uploadDays(userId: string, dates: Date[]): Promise<DaySteps[]> {
  const ahead = Promise.race([syncQueue, new Promise((resolve) => setTimeout(resolve, SYNC_WAIT_MS))]);
  const run = ahead.then(() => readAndUpload(userId, dates));
  // A failed sync mustn't block the ones after it.
  syncQueue = run.catch(() => {});
  return run;
}

async function readAndUpload(userId: string, dates: Date[]): Promise<DaySteps[]> {
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
  if (period === 'yesterday') {
    const day = toDayKey(addDays(today, -1));
    return { from: day, to: day };
  }
  const offset = period === 'today' ? 0 : period === 'week' ? 6 : 29;
  return { from: toDayKey(addDays(today, -offset)), to: toDayKey(today) };
}

// ---------- Profiles ----------

export async function getProfile(id: string): Promise<Profile> {
  return unwrap<Profile>(await supabase.from('profiles').select('*').eq('id', id).single());
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'display_name' | 'daily_goal' | 'avatar_color' | 'avatar_icon' | 'podium_character'>>
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

export async function editMessage(messageId: number, body: string): Promise<ChatMessage> {
  return unwrap<ChatMessage>(
    await supabase.from('group_messages').update({ body: body.trim() }).eq('id', messageId).select('*').single()
  );
}

export async function deleteMessage(messageId: number): Promise<void> {
  const { error } = await supabase.from('group_messages').delete().eq('id', messageId);
  if (error) throw new Error(error.message);
}

export async function getReactions(messageIds: number[]): Promise<Reaction[]> {
  if (!messageIds.length) return [];
  return unwrap<Reaction[]>(
    await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds)
  );
}

/** Adds or replaces this user's reaction on a message. */
export async function setReaction(messageId: number, userId: string, emoji: ReactionKey): Promise<void> {
  const { error } = await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' });
  if (error) throw new Error(error.message);
}

export async function removeReaction(messageId: number, userId: string): Promise<void> {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
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

// ---------- Journeys ----------

export type Journey = {
  id: number;
  user_id: string;
  route: string;
  started_on: string;
  completed_on: string | null;
  postcards_seen: number;
  created_at: string;
};

export type CurrentJourney = { journey: Journey; route: Route; steps: number };

/**
 * The latest journey (in progress, or finished and not yet replaced) with the steps walked on it,
 * or null if there's none. Marks it finished once the steps cover the whole route.
 */
export async function getCurrentJourney(userId: string): Promise<CurrentJourney | null> {
  const journey = unwrap<Journey | null>(
    await supabase
      .from('journeys')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  const route = journey ? getRoute(journey.route) : undefined;
  if (!journey || !route) return null;

  let query = supabase.from('daily_steps').select('steps').eq('user_id', userId).gte('day', journey.started_on);
  if (journey.completed_on) query = query.lte('day', journey.completed_on);
  const steps = unwrap<{ steps: number }[]>(await query).reduce((sum, r) => sum + r.steps, 0);

  if (!journey.completed_on && progressOn(route, steps).done) {
    const completed = unwrap<Journey>(
      await supabase
        .from('journeys')
        .update({ completed_on: toDayKey(new Date()) })
        .eq('id', journey.id)
        .select('*')
        .single()
    );
    return { journey: completed, route, steps };
  }
  return { journey, route, steps };
}

/** Finished journeys, most recent first. */
export async function getCompletedJourneys(userId: string): Promise<Journey[]> {
  return unwrap<Journey[]>(
    await supabase
      .from('journeys')
      .select('*')
      .eq('user_id', userId)
      .not('completed_on', 'is', null)
      .order('completed_on', { ascending: false })
  );
}

/** Starts a route today. Only steps from today on count toward it. */
export async function startJourney(userId: string, routeKey: string): Promise<Journey> {
  return unwrap<Journey>(
    await supabase
      .from('journeys')
      .insert({ user_id: userId, route: routeKey, started_on: toDayKey(new Date()) })
      .select('*')
      .single()
  );
}

export async function markPostcardsSeen(journeyId: number, count: number): Promise<void> {
  const { error } = await supabase.from('journeys').update({ postcards_seen: count }).eq('id', journeyId);
  if (error) throw new Error(error.message);
}

/** Gives up on a journey in progress; its progress is lost. */
export async function endJourney(journeyId: number): Promise<void> {
  const { error } = await supabase.from('journeys').delete().eq('id', journeyId);
  if (error) throw new Error(error.message);
}

// ---------- Account ----------

/** Permanently deletes the signed-in user and all their data (see migration 009). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
}

let channelCount = 0;

type MessageHandlers = {
  onUpdate?: (m: ChatMessage) => void;
  onDelete?: (messageId: number) => void;
};

/**
 * Calls `onInsert` for every new message in the group (and optionally `onUpdate` for edits and
 * `onDelete` for deletions); returns an unsubscribe function.
 */
export function subscribeToMessages(
  groupId: string,
  onInsert: (m: ChatMessage) => void,
  { onUpdate, onDelete }: MessageHandlers = {}
): () => void {
  const filter = `group_id=eq.${groupId}`;
  // Unique name per subscription: the chat and the unread dot can listen to the same group at once.
  let channel = supabase
    .channel(`group-chat:${groupId}:${++channelCount}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter }, (payload) =>
      onInsert(payload.new as ChatMessage)
    );
  if (onUpdate) {
    channel = channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'group_messages', filter },
      (payload) => onUpdate(payload.new as ChatMessage)
    );
  }
  if (onDelete) {
    // Delete events can't be filtered and carry only the id, so this hears every group's deletions;
    // callers ignore ids they don't have.
    channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages' }, (payload) =>
      onDelete((payload.old as { id: number }).id)
    );
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Live reaction changes in the group; returns an unsubscribe function. */
export function subscribeToReactions(
  groupId: string,
  onUpsert: (r: Reaction) => void,
  onRemove: (messageId: number, userId: string) => void
): () => void {
  const filter = `group_id=eq.${groupId}`;
  const channel = supabase
    .channel(`group-reactions:${groupId}:${++channelCount}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions', filter }, (payload) =>
      onUpsert(payload.new as Reaction)
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter }, (payload) =>
      onUpsert(payload.new as Reaction)
    )
    // Unfilterable, and the old row has only the primary key (message_id, user_id).
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
      const old = payload.old as { message_id: number; user_id: string };
      onRemove(old.message_id, old.user_id);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
