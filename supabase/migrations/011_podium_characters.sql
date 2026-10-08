-- Podium characters: each player's look (skin, hair, clothes, idle move, pets) as JSON.
-- Shown on the podium and in the group trophy cabinet, so the leaderboard returns it too.
-- The app validates the contents and falls back to a default, so the database only checks shape.
-- Run in the Supabase SQL editor after 010. Safe for older builds: they ignore the new column.
-- Wrapped in a transaction because the leaderboard function is dropped and re-created.

begin;

alter table public.profiles
  add column if not exists podium_character jsonb
    check (podium_character is null
      or (jsonb_typeof(podium_character) = 'object' and octet_length(podium_character::text) <= 2000));

-- Same as 010, plus the podium_character column. ("character" alone is a reserved word.)
drop function if exists public.group_leaderboard(uuid, date, date);

create or replace function public.group_leaderboard(gid uuid, from_day date, to_day date)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_color text,
  avatar_icon text,
  flair_icon text,
  flair_color text,
  flair_glow boolean,
  podium_character jsonb,
  total_steps bigint,
  active_days int,
  rank int,
  prev_rank int,
  streak int,
  gold int,
  silver int,
  bronze int
) language sql stable security invoker set search_path = public as $$
  with members as (
    select p.id, p.username, p.display_name, p.avatar_color, p.avatar_icon,
           p.flair_icon, p.flair_color, p.flair_glow, p.podium_character, p.daily_goal,
           m.joined_at::date as joined,
           (now() at time zone p.timezone)::date as local_today
    from group_members m
    join profiles p on p.id = m.user_id
    where m.group_id = gid
  ),
  final as (select min(local_today) as first_open_day from members),
  cur as (
    select m.id,
           coalesce(sum(s.steps), 0)::bigint as total,
           count(s.steps) filter (where s.steps > 0)::int as active
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
  cur_ranked as (select id, total, active, rank() over (order by total desc)::int as r from cur),
  prev_ranked as (select id, rank() over (order by total desc)::int as r from prev),
  daily as (
    select s.user_id, rank() over (partition by s.day order by s.steps desc) as r
    from daily_steps s
    join members m on m.id = s.user_id
    cross join final f
    where s.steps > 0
      and s.day < f.first_open_day
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
    select s.user_id, s.day, m.local_today
    from daily_steps s
    join members m on m.id = s.user_id
    where s.steps >= m.daily_goal
  ),
  streaks as (
    select t.user_id, count(*)::int as streak
    from (
      select h.user_id, h.day, h.local_today,
             h.day - (row_number() over (partition by h.user_id order by h.day))::int as grp
      from hits h
    ) t
    group by t.user_id, t.grp
    having max(t.day) >= max(t.local_today) - 1
  )
  select m.id, m.username, m.display_name, m.avatar_color, m.avatar_icon,
         m.flair_icon, m.flair_color, m.flair_glow, m.podium_character,
         c.total, c.active, c.r, p.r,
         coalesce(st.streak, 0), coalesce(md.gold, 0), coalesce(md.silver, 0), coalesce(md.bronze, 0)
  from members m
  join cur_ranked c on c.id = m.id
  join prev_ranked p on p.id = m.id
  left join streaks st on st.user_id = m.id
  left join medals md on md.user_id = m.id
  order by c.total desc, m.display_name;
$$;

revoke execute on function public.group_leaderboard(uuid, date, date) from anon;

commit;
