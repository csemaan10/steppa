import { addDays, lastNDays, startOfDay, toDayKey } from '@/lib/dates';
import { healthSourceName, readDailySteps } from '@/lib/health';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  daily_goal: number;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type GroupWithCount = Group & { member_count: number };

export type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  total_steps: number;
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

type Result<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Steps ----------

/** Reads the last `days` days from the phone's health store and upserts them. */
export async function syncSteps(userId: string, days = 7): Promise<DaySteps[]> {
  const dates = lastNDays(days);
  const counts = await readDailySteps(dates);
  const now = new Date().toISOString();
  const rows = dates.map((date, i) => ({
    user_id: userId,
    day: toDayKey(date),
    steps: Math.min(Math.max(0, counts[i]), 200000),
    source: healthSourceName,
    updated_at: now,
  }));
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

export function summarize(history: DaySteps[]) {
  const total = history.reduce((sum, d) => sum + d.steps, 0);
  return {
    today: history[history.length - 1]?.steps ?? 0,
    total,
    average: history.length ? Math.round(total / history.length) : 0,
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
  patch: Partial<Pick<Profile, 'display_name' | 'daily_goal' | 'avatar_color'>>
): Promise<Profile> {
  return unwrap<Profile>(
    await supabase.from('profiles').update(patch).eq('id', id).select('*').single()
  );
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

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}

export async function getLeaderboard(groupId: string, period: Period): Promise<LeaderboardRow[]> {
  const { from, to } = periodRange(period);
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

export async function sendMessage(groupId: string, userId: string, body: string): Promise<ChatMessage> {
  return unwrap<ChatMessage>(
    await supabase
      .from('group_messages')
      .insert({ group_id: groupId, user_id: userId, body: body.trim() })
      .select('*')
      .single()
  );
}

/** Calls `onInsert` for every new message in the group; returns an unsubscribe function. */
export function subscribeToMessages(groupId: string, onInsert: (m: ChatMessage) => void): () => void {
  const channel = supabase
    .channel(`group-chat:${groupId}`)
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
