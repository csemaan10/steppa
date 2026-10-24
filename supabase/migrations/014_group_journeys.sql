-- Group journeys: a whole group walks one long route together (Trans-Canada, Route 66, the Great
-- Wall), moved along by everyone's steps added up. Routes live in the app (GROUP_ROUTES in
-- src/lib/journeys.ts); this table records which route a group is on and since when.
-- Run in the Supabase SQL editor after 013. Safe for older builds: they don't read this table.

begin;

create table public.group_journeys (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  route text not null check (route ~ '^[a-z0-9-]{1,40}$'),
  started_on date not null,
  started_by uuid default auth.uid() references public.profiles (id) on delete set null,
  completed_on date,
  created_at timestamptz not null default now(),
  check (completed_on is null or completed_on >= started_on)
);

-- One journey in progress per group; finished ones stay as history.
create unique index group_journeys_one_active on public.group_journeys (group_id) where completed_on is null;
create index group_journeys_group_idx on public.group_journeys (group_id, id desc);

alter table public.group_journeys enable row level security;

create policy "group_journeys_select_member" on public.group_journeys
  for select to authenticated using (public.is_group_member(group_id));
-- The owner starts one "today" (± a day for time zones), so old steps can't be counted by back-dating.
create policy "group_journeys_insert_owner" on public.group_journeys
  for insert to authenticated
  with check (
    started_by = auth.uid()
    and started_on between current_date - 1 and current_date + 1
    and exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
-- Any member's phone can mark it finished once the group's steps cover the route.
create policy "group_journeys_update_member" on public.group_journeys
  for update to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
-- Only the owner can give up on one.
create policy "group_journeys_delete_owner" on public.group_journeys
  for delete to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

-- Only finishing can change. Supabase's default privileges grant table-wide UPDATE, so revoke that
-- before the column grant (see 011).
grant select, insert, delete on public.group_journeys to authenticated;
revoke update on public.group_journeys from authenticated, anon;
grant update (completed_on) on public.group_journeys to authenticated;

-- Each current member's steps toward a group journey: from the day it started (or the day they
-- joined, if later) up to the day it finished, if it has. Security invoker, so it only sees what
-- the caller may (members see their group mates' steps).
create or replace function public.group_journey_steps(gid uuid, from_day date, to_day date default null)
returns table (user_id uuid, steps bigint)
language sql stable security invoker set search_path = public as $$
  select m.user_id, coalesce(sum(s.steps), 0)::bigint
  from group_members m
  left join daily_steps s
    on s.user_id = m.user_id
   and s.day >= greatest(from_day, m.joined_at::date)
   and (to_day is null or s.day <= to_day)
  where m.group_id = gid
  group by m.user_id
$$;
grant execute on function public.group_journey_steps(uuid, date, date) to authenticated;

commit;
