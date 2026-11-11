-- Steady days: past days stop changing.
--
-- 1. Each day's steps remember the time zone they were counted in. Once that day is over there, only
--    a phone in the same time zone can update it, so travelling doesn't re-cut finished days at a new
--    midnight. (Older builds don't send a zone; their updates go through as before.)
--    And a finished day's steps can only go up, so a phone that reads less can't wipe it.
-- 2. A group's results for a day (everyone's steps and places) are frozen 2 days after the day is
--    over for every member. Late syncs within those 2 days still count; after that, medals,
--    trophies and the day's podium stay as they were. Only days from the day this runs are
--    frozen: older days keep being worked out live, as before.
--
-- Run in the Supabase SQL editor after 028 (it needs pg_cron), BEFORE publishing the app update that
-- sends daily_steps.timezone. Safe for older builds: the column is optional, and the leaderboard
-- returns the same columns.

begin;

-- ---------- 1. The time zone a day was counted in ----------

alter table public.daily_steps add column if not exists timezone text;

-- Once a day is over (in the zone it was counted in, else the profile's):
--  * a phone in a different zone can't update it (returning null leaves the row as it was), and
--  * its steps can only go up. A phone that reads less (Health history not there yet, access
--    turned off, a second device) can't wipe a finished day; today can still go up and down.
-- Also drops an unknown zone rather than failing the sync.
create or replace function public.keep_finished_day()
returns trigger
language plpgsql set search_path = public as $$
declare
  zone text;
begin
  if new.timezone is not null then
    begin
      perform now() at time zone new.timezone;
    exception when others then
      new.timezone := null;
    end;
  end if;
  if tg_op = 'UPDATE' then
    zone := coalesce(old.timezone, new.timezone, (select p.timezone from profiles p where p.id = old.user_id), 'UTC');
    if old.day < (now() at time zone zone)::date then
      if old.timezone is not null and new.timezone is not null and new.timezone <> old.timezone then
        return null;
      end if;
      new.steps := greatest(new.steps, old.steps);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists daily_steps_keep_finished on public.daily_steps;
create trigger daily_steps_keep_finished
  before insert or update on public.daily_steps
  for each row execute function public.keep_finished_day();

-- ---------- 2. Frozen group results ----------

-- Which of a group's days are frozen.
create table if not exists public.group_days_frozen (
  group_id uuid not null references public.groups (id) on delete cascade,
  day date not null,
  frozen_at timestamptz not null default now(),
  primary key (group_id, day)
);

-- Everyone who was in the group that day: their steps, and their place among those who walked
-- (null for no steps). Members who joined later aren't here; they're counted live, as before.
create table if not exists public.group_day_steps (
  group_id uuid not null,
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  steps integer not null,
  place integer,
  primary key (group_id, day, user_id),
  foreign key (group_id, day) references public.group_days_frozen (group_id, day) on delete cascade
);

alter table public.group_days_frozen enable row level security;
alter table public.group_day_steps enable row level security;
drop policy if exists "group_days_frozen_select" on public.group_days_frozen;
create policy "group_days_frozen_select" on public.group_days_frozen
  for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "group_day_steps_select" on public.group_day_steps;
create policy "group_day_steps_select" on public.group_day_steps
  for select to authenticated using (public.is_group_member(group_id));
revoke insert, update, delete on public.group_days_frozen, public.group_day_steps from authenticated, anon;
grant select on public.group_days_frozen, public.group_day_steps to authenticated;

-- A group's steps per member and day: the frozen ones where there are, live ones otherwise.
create or replace function public.group_steps(gid uuid, from_day date, to_day date)
returns table (user_id uuid, day date, steps integer)
language sql stable security invoker set search_path = public as $$
  select f.user_id, f.day, f.steps
  from group_day_steps f
  where f.group_id = gid and f.day between from_day and to_day
  union all
  select s.user_id, s.day, s.steps
  from daily_steps s
  join group_members m on m.group_id = gid and m.user_id = s.user_id
  where s.day between from_day and to_day
    and not exists (
      select 1 from group_day_steps f where f.group_id = gid and f.day = s.day and f.user_id = s.user_id
    )
$$;

-- Each finished day's places (1 = gold) before `before_day`: frozen ones, then live ones for days
-- that aren't frozen yet, worked out as before (only those who walked, from the day they joined).
create or replace function public.group_day_places(gid uuid, before_day date)
returns table (user_id uuid, day date, place integer)
language sql stable security invoker set search_path = public as $$
  select f.user_id, f.day, f.place
  from group_day_steps f
  where f.group_id = gid and f.place is not null and f.day < before_day
  union all
  select s.user_id, s.day, (rank() over (partition by s.day order by s.steps desc))::integer
  from daily_steps s
  join group_members m on m.group_id = gid and m.user_id = s.user_id
  where s.steps > 0 and s.day < before_day and s.day >= m.joined_at::date
    and not exists (select 1 from group_days_frozen z where z.group_id = gid and z.day = s.day)
$$;

revoke execute on function public.group_steps(uuid, date, date) from anon;
revoke execute on function public.group_day_places(uuid, date) from anon;

-- The day this migration ran: only days from then on are frozen, so older ones (including any that
-- were wiped and can still be re-imported) stay live, as before.
create table if not exists public.steady_days (
  only_row boolean primary key default true check (only_row),
  since date not null default current_date
);
insert into public.steady_days default values on conflict do nothing;
alter table public.steady_days enable row level security;

-- Freezes each group's days that are 2 days past being over for everyone, from `steady_days.since`
-- on. Catches up on any days missed while the job was paused.
create or replace function public.freeze_group_days()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  frozen integer;
begin
  with cutoff as (
    -- Days before this are 2 days past the group's first open day.
    select g.id as group_id,
           greatest(g.created_at::date, (select s.since from steady_days s)) as first_day,
           min((now() at time zone p.timezone)::date) - 2 as before_day
    from groups g
    join group_members gm on gm.group_id = g.id
    join profiles p on p.id = gm.user_id
    group by g.id
  ),
  due as (
    select c.group_id, d::date as day
    from cutoff c
    cross join generate_series(c.first_day, c.before_day - 1, interval '1 day') d
    where not exists (select 1 from group_days_frozen z where z.group_id = c.group_id and z.day = d::date)
  ),
  marked as (
    insert into group_days_frozen (group_id, day)
    select group_id, day from due
    on conflict do nothing
    returning group_id, day
  )
  insert into group_day_steps (group_id, day, user_id, steps, place)
  select mk.group_id, mk.day, gm.user_id, coalesce(s.steps, 0),
         -- Ranked with the walkers first, so a walker's place is the same as among walkers only.
         case when coalesce(s.steps, 0) > 0
              then (rank() over (partition by mk.group_id, mk.day order by coalesce(s.steps, 0) desc))::integer
         end
  from marked mk
  join group_members gm on gm.group_id = mk.group_id and gm.joined_at::date <= mk.day
  left join daily_steps s on s.user_id = gm.user_id and s.day = mk.day;
  get diagnostics frozen = row_count;
  return frozen;
end;
$$;
revoke execute on function public.freeze_group_days() from public, anon, authenticated;

-- Hourly. Scheduling under the same name again replaces the job.
select cron.schedule('freeze-group-days', '7 * * * *', $$select public.freeze_group_days()$$);

-- ---------- Reading frozen results ----------

-- As in 011, with steps from group_steps and medals from group_day_places.
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
    left join group_steps(gid, from_day, to_day) s on s.user_id = m.id
    group by m.id
  ),
  prev as (
    select m.id, coalesce(sum(s.steps), 0)::bigint as total
    from members m
    left join group_steps(gid, from_day - 1, to_day - 1) s on s.user_id = m.id
    group by m.id
  ),
  cur_ranked as (select id, total, active, rank() over (order by total desc)::int as r from cur),
  prev_ranked as (select id, rank() over (order by total desc)::int as r from prev),
  medals as (
    select d.user_id,
           count(*) filter (where d.place = 1)::int as gold,
           count(*) filter (where d.place = 2)::int as silver,
           count(*) filter (where d.place = 3)::int as bronze
    from group_day_places(gid, (select first_open_day from final)) d
    join members m on m.id = d.user_id
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

-- As in 005, with medals from group_day_places.
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
    select d.user_id, d.place as r
    from group_final gf
    cross join lateral group_day_places(gf.group_id, gf.first_open_day) d
    where d.user_id = uid
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
    (select count(*)::int from daily d where d.r = 1),
    (select count(*)::int from daily d where d.r = 2),
    (select count(*)::int from daily d where d.r = 3),
    (select count(*)::int from user_groups);
$$;

commit;
