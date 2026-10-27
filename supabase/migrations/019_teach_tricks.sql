-- Shop: teach a whole trick at once. Feeds `amount` treats in one go (the app works out how many the
-- next trick still needs), so it all happens or none of it does.
-- Run in the Supabase SQL editor after 018. Older builds don't call it.

begin;

-- Returns how many treats the pet has eaten now, or null if there weren't enough to give.
create function public.feed_pet_many(amount integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  eaten integer;
begin
  -- The dearest trick takes 100 (src/lib/world/tricks.ts).
  if amount is null or amount < 1 or amount > 100 then
    return null;
  end if;
  update worlds w set treats_fed = w.treats_fed + amount
  where w.user_id = auth.uid()
    and w.treats_fed + w.treats_spent + amount <= (select t.earned from pet_treats(auth.uid()) t)
  returning w.treats_fed into eaten;
  return eaten;
end;
$$;

revoke execute on function public.feed_pet_many(integer) from public, anon;
grant execute on function public.feed_pet_many(integer) to authenticated;

commit;
