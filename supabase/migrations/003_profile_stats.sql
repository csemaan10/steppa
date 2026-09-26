-- Lifetime profile stats: medals across all groups, streaks, bests.
-- Run in the Supabase SQL editor after 002.

-- Security invoker: when viewing someone else, RLS limits this to groups/steps you share with them.
create or replace function public.profile_stats(uid uuid)
returns table (
  lifetime_steps bigint,
  days_tracked int,
  best_day date,
  best_steps int,
  current_streak int,
  longest_streak int,
  gold int,
  silver int,
  bronze int,
  groups_count int
) language sql stable security invoker set search_path = public as $$
  with mine as (
    select s.day, s.steps from daily_steps s where s.user_id = uid
  ),
  hits as (
    select m.day
    from mine m, profiles p
    where p.id = uid and m.steps >= p.daily_goal
  ),
  runs as (
    select count(*)::int as len, max(t.day) as last_day
    from (select h.day, h.day - (row_number() over (order by h.day))::int as grp from hits h) t
    group by t.grp
  ),
  user_groups as (
    select g.id, g.created_at::date as since
    from group_members gm
    join groups g on g.id = gm.group_id
    where gm.user_id = uid
  ),
  daily as (
    select s.user_id, rank() over (partition by ug.id, s.day order by s.steps desc) as r
    from user_groups ug
    join group_members gm on gm.group_id = ug.id
    join daily_steps s on s.user_id = gm.user_id
    where s.steps > 0 and s.day < current_date and s.day >= ug.since
  ),
  best as (
    select m.day, m.steps from mine m order by m.steps desc, m.day desc limit 1
  )
  select
    (select coalesce(sum(m.steps), 0)::bigint from mine m),
    (select count(*)::int from mine m where m.steps > 0),
    (select b.day from best b),
    (select b.steps from best b),
    coalesce((select r.len from runs r where r.last_day >= current_date - 1), 0),
    coalesce((select max(r.len) from runs r), 0),
    (select count(*)::int from daily d where d.user_id = uid and d.r = 1),
    (select count(*)::int from daily d where d.user_id = uid and d.r = 2),
    (select count(*)::int from daily d where d.user_id = uid and d.r = 3),
    (select count(*)::int from user_groups);
$$;

revoke execute on function public.profile_stats(uuid) from anon;
