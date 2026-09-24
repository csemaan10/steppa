-- Streaks, daily medals, rank change, and group chat.
-- Run this in the Supabase SQL editor after schema.sql.

-- ---------- Leaderboard with stats ----------

drop function if exists public.group_leaderboard(uuid, date, date);

-- Security invoker: RLS on daily_steps still limits data to group mates.
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
    select p.id, p.username, p.display_name, p.avatar_color, p.daily_goal
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
  -- Same-length window shifted back one day, for the "since yesterday" arrow.
  prev as (
    select m.id, coalesce(sum(s.steps), 0)::bigint as total
    from members m
    left join daily_steps s on s.user_id = m.id and s.day between from_day - 1 and to_day - 1
    group by m.id
  ),
  cur_ranked as (select id, total, rank() over (order by total desc)::int as r from cur),
  prev_ranked as (select id, rank() over (order by total desc)::int as r from prev),
  -- Daily podium for completed days since the group was created.
  daily as (
    select s.user_id, rank() over (partition by s.day order by s.steps desc) as r
    from daily_steps s
    join members m on m.id = s.user_id
    where s.steps > 0
      and s.day < current_date
      and s.day >= (select g.created_at::date from groups g where g.id = gid)
  ),
  medals as (
    select d.user_id,
           count(*) filter (where d.r = 1)::int as gold,
           count(*) filter (where d.r = 2)::int as silver,
           count(*) filter (where d.r = 3)::int as bronze
    from daily d
    group by d.user_id
  ),
  -- Consecutive goal-hit days (gaps-and-islands), counting only a run that reaches today or yesterday.
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

revoke execute on function public.group_leaderboard(uuid, date, date) from anon;

-- ---------- Group chat ----------

create table public.group_messages (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index group_messages_group_idx on public.group_messages (group_id, created_at desc);

alter table public.group_messages enable row level security;

create policy "messages_select_member" on public.group_messages
  for select to authenticated using (public.is_group_member(group_id));
create policy "messages_insert_member" on public.group_messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));
create policy "messages_delete_own" on public.group_messages
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.group_messages to authenticated;

-- Live updates in the app.
alter publication supabase_realtime add table public.group_messages;
