-- Two changes to 021 and 022:
--
-- A treat per 1,500 steps: walking paid one per 2,000. pet_treats works treats out from every step
-- since the pet's treats started, so the new rate counts for steps already walked too.
--
-- The passport is the pet's alone: only the places its trips go to (pet_adventures, 018) stamp it,
-- not your walking journeys. The walking stamps and the stop distances they were worked out from
-- go, stamp_passport() gives way to claim_keepsakes(), and a keepsake that walking handed out is
-- taken back (and out of the yard, if it's there).
--
-- Run in the Supabase SQL editor after 022. Older builds keep working: to them, stamp_passport()
-- and passport_stamps being gone just means no stamps from walking.

begin;

-- ---------- A treat per 1,500 steps ----------

-- As in 021, at the new rate. Must match STEPS_PER_TREAT in src/lib/api.ts.
create or replace function public.pet_treats(uid uuid default null)
returns table (earned integer, fed integer, spent integer, to_next integer)
language sql stable security invoker set search_path = public as $$
  select (5 + t.steps / 1500 + w.treats_received + b.treats)::integer, w.treats_fed, w.treats_spent,
    (1500 - t.steps % 1500)::integer
  from worlds w
  cross join lateral (
    select coalesce(sum(s.steps), 0)::bigint as steps
    from daily_steps s
    where s.user_id = w.user_id and s.day >= coalesce(w.treats_from, w.started_on)
  ) t
  cross join lateral (
    select coalesce(sum(tb.treats), 0)::bigint as treats
    from treat_bonuses tb
    where tb.user_id = w.user_id
  ) b
  where w.user_id = coalesce(uid, auth.uid())
$$;

-- ---------- The pet's passport ----------

-- A keepsake whose page the pet's trips haven't filled came from walking: it goes, and so does
-- the yard's pick of it.
with unearned as (
  select p.user_id, p.item
  from pet_purchases p
  join passport_countries c on c.souvenir = p.item
  where exists (
    select 1
    from passport_places pp
    where pp.country = c.country
      and not exists (select 1 from pet_adventures a where a.user_id = p.user_id and a.place = pp.place)
  )
), cleared as (
  update worlds w set picks = w.picks #- '{pet,keepsake}'
  from unearned u
  where w.user_id = u.user_id and w.picks -> 'pet' ->> 'keepsake' = u.item
)
delete from pet_purchases p
using unearned u
where p.user_id = u.user_id and p.item = u.item;

drop function public.stamp_passport();
drop table public.passport_stamps;
drop table public.journey_stops;

-- Gives you the keepsake for every page your pet's trips have filled, and returns the new ones.
create function public.claim_keepsakes()
returns setof text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  return query
  insert into pet_purchases (user_id, item)
  select me, c.souvenir
  from passport_countries c
  where not exists (
    select 1
    from passport_places pp
    where pp.country = c.country
      and not exists (select 1 from pet_adventures a where a.user_id = me and a.place = pp.place)
  )
  on conflict (user_id, item) do nothing
  returning item;
end;
$$;

revoke execute on function public.claim_keepsakes() from public, anon;
grant execute on function public.claim_keepsakes() to authenticated;

commit;
