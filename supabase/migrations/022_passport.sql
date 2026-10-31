-- Passport: a page for each country the journey routes pass through, with a stamp for every place
-- you've walked to on a journey (yours or your group's) and every place your pet has been on an
-- adventure. Filling a page brings home that country's keepsake for your pet's yard (a souvenir, like
-- the hats a first trip brings, but earned here), which is then yours to keep like anything from the
-- shop (pet_purchases, 021). stamp_passport() records new stamps and hands out keepsakes; the app
-- calls it when the Pet tab or the passport opens.
-- The places, their countries and how far along its route each stop is must match the app
-- (src/lib/journeys.ts, and placeKey in src/lib/pet-adventures.ts).
-- Run in the Supabase SQL editor after 021. Safe for older builds: they don't read any of it.

begin;

-- Every place, and the country whose page it's on.
create table public.passport_places (
  place text primary key check (place ~ '^[a-z0-9-]{1,60}$'),
  country text not null check (country in ('gb', 'ca', 'es', 'it', 'us', 'cn'))
);
insert into public.passport_places (place, country) values
  ('wallsend', 'gb'), ('newcastle', 'gb'), ('heddon-on-the-wall', 'gb'), ('chesters', 'gb'),
  ('housesteads', 'gb'), ('birdoswald', 'gb'), ('carlisle', 'gb'), ('bowness-on-solway', 'gb'),
  ('toronto', 'ca'), ('cobourg', 'ca'), ('belleville', 'ca'), ('kingston', 'ca'),
  ('jones-falls', 'ca'), ('merrickville', 'ca'), ('ottawa', 'ca'), ('halifax', 'ca'),
  ('quebec-city', 'ca'), ('montreal', 'ca'), ('wawa', 'ca'), ('thunder-bay', 'ca'),
  ('winnipeg', 'ca'), ('regina', 'ca'), ('calgary', 'ca'), ('banff', 'ca'),
  ('rogers-pass', 'ca'), ('vancouver', 'ca'), ('saint-jean-pied-de-port', 'es'), ('roncesvalles', 'es'),
  ('pamplona', 'es'), ('logrono', 'es'), ('burgos', 'es'), ('leon', 'es'),
  ('cruz-de-ferro', 'es'), ('sarria', 'es'), ('santiago-de-compostela', 'es'), ('venice', 'it'),
  ('padua', 'it'), ('bologna', 'it'), ('florence', 'it'), ('siena', 'it'),
  ('rome', 'it'), ('naples', 'it'), ('pompeii', 'it'), ('amalfi', 'it'),
  ('chicago', 'us'), ('springfield', 'us'), ('st-louis', 'us'), ('tulsa', 'us'),
  ('amarillo', 'us'), ('albuquerque', 'us'), ('holbrook', 'us'), ('williams', 'us'),
  ('barstow', 'us'), ('santa-monica', 'us'), ('old-dragons-head', 'cn'), ('jinshanling', 'cn'),
  ('mutianyu', 'cn'), ('badaling', 'cn'), ('datong', 'cn'), ('laoniuwan', 'cn'),
  ('yulin', 'cn'), ('yinchuan', 'cn'), ('wuwei', 'cn'), ('zhangye', 'cn'),
  ('jiayuguan', 'cn');

-- How far along its route each stop is (km). Ottawa is on two routes.
create table public.journey_stops (
  route text not null references public.journey_routes (key),
  place text not null references public.passport_places (place),
  km numeric not null check (km >= 0),
  primary key (route, place)
);
insert into public.journey_stops (route, place, km) values
  ('hadrians-wall', 'wallsend', 0), ('hadrians-wall', 'newcastle', 6), ('hadrians-wall', 'heddon-on-the-wall', 24),
  ('hadrians-wall', 'chesters', 45), ('hadrians-wall', 'housesteads', 59), ('hadrians-wall', 'birdoswald', 78),
  ('hadrians-wall', 'carlisle', 106), ('hadrians-wall', 'bowness-on-solway', 135), ('toronto-ottawa', 'toronto', 0),
  ('toronto-ottawa', 'cobourg', 115), ('toronto-ottawa', 'belleville', 185), ('toronto-ottawa', 'kingston', 260),
  ('toronto-ottawa', 'jones-falls', 310), ('toronto-ottawa', 'merrickville', 395), ('toronto-ottawa', 'ottawa', 462),
  ('camino', 'saint-jean-pied-de-port', 0), ('camino', 'roncesvalles', 25), ('camino', 'pamplona', 68),
  ('camino', 'logrono', 160), ('camino', 'burgos', 280), ('camino', 'leon', 460),
  ('camino', 'cruz-de-ferro', 535), ('camino', 'sarria', 665), ('camino', 'santiago-de-compostela', 780),
  ('italy', 'venice', 0), ('italy', 'padua', 40), ('italy', 'bologna', 155),
  ('italy', 'florence', 260), ('italy', 'siena', 335), ('italy', 'rome', 565),
  ('italy', 'naples', 790), ('italy', 'pompeii', 815), ('italy', 'amalfi', 850),
  ('trans-canada', 'halifax', 0), ('trans-canada', 'quebec-city', 1010), ('trans-canada', 'montreal', 1260),
  ('trans-canada', 'ottawa', 1460), ('trans-canada', 'wawa', 2475), ('trans-canada', 'thunder-bay', 2960),
  ('trans-canada', 'winnipeg', 3660), ('trans-canada', 'regina', 4230), ('trans-canada', 'calgary', 4990),
  ('trans-canada', 'banff', 5120), ('trans-canada', 'rogers-pass', 5330), ('trans-canada', 'vancouver', 5970),
  ('route-66', 'chicago', 0), ('route-66', 'springfield', 320), ('route-66', 'st-louis', 485),
  ('route-66', 'tulsa', 1175), ('route-66', 'amarillo', 1840), ('route-66', 'albuquerque', 2330),
  ('route-66', 'holbrook', 2940), ('route-66', 'williams', 3140), ('route-66', 'barstow', 3680),
  ('route-66', 'santa-monica', 3940), ('great-wall', 'old-dragons-head', 0), ('great-wall', 'jinshanling', 330),
  ('great-wall', 'mutianyu', 440), ('great-wall', 'badaling', 500), ('great-wall', 'datong', 830),
  ('great-wall', 'laoniuwan', 1080), ('great-wall', 'yulin', 1390), ('great-wall', 'yinchuan', 1830),
  ('great-wall', 'wuwei', 2250), ('great-wall', 'zhangye', 2520), ('great-wall', 'jiayuguan', 2760);

-- Keepsakes aren't for sale: they come from filling a page. Things you keep, with no price.
alter table public.shop_items drop constraint shop_items_kind_check;
alter table public.shop_items alter column treats drop not null;
alter table public.shop_items
  add constraint shop_items_kind_check check (kind in ('keep', 'visit', 'souvenir')),
  add constraint shop_items_souvenir_price check ((kind = 'souvenir') = (treats is null));
insert into public.shop_items (item, kind, treats, months) values
  ('phone-box', 'souvenir', null, null),
  ('inukshuk', 'souvenir', null, null),
  ('shell-marker', 'souvenir', null, null),
  ('gelato-cart', 'souvenir', null, null),
  ('route-sign', 'souvenir', null, null),
  ('lanterns', 'souvenir', null, null);

-- Each country's keepsake.
create table public.passport_countries (
  country text primary key,
  souvenir text not null unique references public.shop_items (item)
);
insert into public.passport_countries (country, souvenir) values
  ('gb', 'phone-box'), ('ca', 'inukshuk'), ('es', 'shell-marker'),
  ('it', 'gelato-cart'), ('us', 'route-sign'), ('cn', 'lanterns');

alter table public.passport_places enable row level security;
alter table public.journey_stops enable row level security;
alter table public.passport_countries enable row level security;
revoke all on public.passport_places, public.journey_stops, public.passport_countries from authenticated, anon;

-- Places you've walked to, and the day you got there. (Your pet's are its adventures.) Seen by the
-- same people who can see your pet (see 016).
create table public.passport_stamps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  place text not null references public.passport_places (place),
  stamped_on date not null,
  primary key (user_id, place)
);

alter table public.passport_stamps enable row level security;
create policy "passport_stamps_select_mates" on public.passport_stamps
  for select to authenticated using (user_id = auth.uid() or public.shares_group_with(user_id));
revoke insert, update, delete on public.passport_stamps from authenticated, anon;
grant select on public.passport_stamps to authenticated;

-- Stamps every stop you've reached on your journeys, and on your groups' while you've been in them
-- (with everyone's steps added up), dated the day the steps got there (about 1,300 to the km). Then
-- gives you the keepsake for every page that's now full, counting your pet's adventures too, and
-- returns the new ones.
create function public.stamp_passport()
returns setof text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date;
begin
  select (now() at time zone p.timezone)::date into today from profiles p where p.id = me;
  if today is null then
    return;
  end if;

  insert into passport_stamps (user_id, place, stamped_on)
  select me, reached.place, min(reached.day)
  from (
    select js.place, w.day
    from (
      select j.route, s.day, sum(s.steps) over (partition by j.id order by s.day) as walked
      from journeys j
      join daily_steps s on s.user_id = j.user_id and s.day between j.started_on and coalesce(j.completed_on, today)
      where j.user_id = me
    ) w
    join journey_stops js on js.route = w.route and w.walked >= js.km * 1300
    union all
    select js.place, w.day
    from (
      select d.route, d.day, sum(d.steps) over (partition by d.id order by d.day) as walked
      from (
        select g.id, g.route, s.day, sum(s.steps) as steps
        from group_journeys g
        join group_members mine on mine.group_id = g.group_id and mine.user_id = me
        join group_members gm on gm.group_id = g.group_id
        join daily_steps s
          on s.user_id = gm.user_id
         and s.day >= greatest(g.started_on, gm.joined_at::date)
         and s.day <= coalesce(g.completed_on, today)
        where mine.joined_at::date <= coalesce(g.completed_on, today)
        group by g.id, g.route, s.day
      ) d
    ) w
    join journey_stops js on js.route = w.route and w.walked >= js.km * 1300
  ) reached
  group by reached.place
  on conflict (user_id, place) do nothing;

  return query
  insert into pet_purchases (user_id, item)
  select me, c.souvenir
  from passport_countries c
  where not exists (
    select 1
    from passport_places pp
    where pp.country = c.country
      and not exists (select 1 from passport_stamps st where st.user_id = me and st.place = pp.place)
      and not exists (select 1 from pet_adventures a where a.user_id = me and a.place = pp.place)
  )
  on conflict (user_id, item) do nothing
  returning item;
end;
$$;

revoke execute on function public.stamp_passport() from public, anon;
grant execute on function public.stamp_passport() to authenticated;

commit;
