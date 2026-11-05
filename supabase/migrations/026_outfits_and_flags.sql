-- Outfits, hats and flags for the shop: the Lenin outfit and cap, a tuxedo, a raincoat, a pirate coat
-- and hat, a tutu, and eight flags for a pole in the yard. How they look is in src/lib/world/pet.ts.
--
-- Run in the Supabase SQL editor (after 025 or on its own). The app only shows things that have a
-- price here.

begin;

insert into public.shop_items (item, kind, treats, months) values
  ('lenin-suit', 'keep', 50, null),
  ('lenin-cap', 'keep', 20, null),
  ('tuxedo', 'keep', 45, null),
  ('raincoat', 'keep', 35, null),
  ('pirate-coat', 'keep', 45, null),
  ('tricorn', 'keep', 25, null),
  ('tutu', 'keep', 40, null),
  ('flag-ussr', 'keep', 30, null),
  ('flag-pirate', 'keep', 30, null),
  ('flag-rainbow', 'keep', 30, null),
  ('flag-canada', 'keep', 30, null),
  ('flag-uk', 'keep', 30, null),
  ('flag-usa', 'keep', 30, null),
  ('flag-italy', 'keep', 30, null),
  ('flag-china', 'keep', 30, null)
on conflict (item) do nothing;

commit;
