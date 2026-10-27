-- Treats for pets: walking earns them (a few to start, then one per 2,000 steps), feeding them
-- teaches your pet tricks, and saving up 10 sends it on an adventure to a place from the journey
-- routes. Which tricks and places there are lives in the app (src/lib/world/tricks.ts,
-- src/lib/pet-adventures.ts); this counts the treats and records where each pet has been.
-- Treats only change through feed_pet and go_on_adventure, which check there's one to spend.
-- Run in the Supabase SQL editor after 017. Safe for older builds: they don't read any of it.

begin;

alter table public.worlds
  -- Steps count toward treats from this day; null means from the day the pet was adopted.
  add column treats_from date,
  -- Treats eaten (each one trains the next trick) and treats spent on adventures.
  add column treats_fed integer not null default 0 check (treats_fed >= 0),
  add column treats_spent integer not null default 0 check (treats_spent >= 0);

-- Pets adopted before treats existed start counting today, so nobody gets months of treats at once.
update public.worlds w set treats_from = (now() at time zone p.timezone)::date
from public.profiles p
where p.id = w.user_id;

-- Each adventure: where it went (a place key from the app) and when.
create table public.pet_adventures (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  place text not null check (place ~ '^[a-z0-9-]{1,60}$'),
  created_at timestamptz not null default now()
);

create index pet_adventures_user_idx on public.pet_adventures (user_id, id);

-- Seen by the same people who can see the pet (see 016). Only go_on_adventure adds them.
alter table public.pet_adventures enable row level security;
create policy "pet_adventures_select_mates" on public.pet_adventures
  for select to authenticated using (user_id = auth.uid() or public.shares_group_with(user_id));
revoke insert, update, delete on public.pet_adventures from authenticated, anon;
grant select on public.pet_adventures to authenticated;

-- Treats earned so far, eaten and spent, and steps to the next one, for whose pet (yours if left
-- out). Security invoker, so it only adds up steps the caller may see, like world_steps.
create function public.pet_treats(uid uuid default null)
returns table (earned integer, fed integer, spent integer, to_next integer)
language sql stable security invoker set search_path = public as $$
  select (5 + t.steps / 2000)::integer, w.treats_fed, w.treats_spent, (2000 - t.steps % 2000)::integer
  from worlds w
  cross join lateral (
    select coalesce(sum(s.steps), 0)::bigint as steps
    from daily_steps s
    where s.user_id = w.user_id and s.day >= coalesce(w.treats_from, w.started_on)
  ) t
  where w.user_id = coalesce(uid, auth.uid())
$$;

-- Gives your pet a treat if you have one. Returns how many it has eaten now, or null if none was left.
create function public.feed_pet()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  eaten integer;
begin
  update worlds w set treats_fed = w.treats_fed + 1
  where w.user_id = auth.uid()
    and w.treats_fed + w.treats_spent < (select t.earned from pet_treats(auth.uid()) t)
  returning w.treats_fed into eaten;
  return eaten;
end;
$$;

-- Spends 10 treats on an adventure to `destination`. False if there weren't enough.
create function public.go_on_adventure(destination text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update worlds w set treats_spent = w.treats_spent + 10
  where w.user_id = auth.uid()
    and w.treats_fed + w.treats_spent + 10 <= (select t.earned from pet_treats(auth.uid()) t);
  if not found then
    return false;
  end if;
  insert into pet_adventures (user_id, place) values (auth.uid(), destination);
  return true;
end;
$$;

revoke execute on function public.pet_treats(uuid) from public, anon;
revoke execute on function public.feed_pet() from public, anon;
revoke execute on function public.go_on_adventure(text) from public, anon;
grant execute on function public.pet_treats(uuid) to authenticated;
grant execute on function public.feed_pet() to authenticated;
grant execute on function public.go_on_adventure(text) to authenticated;

commit;
