-- Worlds: a pet, house, aquarium, garden or city of your own that grows with every step you take
-- after choosing it. What each kind looks like and unlocks lives in the app (src/lib/world); this
-- table only records which kind someone grows, since when, their choices, and the milestones
-- they've already celebrated. Only you can see your own.
-- Run in the Supabase SQL editor after 014. Safe for older builds: they don't read this table.

begin;

create table public.worlds (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('pet', 'house', 'aquarium', 'garden', 'city')),
  -- Every kind's choices, so switching back finds them as you left them: {"pet": {"species": "fox", ...}, ...}.
  picks jsonb not null default '{}'::jsonb check (jsonb_typeof(picks) = 'object' and pg_column_size(picks) < 16384),
  started_on date not null,
  -- How many milestones have been celebrated (levels 0 up to this one, exclusive).
  celebrated smallint not null default 0 check (celebrated between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.worlds enable row level security;

create policy "worlds_select_own" on public.worlds
  for select to authenticated using (user_id = auth.uid());
-- Start "today" (± a day for time zones), so old steps can't be counted by back-dating.
create policy "worlds_insert_own" on public.worlds
  for insert to authenticated
  with check (user_id = auth.uid() and started_on between current_date - 1 and current_date + 1);
create policy "worlds_update_own" on public.worlds
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The start date never changes. Supabase's default privileges grant table-wide UPDATE, so revoke
-- that before the column grant (see 011).
grant select, insert on public.worlds to authenticated;
revoke update on public.worlds from authenticated, anon;
grant update (kind, picks, celebrated) on public.worlds to authenticated;

-- Your steps since you started your world, added up in the database so even years of days come
-- back as one number. Security invoker: it only sees your own world and steps.
create or replace function public.world_steps()
returns bigint
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(s.steps), 0)::bigint
  from worlds w
  join daily_steps s on s.user_id = w.user_id and s.day >= w.started_on
  where w.user_id = auth.uid()
$$;

revoke execute on function public.world_steps() from public, anon;
grant execute on function public.world_steps() to authenticated;

commit;
