-- Medals only count days on or after a member joined, so new joiners can't change past results.
-- Run in the Supabase SQL editor after 003.

create or replace function public.group_leaderboard(gid uuid, from_day date, to_day date)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_color text,
  total_steps bigint,
  rank int,
  prev_rank int,
  streak int,
  gold int,
  silver int,
  bronze int
) language sql stable security invoker set search_path = public as $$
  with members as (
    select p.id, p.username, p.display_name, p.avatar_color, p.daily_goal, m.joined_at::date as joined
    from group_members m
    join profiles p on p.id = m.user_id
    where m.group_id = gid
  ),
  cur as (
    select m.id, coalesce(sum(s.steps), 0)::bigint as total
    from members m
    left join daily_steps s on s.user_id = m.id and s.day between from_day and to_day
    group by m.id
  ),
  prev as (
    select m.id, coalesce(sum(s.steps), 0)::bigint as total
    from members m
    left join daily_steps s on s.user_id = m.id and s.day between from_day - 1 and to_day - 1
    group by m.id
  ),
  cur_ranked as (select id, total, rank() over (order by total desc)::int as r from cur),
  prev_ranked as (select id, rank() over (order by total desc)::int as r from prev),
  daily as (
    select s.user_id, rank() over (partition by s.day order by s.steps desc) as r
    from daily_steps s
    join members m on m.id = s.user_id
    where s.steps > 0
      and s.day < current_date
      and s.day >= m.joined
  ),
  medals as (
    select d.user_id,
           count(*) filter (where d.r = 1)::int as gold,
           count(*) filter (where d.r = 2)::int as silver,
           count(*) filter (where d.r = 3)::int as bronze
    from daily d
    group by d.user_id
  ),
  hits as (
    select s.user_id, s.day
    from daily_steps s
    join members m on m.id = s.user_id
    where s.steps >= m.daily_goal
  ),
  streaks as (
    select t.user_id, count(*)::int as streak
    from (
      select h.user_id, h.day, h.day - (row_number() over (partition by h.user_id order by h.day))::int as grp
      from hits h
    ) t
    group by t.user_id, t.grp
    having max(t.day) >= current_date - 1
  )
  select m.id, m.username, m.display_name, m.avatar_color,
         c.total, c.r, p.r,
         coalesce(st.streak, 0), coalesce(md.gold, 0), coalesce(md.silver, 0), coalesce(md.bronze, 0)
  from members m
  join cur_ranked c on c.id = m.id
  join prev_ranked p on p.id = m.id
  left join streaks st on st.user_id = m.id
  left join medals md on md.user_id = m.id
  order by c.total desc, m.display_name;
$$;

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
    select gm.group_id as id
    from group_members gm
    where gm.user_id = uid
  ),
  daily as (
    select s.user_id, rank() over (partition by ug.id, s.day order by s.steps desc) as r
    from user_groups ug
    join group_members gm on gm.group_id = ug.id
    join daily_steps s on s.user_id = gm.user_id
    where s.steps > 0 and s.day < current_date and s.day >= gm.joined_at::date
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
