-- Playdates: give a group mate's pet one of your treats, once a day for each friend. It comes out
-- of your treats and adds to theirs, and they find out who it was from next time they open the app.
-- Run in the Supabase SQL editor after 019. Safe for older builds: pet_treats returns the same
-- columns, and they never call give_treat.

begin;

alter table public.worlds
  -- Treats friends have given this pet; they count toward what it has earned.
  add column treats_received integer not null default 0 check (treats_received >= 0);

-- worlds allows inserting every column (015), so a new pet can't start out with treats "received".
create function public.worlds_no_received_treats()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.treats_received := 0;
  return new;
end;
$$;

create trigger worlds_no_received_treats
  before insert on public.worlds
  for each row execute function public.worlds_no_received_treats();

-- Each treat given: from whom, to whom, and when.
create table public.pet_gifts (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index pet_gifts_to_idx on public.pet_gifts (to_user, id);
create index pet_gifts_from_idx on public.pet_gifts (from_user, to_user, created_at);

-- Seen by the giver and the receiver. Only give_treat adds them.
alter table public.pet_gifts enable row level security;
create policy "pet_gifts_select_own" on public.pet_gifts
  for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
revoke insert, update, delete on public.pet_gifts from authenticated, anon;
grant select on public.pet_gifts to authenticated;

-- As in 018, plus the treats friends have given.
create or replace function public.pet_treats(uid uuid default null)
returns table (earned integer, fed integer, spent integer, to_next integer)
language sql stable security invoker set search_path = public as $$
  select (5 + t.steps / 2000 + w.treats_received)::integer, w.treats_fed, w.treats_spent, (2000 - t.steps % 2000)::integer
  from worlds w
  cross join lateral (
    select coalesce(sum(s.steps), 0)::bigint as steps
    from daily_steps s
    where s.user_id = w.user_id and s.day >= coalesce(w.treats_from, w.started_on)
  ) t
  where w.user_id = coalesce(uid, auth.uid())
$$;

-- Gives `friend`'s pet one of your treats. Returns 'given', or why not: 'not-friends' (no shared
-- group), 'no-pet' (they haven't adopted one), 'already' (you've given them one today, by your
-- clock) or 'no-treats' (none to spare).
create function public.give_treat(friend uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  today date;
begin
  if friend is null or friend = auth.uid() or not public.shares_group_with(friend) then
    return 'not-friends';
  end if;
  if not exists (select 1 from worlds where user_id = friend) then
    return 'no-pet';
  end if;
  -- One at a time per pair, so two taps at once can't both slip past the once-a-day check.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || friend::text));
  select (now() at time zone p.timezone)::date into today from profiles p where p.id = auth.uid();
  if exists (
    select 1
    from pet_gifts g
    join profiles p on p.id = g.from_user
    where g.from_user = auth.uid() and g.to_user = friend and (g.created_at at time zone p.timezone)::date = today
  ) then
    return 'already';
  end if;
  update worlds w set treats_spent = w.treats_spent + 1
  where w.user_id = auth.uid()
    and w.treats_fed + w.treats_spent + 1 <= (select t.earned from pet_treats(auth.uid()) t);
  if not found then
    return 'no-treats';
  end if;
  update worlds set treats_received = treats_received + 1 where user_id = friend;
  insert into pet_gifts (from_user, to_user) values (auth.uid(), friend);
  return 'given';
end;
$$;

revoke execute on function public.give_treat(uuid) from public, anon;
grant execute on function public.give_treat(uuid) to authenticated;

commit;
