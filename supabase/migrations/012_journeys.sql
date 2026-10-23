-- Solo journeys: walk a real route (Toronto → Ottawa, the Camino, …) with the steps you take
-- after starting. Routes and their postcards live in the app (src/lib/journeys.ts); this table
-- only records who is on which route, since when, and which postcards they've seen.
-- Run in the Supabase SQL editor after 011. Safe for older builds: they don't read this table.

begin;

create table public.journeys (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  route text not null check (route ~ '^[a-z0-9-]{1,40}$'),
  started_on date not null,
  completed_on date,
  postcards_seen smallint not null default 0 check (postcards_seen between 0 and 100),
  created_at timestamptz not null default now(),
  check (completed_on is null or completed_on >= started_on)
);

-- One journey in progress at a time; finished ones stay as history.
create unique index journeys_one_active on public.journeys (user_id) where completed_on is null;
create index journeys_user_idx on public.journeys (user_id, id desc);

alter table public.journeys enable row level security;

create policy "journeys_select_own" on public.journeys
  for select to authenticated using (user_id = auth.uid());
-- Start "today" (± a day for time zones), so old steps can't be counted by back-dating.
create policy "journeys_insert_own" on public.journeys
  for insert to authenticated
  with check (user_id = auth.uid() and started_on between current_date - 1 and current_date + 1);
create policy "journeys_update_own" on public.journeys
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "journeys_delete_own" on public.journeys
  for delete to authenticated using (user_id = auth.uid());

-- Only finishing and postcard progress can change. Supabase's default privileges grant
-- table-wide UPDATE, so revoke that before the column grant (see 011).
grant select, insert, delete on public.journeys to authenticated;
revoke update on public.journeys from authenticated, anon;
grant update (completed_on, postcards_seen) on public.journeys to authenticated;

commit;
