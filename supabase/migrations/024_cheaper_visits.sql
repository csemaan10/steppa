-- Visits to friends: cheaper, and one outing a day.
--
-- A visit costs 10 treats rather than 20, and the pet sends a postcard home from it (drawn by the app
-- from pet_visits, so there's nothing to store for it).
--
-- One outing a day: on any day a pet goes on trips or round to a friend's, not both. A friend's pet
-- being away on a trip doesn't stop a visit (yours goes and finds it wherever it went), and having a
-- friend's pet over doesn't keep yours at home.
--
-- Run in the Supabase SQL editor after 023. Older builds keep working: to them, a visit or a trip
-- refused for having been out already reads as being short of treats.

begin;

update public.shop_items set treats = 10 where item = 'visit';

-- As in 021, but not on a day it has been on a trip.
create or replace function public.visit_mate(mate uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  today date;
  tz text;
begin
  if mate = auth.uid() or not shares_group_with(mate) or not exists (select 1 from worlds w where w.user_id = mate) then
    raise exception 'You can only visit a group mate''s pet';
  end if;
  select (now() at time zone p.timezone)::date, p.timezone into today, tz from profiles p where p.id = auth.uid();
  perform 1 from worlds w where w.user_id = auth.uid() for update;
  if exists (select 1 from pet_visits d where d.guest = auth.uid() and d.day = today)
    or exists (select 1 from pet_adventures a where a.user_id = auth.uid() and (a.created_at at time zone tz)::date = today) then
    return false;
  end if;
  if not spend_treats((select s.treats from shop_items s where s.item = 'visit')) then
    return false;
  end if;
  insert into pet_visits (guest, host, day) values (auth.uid(), mate, today);
  return true;
end;
$$;

-- As in 018, but not on a day it has been round at a friend's.
create or replace function public.go_on_adventure(destination text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  today date;
begin
  select (now() at time zone p.timezone)::date into today from profiles p where p.id = auth.uid();
  perform 1 from worlds w where w.user_id = auth.uid() for update;
  if exists (select 1 from pet_visits d where d.guest = auth.uid() and d.day = today) then
    return false;
  end if;
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

commit;
