-- Time zones: medals for a day are only awarded once it's past midnight for every member of the group,
-- and streaks use each member's own local date. Run in the Supabase SQL editor after 004.

alter table public.profiles add column if not exists timezone text not null default 'UTC';

create or replace function public.validate_timezone()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown time zone: %', new.timezone;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_validate_timezone on public.profiles;
create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_timezone();

-- ---------- Leaderboard ----------

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
    select p.id, p.username, p.display_name, p.avatar_color, p.daily_goal,
           m.joined_at::date as joined,
           (now() at time zone p.timezone)::date as local_today
    from group_members m
    join profiles p on p.id = m.user_id
    where m.group_id = gid
  ),
  -- A day is final only once every member's local date has moved past it.
  final as (select min(local_today) as first_open_day from members),
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

-- ---------- Profile stats ----------

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
  with me as (
    select p.daily_goal, (now() at time zone p.timezone)::date as local_today
    from profiles p where p.id = uid
  ),
  mine as (
    select s.day, s.steps from daily_steps s where s.user_id = uid
  ),
  hits as (
    select m.day from mine m, me where m.steps >= me.daily_goal
  ),
  runs as (
    select count(*)::int as len, max(t.day) as last_day
    from (select h.day, h.day - (row_number() over (order by h.day))::int as grp from hits h) t
    group by t.grp
  ),
  user_groups as (
    select gm.group_id as id from group_members gm where gm.user_id = uid
  ),
  group_final as (
    select gm.group_id, min((now() at time zone p.timezone)::date) as first_open_day
    from group_members gm
    join user_groups ug on ug.id = gm.group_id
    join profiles p on p.id = gm.user_id
    group by gm.group_id
  ),
  daily as (
    select s.user_id, rank() over (partition by gm.group_id, s.day order by s.steps desc) as r
    from group_final gf
    join group_members gm on gm.group_id = gf.group_id
    join daily_steps s on s.user_id = gm.user_id
    where s.steps > 0 and s.day < gf.first_open_day and s.day >= gm.joined_at::date
  ),
  best as (
    select m.day, m.steps from mine m order by m.steps desc, m.day desc limit 1
  )
  select
    (select coalesce(sum(m.steps), 0)::bigint from mine m),
    (select count(*)::int from mine m where m.steps > 0),
    (select b.day from best b),
    (select b.steps from best b),
    coalesce((select r.len from runs r, me where r.last_day >= me.local_today - 1), 0),
    coalesce((select max(r.len) from runs r), 0),
    (select count(*)::int from daily d where d.user_id = uid and d.r = 1),
    (select count(*)::int from daily d where d.user_id = uid and d.r = 2),
    (select count(*)::int from daily d where d.user_id = uid and d.r = 3),
    (select count(*)::int from user_groups);
$$;
