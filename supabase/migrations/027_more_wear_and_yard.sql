-- More for the shop: dresses and other outfits (30–50 treats), hats and pearls (15–25, cheaper than
-- any outfit; 026's come down to these prices here too), things for the yard (a swing set, a picnic,
-- a fountain, a ball pit, a castle, an igloo, a heart bed, a piñata, paper lanterns) and four more
-- flags. How they look is in src/lib/world/pet.ts.
--
-- Run in the Supabase SQL editor after 026 (or instead of it: this adds 026's outfits too). The app
-- only shows things that have a price here.

begin;

insert into public.shop_items (item, kind, treats, months) values
  -- Outfits: 30–50 treats.
  ('lenin-suit', 'keep', 50, null),
  ('tuxedo', 'keep', 45, null),
  ('raincoat', 'keep', 35, null),
  ('pirate-coat', 'keep', 45, null),
  ('tutu', 'keep', 40, null),
  ('sundress', 'keep', 40, null),
  ('gown', 'keep', 50, null),
  ('fairy', 'keep', 50, null),
  ('cardigan', 'keep', 35, null),
  ('overalls', 'keep', 35, null),
  ('jersey', 'keep', 30, null),
  -- Hats and pearls: 15–25, cheaper than any outfit.
  ('lenin-cap', 'keep', 20, null),
  ('tricorn', 'keep', 25, null),
  ('tiara', 'keep', 25, null),
  ('hairbow', 'keep', 15, null),
  ('sunhat', 'keep', 20, null),
  ('pearls', 'keep', 20, null),
  -- For the yard.
  ('swing', 'keep', 90, null),
  ('picnic', 'keep', 40, null),
  ('fountain', 'keep', 110, null),
  ('ballpit', 'keep', 70, null),
  ('castle', 'keep', 200, null),
  ('igloo', 'keep', 120, null),
  ('heartbed', 'keep', 35, null),
  ('pinata', 'keep', 50, null),
  ('paper-lanterns', 'keep', 45, null),
  -- Flags.
  ('flag-bulgaria', 'keep', 30, null),
  ('flag-lebanon', 'keep', 30, null),
  ('flag-japan', 'keep', 30, null),
  ('flag-bangladesh', 'keep', 30, null),
  -- The rest of 026's flags, in case 026 wasn't run.
  ('flag-ussr', 'keep', 30, null),
  ('flag-pirate', 'keep', 30, null),
  ('flag-rainbow', 'keep', 30, null),
  ('flag-canada', 'keep', 30, null),
  ('flag-uk', 'keep', 30, null),
  ('flag-usa', 'keep', 30, null),
  ('flag-italy', 'keep', 30, null),
  ('flag-china', 'keep', 30, null)
on conflict (item) do update set treats = excluded.treats;

commit;
