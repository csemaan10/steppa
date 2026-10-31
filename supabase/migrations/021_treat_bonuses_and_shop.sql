-- More ways to earn treats and more to spend them on.
--
-- Earning: on top of a treat per 2,000 steps (018) and treats from friends (020), the pet's
-- milestones, hitting your goal, streaks, the day's medals in your groups, finishing a journey and a
-- friend's pet coming to visit each pay a few. claim_treats() works them out from what's already in
-- the database and records each one once in treat_bonuses, which pet_treats adds to what you've
-- earned. Only rewards from the day treats started count (see 018).
--
-- Spending: a shop of things for the pet's yard (shop_items, with prices and the months seasonal
-- things are on sale), and visits: your pet spends the day in a group mate's yard. What each thing
-- looks like lives in the app (src/lib/shop.ts, src/lib/world/pet.ts).
--
-- Run in the Supabase SQL editor after 020. Safe for older builds: pet_treats keeps its arguments and
-- results, and they don't read the new tables.

begin;

-- ---------- Route lengths ----------

-- Each journey route's length in km, to check a finished journey's steps against: about 1,300 steps
-- to the kilometre. Must match totalKm in src/lib/journeys.ts.
create table public.journey_routes (
  key text primary key,
  km numeric not null check (km > 0)
);
insert into public.journey_routes values
  ('hadrians-wall', 135), ('toronto-ottawa', 462), ('camino', 780), ('italy', 850),
  ('trans-canada', 5970), ('route-66', 3940), ('great-wall', 2760);
alter table public.journey_routes enable row level security;
revoke all on public.journey_routes from authenticated, anon;

-- ---------- Bonus treats ----------

-- One row per reward, so each is paid once: `ref` says which (a day, a level, a journey), `detail`
-- what the app shows about it (the steps, the medal, the route).
create table public.treat_bonuses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('milestone', 'goal', 'streak', 'medal', 'journey', 'visit')),
  ref text not null,
  detail text,
  treats integer not null check (treats > 0),
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);

alter table public.treat_bonuses enable row level security;
create policy "treat_bonuses_select_own" on public.treat_bonuses
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.treat_bonuses from authenticated, anon;
grant select on public.treat_bonuses to authenticated;

-- ---------- The shop ----------

-- What's for sale and for how many treats. `kind` is how it's bought: 'keep' things are yours for
-- good (buy_item); a visit is used up (visit_mate).
-- `months` are when it's on sale (1–12, in the buyer's time zone); null is all year.
create table public.shop_items (
  item text primary key check (item ~ '^[a-z0-9-]{1,40}$'),
  kind text not null check (kind in ('keep', 'visit')),
  treats integer not null check (treats > 0),
  months smallint[]
);
insert into public.shop_items (item, kind, treats, months) values
  ('frisbee', 'keep', 30, null),
  ('rope', 'keep', 40, null),
  ('bubbles', 'keep', 50, null),
  ('cloudbed', 'keep', 25, null),
  ('flowerbed', 'keep', 30, null),
  ('pond', 'keep', 60, null),
  ('cottage', 'keep', 80, null),
  ('treehouse', 'keep', 150, null),
  ('hedgehog', 'keep', 250, null),
  ('pumpkins', 'keep', 40, '{9,10,11}'),
  ('festive-tree', 'keep', 40, '{12,1}'),
  ('tulips', 'keep', 40, '{2,3,4,5}'),
  ('sunflowers', 'keep', 40, '{6,7,8}'),
  ('visit', 'visit', 20, null);

alter table public.shop_items enable row level security;
create policy "shop_items_select" on public.shop_items for select to authenticated using (true);
revoke insert, update, delete on public.shop_items from authenticated, anon;
grant select on public.shop_items to authenticated;

-- Things bought for good. Seen by the same people who can see the pet (see 016).
create table public.pet_purchases (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item text not null references public.shop_items (item),
  created_at timestamptz not null default now(),
  primary key (user_id, item)
);

alter table public.pet_purchases enable row level security;
create policy "pet_purchases_select_mates" on public.pet_purchases
  for select to authenticated using (user_id = auth.uid() or public.shares_group_with(user_id));
revoke insert, update, delete on public.pet_purchases from authenticated, anon;
grant select on public.pet_purchases to authenticated;

-- ---------- Visits ----------

-- Your pet spends the day in a group mate's yard: `guest` sent theirs over (and paid), `day` is the
-- guest's day. One a day for each pet that goes visiting.
create table public.pet_visits (
  id bigint generated always as identity primary key,
  guest uuid not null references public.profiles (id) on delete cascade,
  host uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (guest, day),
  check (guest <> host)
);
create index pet_visits_host_idx on public.pet_visits (host, day);

alter table public.pet_visits enable row level security;
create policy "pet_visits_select_own" on public.pet_visits
  for select to authenticated using (guest = auth.uid() or host = auth.uid());
revoke insert, update, delete on public.pet_visits from authenticated, anon;
grant select on public.pet_visits to authenticated;

-- ---------- Counting treats ----------

-- As in 020 (walking and friends' treats), plus every bonus.
create or replace function public.pet_treats(uid uuid default null)
returns table (earned integer, fed integer, spent integer, to_next integer)
language sql stable security invoker set search_path = public as $$
  select (5 + t.steps / 2000 + w.treats_received + b.treats)::integer, w.treats_fed, w.treats_spent,
    (2000 - t.steps % 2000)::integer
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

-- Spends `cost` of your treats if you have them. Only for the functions below.
create function public.spend_treats(cost integer)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update worlds w set treats_spent = w.treats_spent + cost
  where w.user_id = auth.uid()
    and w.treats_fed + w.treats_spent + cost <= (select t.earned from pet_treats(auth.uid()) t);
  return found;
end;
$$;

-- ---------- Claiming bonuses ----------

-- Records every bonus you've earned and not been given yet, and returns the new ones.
create function public.claim_treats()
returns setof public.treat_bonuses
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  started date;
  since date;
  today date;
  -- Bonuses for your goal ask for at least 5,000 steps, however low it's set.
  goal integer;
  steps_before bigint;
  steps_now bigint;
begin
  select w.started_on, coalesce(w.treats_from, w.started_on) into started, since from worlds w where w.user_id = me;
  if since is null then
    return;
  end if;
  select (now() at time zone p.timezone)::date, greatest(p.daily_goal, 5000) into today, goal
  from profiles p where p.id = me;

  -- Pet milestones (the levels in src/lib/world/common.ts): 10 each, 25 when it grows into its
  -- next stage. Only ones reached since treats started.
  select coalesce(sum(s.steps) filter (where s.day < since), 0), coalesce(sum(s.steps), 0)
  into steps_before, steps_now
  from daily_steps s where s.user_id = me and s.day >= started;
  return query
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'milestone', l.level::text, l.steps::text, case when l.level in (3, 6, 10, 13, 17) then 25 else 10 end
  from unnest(array[
    10000, 25000, 50000, 100000, 175000, 250000, 375000, 500000, 750000, 1000000, 1500000,
    2000000, 3000000, 4000000, 5000000, 7500000, 10000000
  ]) with ordinality as l(steps, level)
  where l.steps > steps_before and l.steps <= steps_now
  on conflict (user_id, reason, ref) do nothing
  returning *;

  -- Your goal: 2 for each day you hit it.
  return query
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'goal', s.day::text, s.steps::text, 2
  from daily_steps s
  where s.user_id = me and s.day between since and today and s.steps >= goal
  on conflict (user_id, reason, ref) do nothing
  returning *;

  -- Streaks of goal days: 5 at 7 days, 15 at 30, 40 at 100 and every 100 after.
  -- Each streak earns its own, on the day it gets there.
  return query
  with days as (
    select s.day from daily_steps s where s.user_id = me and s.steps >= goal and s.day <= today
  ),
  runs as (
    select min(t.day) as began, count(*)::int as len
    from (select days.day, days.day - (row_number() over (order by days.day))::int as grp from days) t
    group by t.grp
  ),
  marks as (
    select r.began, m.len, m.treats
    from runs r
    cross join lateral (
      select 7 as len, 5 as treats
      union all select 30, 15
      union all select g, 40 from generate_series(100, r.len, 100) g
    ) m
    where m.len <= r.len and r.began + m.len - 1 >= since
  )
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'streak', marks.began::text || ':' || marks.len, marks.len::text, marks.treats
  from marks
  on conflict (user_id, reason, ref) do nothing
  returning *;

  -- The day's medals in groups of three or more, as in group_leaderboard: 3 for gold, 2 for silver,
  -- 1 for bronze, only the best one each day.
  return query
  with my_groups as (
    select gm.group_id from group_members gm
    where gm.user_id = me and (select count(*) from group_members x where x.group_id = gm.group_id) >= 3
  ),
  closed as (
    select gm.group_id, min((now() at time zone p.timezone)::date) as first_open_day
    from group_members gm
    join my_groups g on g.group_id = gm.group_id
    join profiles p on p.id = gm.user_id
    group by gm.group_id
  ),
  ranked as (
    select s.user_id, s.day, rank() over (partition by gm.group_id, s.day order by s.steps desc) as r
    from closed c
    join group_members gm on gm.group_id = c.group_id
    join daily_steps s on s.user_id = gm.user_id
    where s.steps > 0 and s.day < c.first_open_day and s.day >= gm.joined_at::date and s.day >= since
  ),
  best as (
    select ranked.day, min(ranked.r) as r from ranked where ranked.user_id = me and ranked.r <= 3 group by ranked.day
  )
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'medal', best.day::text, (array['gold', 'silver', 'bronze'])[best.r], (4 - best.r)::integer
  from best
  on conflict (user_id, reason, ref) do nothing
  returning *;

  -- Journeys finished with the steps to cover them: 20 each, yours or your group's.
  return query
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'journey', 'solo:' || j.id, j.route, 20
  from journeys j
  join journey_routes r on r.key = j.route
  where j.user_id = me and j.completed_on >= since
    and (
      select coalesce(sum(s.steps), 0) from daily_steps s
      where s.user_id = me and s.day between j.started_on and j.completed_on
    ) >= r.km * 1300
  on conflict (user_id, reason, ref) do nothing
  returning *;

  return query
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'journey', 'group:' || g.id, g.route, 20
  from group_journeys g
  join journey_routes r on r.key = g.route
  join group_members m on m.group_id = g.group_id and m.user_id = me
  where g.completed_on >= since and m.joined_at::date <= g.completed_on
    and (select coalesce(sum(x.steps), 0) from group_journey_steps(g.group_id, g.started_on, g.completed_on) x) >= r.km * 1300
  on conflict (user_id, reason, ref) do nothing
  returning *;

  -- A thank-you for having a friend's pet over: 2 for each visit. `detail` is who came.
  return query
  insert into treat_bonuses (user_id, reason, ref, detail, treats)
  select me, 'visit', d.id::text, coalesce(nullif(w.picks -> 'pet' ->> 'name', ''), p.display_name || '''s pet'), 2
  from pet_visits d
  join profiles p on p.id = d.guest
  left join worlds w on w.user_id = d.guest
  where d.host = me and d.day >= since
  on conflict (user_id, reason, ref) do nothing
  returning *;
end;
$$;

-- ---------- Spending ----------

-- Buys something to keep, if it's on sale and you have the treats. True once it's yours (including
-- if it already was); false if you're short.
create function public.buy_item(item_id text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  price integer;
begin
  select s.treats into price
  from shop_items s
  where s.item = item_id and s.kind = 'keep'
    and (
      s.months is null
      or extract(month from now() at time zone (select p.timezone from profiles p where p.id = auth.uid()))::smallint = any (s.months)
    );
  if price is null then
    raise exception 'That isn''t for sale';
  end if;
  if exists (select 1 from pet_purchases b where b.user_id = auth.uid() and b.item = item_id) then
    return true;
  end if;
  if not spend_treats(price) then
    return false;
  end if;
  insert into pet_purchases (user_id, item) values (auth.uid(), item_id);
  return true;
end;
$$;

-- Sends your pet to spend today in a group mate's yard. False if you're short of treats or it's
-- already been on a visit today.
create function public.visit_mate(mate uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  today date;
begin
  if mate = auth.uid() or not shares_group_with(mate) or not exists (select 1 from worlds w where w.user_id = mate) then
    raise exception 'You can only visit a group mate''s pet';
  end if;
  select (now() at time zone p.timezone)::date into today from profiles p where p.id = auth.uid();
  perform 1 from worlds w where w.user_id = auth.uid() for update;
  if exists (select 1 from pet_visits d where d.guest = auth.uid() and d.day = today) then
    return false;
  end if;
  if not spend_treats((select s.treats from shop_items s where s.item = 'visit')) then
    return false;
  end if;
  insert into pet_visits (guest, host, day) values (auth.uid(), mate, today);
  return true;
end;
$$;

-- ---------- Who can call what ----------

revoke execute on function public.spend_treats(integer) from public, anon, authenticated;
revoke execute on function public.claim_treats() from public, anon;
revoke execute on function public.buy_item(text) from public, anon;
revoke execute on function public.visit_mate(uuid) from public, anon;
grant execute on function public.claim_treats() to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.visit_mate(uuid) to authenticated;

commit;
