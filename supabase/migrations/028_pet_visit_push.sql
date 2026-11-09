-- Pet visit push: when a group mate's pet comes over, the host hears about it ("Biscuit came over to
-- play"). It's under the same switch as pet milestones: profiles.pet_push, which the app keeps in step
-- with the switch in Settings. Between 10 pm and 7 am where the host is, it waits until 7.
-- Run in the Supabase SQL editor after 027 (it needs 017's push_tokens, pg_net and pg_cron). Safe for
-- older builds: the column has a default, and nothing else changes for them.

begin;

alter table public.profiles add column if not exists pet_push boolean not null default true;

-- One row per visit, waiting to be sent (sent_at null) or sent.
create table if not exists public.pet_visit_pushes (
  visit_id bigint primary key references public.pet_visits (id) on delete cascade,
  send_after timestamptz not null,
  sent_at timestamptz
);
create index if not exists pet_visit_pushes_due_idx on public.pet_visit_pushes (send_after) where sent_at is null;
alter table public.pet_visit_pushes enable row level security;

-- Sends every visit push that's due, through Expo's push service. pg_net only sends once the
-- transaction commits, so a push goes out only for a visit that really happened.
create or replace function public.send_visit_pushes()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  requests integer;
begin
  with due as (
    update pet_visit_pushes q set sent_at = now()
    where q.sent_at is null and q.send_after <= now()
    returning q.visit_id
  ),
  visits as (
    select v.host,
           g.display_name as owner,
           nullif(trim(gw.picks -> 'pet' ->> 'name'), '') as guest_pet,
           nullif(trim(hw.picks -> 'pet' ->> 'name'), '') as host_pet
    from due d
    join pet_visits v on v.id = d.visit_id
    join profiles h on h.id = v.host
    join profiles g on g.id = v.guest
    left join worlds gw on gw.user_id = v.guest
    left join worlds hw on hw.user_id = v.host
    where h.pet_push
      -- One that didn't go out within a day (e.g. the job was paused) is old news.
      and v.created_at > now() - interval '1 day'
  ),
  messages as (
    select jsonb_build_object(
             'to', t.token,
             'title', coalesce(m.guest_pet, m.owner || '''s pet') || ' came over to play',
             'body', case when m.guest_pet is null then 'Spending' else 'From ' || m.owner || '''s, spending' end
                     || ' the day with ' || coalesce(m.host_pet, 'your pet'),
             'data', jsonb_build_object('url', '/pet'),
             'channelId', 'pet',
             'sound', 'default'
           ) as message,
           row_number() over () as n
    from visits m
    join push_tokens t on t.user_id = m.host
  )
  select count(*) into requests from (
    -- Expo takes up to 100 messages per request.
    select net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_agg(message),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    )
    from messages
    group by (n - 1) / 100
  ) sent;

  return requests;
end;
$$;

-- Server only: it messages anyone.
revoke execute on function public.send_visit_pushes() from public, anon, authenticated;

-- Queues the host's push as a visit is made, and sends it straight away unless it's night for them.
create or replace function public.queue_visit_push()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text;
  local timestamp;
  send_at timestamptz;
begin
  select coalesce(p.timezone, 'UTC') into tz from profiles p where p.id = new.host;
  tz := coalesce(tz, 'UTC');
  local := now() at time zone tz;
  send_at := case
    when local::time >= time '22:00' then ((local::date + 1)::timestamp + interval '7 hours') at time zone tz
    when local::time < time '07:00' then (local::date::timestamp + interval '7 hours') at time zone tz
    else now()
  end;
  insert into pet_visit_pushes (visit_id, send_after) values (new.id, send_at) on conflict do nothing;
  if send_at <= now() then
    perform send_visit_pushes();
  end if;
  return new;
end;
$$;
revoke execute on function public.queue_visit_push() from public, anon, authenticated;

drop trigger if exists pet_visits_push on public.pet_visits;
create trigger pet_visits_push
  after insert on public.pet_visits
  for each row execute function public.queue_visit_push();

-- Picks up the ones held back overnight. Scheduling under the same name again replaces the job.
select cron.schedule('send-visit-pushes', '*/15 * * * *', $$select public.send_visit_pushes()$$);

commit;
