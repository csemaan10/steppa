import type { CharacterLook } from '@/lib/character';
import { addDays, lastNDays, startOfDay, toDayKey } from '@/lib/dates';
import { healthSourceName, readDailySteps } from '@/lib/health';
import { getRoute, progressOn, type Route } from '@/lib/journeys';
import { supabase } from '@/lib/supabase';
import type { SavedPicks, WorldKind } from '@/lib/world';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  avatar_icon: string | null;
  /** Podium character as stored; read it through normalizeLook (src/lib/character.ts). */
  podium_character?: CharacterLook | null;
  daily_goal: number;
  /** Push when a group's daily results are in (migration 017; missing before it, which means on). */
  recap_push?: boolean;
  /** Pet notifications that come from the server (a friend's pet visiting); mirrors the switch on the phone. */
  pet_push?: boolean;
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

/** Stored reaction keys; the chat maps them to emoji. Must match the check in migration 013. */
export type ReactionKey =
  | 'like'
  | 'love'
  | 'laugh'
  | 'fire'
  | 'shoe'
  | 'wow'
  | 'clap'
  | 'party'
  | 'strong'
  | 'trophy'
  | 'hundred'
  | 'sad'
  | 'angry'
  | 'eyes'
  | 'thanks';

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
  // The zone these days were counted in: once a day is over, only a phone in the same zone can
  // update it (migration 029), so travelling never re-cuts finished days at a new midnight.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
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
        timezone,
      },
    ];
  });
  if (!rows.length) throw new Error(`Couldn't read steps from ${healthSourceName}`);
  let { error } = await supabase.from('daily_steps').upsert(rows, { onConflict: 'user_id,day' });
  // PGRST204: no timezone column yet (before migration 029). Save the steps without it.
  if (error?.code === 'PGRST204') {
    ({ error } = await supabase
      .from('daily_steps')
      .upsert(rows.map(({ timezone: _, ...row }) => row), { onConflict: 'user_id,day' }));
  }
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
  patch: Partial<
    Pick<Profile, 'display_name' | 'daily_goal' | 'avatar_color' | 'avatar_icon' | 'podium_character' | 'recap_push' | 'pet_push'>
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

/** Ties this phone's push token to the signed-in account (moving it from any other). */
export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  unwrap(await supabase.rpc('register_push_token', { push_token: token, push_platform: platform }));
}

export async function unregisterPushToken(token: string): Promise<void> {
  unwrap(await supabase.rpc('unregister_push_token', { push_token: token }));
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

/**
 * Your groups with the id of the newest message someone else posted in each, in one request
 * (rather than a getLatestMessageId call per group).
 */
export async function getMyGroupsWithLatestMessage(
  userId: string
): Promise<(GroupWithCount & { latest_message_id: number | null })[]> {
  const rows = unwrap<
    (Group & { group_members: { count: number }[]; group_messages: { id: number }[] })[]
  >(
    await supabase
      .from('groups')
      .select('*, group_members(count), group_messages(id)')
      .neq('group_messages.user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { referencedTable: 'group_messages', ascending: false })
      .limit(1, { referencedTable: 'group_messages' })
  );
  return rows.map(({ group_members, group_messages, ...g }) => ({
    ...g,
    member_count: group_members[0]?.count ?? 0,
    latest_message_id: group_messages[0]?.id ?? null,
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

/**
 * Whether a group's results for `day` are out: from 5 am the next morning wherever in the group that
 * comes last, once the day is over for everyone. True if it can't tell (e.g. before migration 017).
 */
export async function isRecapReleased(groupId: string, day: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('recap_released_at', { gid: groupId, d: day });
  if (error || !data) return true;
  return new Date(data as string).getTime() <= Date.now();
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

// ---------- Group journeys ----------

export type GroupJourney = {
  id: number;
  group_id: string;
  route: string;
  started_on: string;
  started_by: string | null;
  completed_on: string | null;
  created_at: string;
};

export type GroupJourneyStatus = {
  journey: GroupJourney;
  route: Route;
  /** Everyone's steps added up. */
  steps: number;
  /** Each current member's steps toward it, most first. */
  members: { user_id: string; steps: number }[];
};

/**
 * The group's latest journey (in progress, or finished and not yet replaced) with everyone's steps
 * toward it, or null if it hasn't had one. Marks it finished once the steps cover the whole route.
 */
export async function getGroupJourney(groupId: string): Promise<GroupJourneyStatus | null> {
  const journey = unwrap<GroupJourney | null>(
    await supabase
      .from('group_journeys')
      .select('*')
      .eq('group_id', groupId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  const route = journey ? getRoute(journey.route) : undefined;
  if (!journey || !route) return null;

  const rows = unwrap<{ user_id: string; steps: number }[]>(
    await supabase.rpc('group_journey_steps', {
      gid: groupId,
      from_day: journey.started_on,
      to_day: journey.completed_on,
    })
  );
  const members = rows.map((r) => ({ user_id: r.user_id, steps: Number(r.steps) })).sort((a, b) => b.steps - a.steps);
  const steps = members.reduce((sum, m) => sum + m.steps, 0);

  if (!journey.completed_on && progressOn(route, steps).done) {
    const completed = unwrap<GroupJourney>(
      await supabase
        .from('group_journeys')
        .update({ completed_on: toDayKey(new Date()) })
        .eq('id', journey.id)
        .select('*')
        .single()
    );
    return { journey: completed, route, steps, members };
  }
  return { journey, route, steps, members };
}

/** Starts a group on a route today (owner only). Only steps from today on count toward it. */
export async function startGroupJourney(groupId: string, routeKey: string): Promise<GroupJourney> {
  return unwrap<GroupJourney>(
    await supabase
      .from('group_journeys')
      .insert({ group_id: groupId, route: routeKey, started_on: toDayKey(new Date()) })
      .select('*')
      .single()
  );
}

/** Gives up on the group's journey (owner only); its progress is lost. */
export async function endGroupJourney(journeyId: number): Promise<void> {
  const { error } = await supabase.from('group_journeys').delete().eq('id', journeyId);
  if (error) throw new Error(error.message);
}

// ---------- Worlds ----------

export type World = {
  user_id: string;
  kind: WorldKind;
  picks: SavedPicks;
  started_on: string;
  /** Milestones already celebrated: levels below this one. */
  celebrated: number;
  created_at: string;
  /** Treats eaten, which teach it tricks (src/lib/world/tricks.ts). Missing before migration 018. */
  treats_fed?: number;
};

export type WorldStatus = { world: World; steps: number };

/** Your world and the steps it has grown with, or null before you've chosen one. */
export async function getWorld(userId: string): Promise<WorldStatus | null> {
  const world = unwrap<World | null>(await supabase.from('worlds').select('*').eq('user_id', userId).maybeSingle());
  if (!world) return null;
  const steps = unwrap<number>(await supabase.rpc('world_steps'));
  return { world, steps: Number(steps) };
}

/**
 * A group mate's pet and the steps it has grown with, for their profile; null if they haven't one
 * or you can't see it (no shared group, or before migration 016).
 */
export async function getMateWorld(userId: string): Promise<WorldStatus | null> {
  const world = unwrap<World | null>(await supabase.from('worlds').select('*').eq('user_id', userId).maybeSingle());
  if (!world) return null;
  const steps = unwrap<number>(await supabase.rpc('world_steps', { uid: userId }));
  return { world, steps: Number(steps) };
}

/** Whether you've adopted a pet yet, without adding up its steps (for Today's invite card). */
export async function hasWorld(userId: string): Promise<boolean> {
  const row = unwrap<{ user_id: string } | null>(
    await supabase.from('worlds').select('user_id').eq('user_id', userId).maybeSingle()
  );
  return !!row;
}

/**
 * Starts growing a world today, with the choices made while setting it up (so the first milestone,
 * level 0, counts as celebrated). Only steps from today on count.
 */
export async function startWorld(userId: string, kind: WorldKind, picks: SavedPicks): Promise<World> {
  return unwrap<World>(
    await supabase
      .from('worlds')
      .insert({ user_id: userId, kind, picks, started_on: toDayKey(new Date()), celebrated: 1 })
      .select('*')
      .single()
  );
}

/** Saves choices or records celebrated milestones. */
export async function updateWorld(
  userId: string,
  patch: Partial<Pick<World, 'kind' | 'picks' | 'celebrated'>>
): Promise<void> {
  const { error } = await supabase.from('worlds').update(patch).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** A pet's treats: earned by walking, eaten (training tricks) and spent on adventures. */
export type Treats = { earned: number; fed: number; spent: number; toNext: number };

/** Steps walked for each treat. Must match pet_treats in migration 023. */
export const STEPS_PER_TREAT = 1500;

/** Your pet's treats (migration 018), or null without a pet or before the migration has run. */
export async function getTreats(): Promise<Treats | null> {
  const { data, error } = await supabase.rpc('pet_treats');
  const row = (data as { earned: number; fed: number; spent: number; to_next: number }[] | null)?.[0];
  if (error || !row) return null;
  return { earned: row.earned, fed: row.fed, spent: row.spent, toNext: row.to_next };
}

/** Gives your pet a treat. Returns how many it has eaten now, or null if there was none to give. */
export async function feedPet(): Promise<number | null> {
  return unwrap<number | null>(await supabase.rpc('feed_pet'));
}

/** A reward paid in treats (migration 021); see src/lib/treats.ts for what each reason means. */
export type TreatBonus = {
  id: number;
  reason: 'milestone' | 'goal' | 'streak' | 'medal' | 'journey' | 'visit';
  ref: string;
  detail: string | null;
  treats: number;
  created_at: string;
};

/** Collects any bonus treats you've earned and not been given yet: the new ones (none before migration 021). */
export async function claimTreats(): Promise<TreatBonus[]> {
  const { data, error } = await supabase.rpc('claim_treats');
  return error ? [] : ((data as TreatBonus[] | null) ?? []);
}

/** Your latest bonus treats, newest first. */
export async function getTreatBonuses(limit = 8): Promise<TreatBonus[]> {
  const { data, error } = await supabase
    .from('treat_bonuses')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit);
  return error ? [] : (data as TreatBonus[]);
}

/**
 * What the shop sells for how many treats, and the months (1–12) seasonal things are on sale.
 * Souvenirs aren't for sale (a full passport page brings them), so they have no price.
 */
export type ShopPrice = {
  item: string;
  kind: 'keep' | 'visit' | 'souvenir';
  treats: number | null;
  months: number[] | null;
};

/** The shop's prices; empty before migration 021. */
export async function getShopPrices(): Promise<ShopPrice[]> {
  const { data, error } = await supabase.from('shop_items').select('item, kind, treats, months');
  return error ? [] : (data as ShopPrice[]);
}

/** The things someone has bought for their pet to keep. */
export async function getPurchases(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('pet_purchases').select('item').eq('user_id', userId);
  return error ? [] : (data as { item: string }[]).map((r) => r.item);
}

/** Buys something to keep. True once it's yours; false if you're short of treats. */
export async function buyItem(item: string): Promise<boolean> {
  return unwrap<boolean>(await supabase.rpc('buy_item', { item_id: item }));
}

/** A day your pet spends in a group mate's yard (migration 021): `guest` sent theirs over. */
export type Visit = { id: number; guest: string; host: string; day: string; created_at: string };

/** Today's visits, newest first: your pet's to a friend (one at most) and friends' pets to yours. */
export async function getTodaysVisits(userId: string): Promise<Visit[]> {
  const today = toDayKey(new Date());
  const { data, error } = await supabase
    .from('pet_visits')
    .select('*')
    .or(`guest.eq.${userId},host.eq.${userId}`)
    .gte('day', toDayKey(addDays(new Date(), -1)))
    .order('id', { ascending: false });
  if (error) return [];
  return (data as Visit[]).filter((v) => v.day === today);
}

/** Sends your pet to spend today in a group mate's yard. False if you're short of treats or it's already been. */
export async function visitMate(mate: string): Promise<boolean> {
  return unwrap<boolean>(await supabase.rpc('visit_mate', { mate }));
}

/** A group mate with a pet: who they are, and the pet. */
/** Your pet's visits to friends, newest first; empty before migration 021. */
export async function getVisits(userId: string): Promise<Visit[]> {
  const { data, error } = await supabase.from('pet_visits').select('*').eq('guest', userId).order('day', { ascending: false });
  return error ? [] : (data as Visit[]);
}

export type PetMate = { id: string; name: string; world: World };

/** Everyone in your groups who has a pet, by name. */
export async function getPetMates(userId: string): Promise<PetMate[]> {
  const mine = unwrap<{ group_id: string }[]>(await supabase.from('group_members').select('group_id').eq('user_id', userId));
  if (!mine.length) return [];
  const members = unwrap<{ user_id: string }[]>(
    await supabase
      .from('group_members')
      .select('user_id')
      .in(
        'group_id',
        mine.map((g) => g.group_id)
      )
      .neq('user_id', userId)
  );
  const ids = [...new Set(members.map((m) => m.user_id))];
  if (!ids.length) return [];
  const [worlds, profiles] = await Promise.all([
    supabase.from('worlds').select('*').in('user_id', ids),
    supabase.from('profiles').select('id, display_name').in('id', ids),
  ]);
  const names = new Map(unwrap<{ id: string; display_name: string }[]>(profiles).map((p) => [p.id, p.display_name]));
  return unwrap<World[]>(worlds)
    .filter((w) => w.kind === 'pet')
    .map((w) => ({ id: w.user_id, name: names.get(w.user_id) ?? 'A friend', world: w }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Brings home the keepsake for every page of your pet's passport that its trips have filled
 * (migration 023). Returns the new keepsakes (none before 023).
 */
export async function claimKeepsakes(): Promise<string[]> {
  const { data, error } = await supabase.rpc('claim_keepsakes');
  return error ? [] : ((data as string[] | null) ?? []);
}

/**
 * Feeds several treats at once (migration 019), to teach a whole trick from the shop. Returns how
 * many it has eaten now, or null if there weren't enough.
 */
export async function feedPetMany(amount: number): Promise<number | null> {
  return unwrap<number | null>(await supabase.rpc('feed_pet_many', { amount }));
}

export type Adventure = { id: number; place: string; created_at: string };

/** Where someone's pet has been, newest first; empty before migration 018. */
export async function getAdventures(userId: string): Promise<Adventure[]> {
  const { data, error } = await supabase
    .from('pet_adventures')
    .select('id, place, created_at')
    .eq('user_id', userId)
    .order('id', { ascending: false });
  return error ? [] : (data as Adventure[]);
}

/** Spends treats on an adventure to `place` (a key from src/lib/pet-adventures.ts). False if short of treats. */
export async function goOnAdventure(place: string): Promise<boolean> {
  return unwrap<boolean>(await supabase.rpc('go_on_adventure', { destination: place }));
}

// ---------- Playdates ----------

/** How giving a treat went: given, or why not (see give_treat in migration 020). */
export type GiveTreat = 'given' | 'already' | 'no-treats' | 'no-pet' | 'not-friends';

/** Gives a group mate's pet one of your treats, once a day for each friend. */
export async function giveTreat(friendId: string): Promise<GiveTreat> {
  return unwrap<GiveTreat>(await supabase.rpc('give_treat', { friend: friendId }));
}

/** A treat a friend gave your pet. */
export type TreatGift = { id: number; from: string; created_at: string };

/** Treats friends have given your pet, newest first; empty before migration 020. */
export async function getTreatGifts(userId: string): Promise<TreatGift[]> {
  const { data, error } = await supabase
    .from('pet_gifts')
    .select('id, created_at, giver:profiles!pet_gifts_from_user_fkey(display_name)')
    .eq('to_user', userId)
    .order('id', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return (data as unknown as { id: number; created_at: string; giver: { display_name: string } | null }[]).map((g) => ({
    id: g.id,
    from: g.giver?.display_name ?? 'A friend',
    created_at: g.created_at,
  }));
}

/** When you last gave this friend's pet a treat, or null if never (or before migration 020). */
export async function lastTreatGiven(fromId: string, toId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('pet_gifts')
    .select('created_at')
    .eq('from_user', fromId)
    .eq('to_user', toId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  return error || !data ? null : (data as { created_at: string }).created_at;
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
