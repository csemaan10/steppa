-- More things for the shop: a party shelf (a disco ball, bunting, fairy lights) and, for the yard, a
-- trampoline, a play tent and a beanbag bed. How they look is in src/lib/world/pet.ts.
--
-- Run in the Supabase SQL editor after 024. The app only shows things that have a price here, so
-- they appear once this has run; older builds don't know them and leave them out.

begin;

insert into public.shop_items (item, kind, treats, months) values
  ('disco', 'keep', 120, null),
  ('bunting', 'keep', 35, null),
  ('fairy-lights', 'keep', 60, null),
  ('trampoline', 'keep', 70, null),
  ('tent', 'keep', 90, null),
  ('beanbag', 'keep', 30, null)
on conflict (item) do nothing;

commit;
