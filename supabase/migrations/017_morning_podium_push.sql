-- Morning podium push: once a group's day is over for everyone in it, every member is told the results
-- are in, at 7 am where the group's day ends last (a member in Japan with friends in Ottawa hears at
-- 7 am Ottawa time, 8 pm in Tokyo). The app's recap and chat podium card wait the same way, from 5 am.
-- Run in the Supabase SQL editor after 016. Safe for older builds: they never call the new functions,
-- and the recap_push column has a default.

begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.profiles add column if not exists recap_push boolean not null default true;

-- ---------- Push tokens ----------

-- One row per phone. No policies: phones register through the functions below, and only the
-- server job reads them.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

create or replace function public.register_push_token(push_token text, push_platform text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  -- A phone that changes accounts moves its token to the new one.
  insert into push_tokens (token, user_id, platform)
  values (push_token, auth.uid(), push_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(push_token text)
returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where token = push_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------- When a day's results come out ----------

-- `at_hour` o'clock the morning after `d`, wherever in the group that comes last: by then the day is
-- over for every member. Security invoker, so callers only see groups they're in.
create or replace function public.recap_released_at(gid uuid, d date, at_hour int default 5)
returns timestamptz
language sql stable security invoker set search_path = public as $$
  select max(((d + 1)::timestamp + make_interval(hours => at_hour)) at time zone p.timezone)
  from group_members m
  join profiles p on p.id = m.user_id
  where m.group_id = gid
$$;

revoke execute on function public.recap_released_at(uuid, date, int) from public, anon;
grant execute on function public.recap_released_at(uuid, date, int) to authenticated;

-- ---------- Sending ----------

-- Who has been told about which group's day, so nobody hears twice.
create table if not exists public.recap_pushes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, group_id, day)
);
alter table public.recap_pushes enable row level security;

-- Run every 15 minutes by pg_cron. Sends through Expo's push service; pg_net only sends once the
-- transaction commits, so a push and its recap_pushes row go together.
create or replace function public.send_recap_pushes()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  requests integer;
begin
  -- Each launch refreshes a phone's token, so one unseen for 90 days has most likely been uninstalled.
  delete from push_tokens where updated_at < now() - interval '90 days';

  with days as (
    -- Every group's last few days (a day can come out on either side of midnight UTC).
    select g.id as group_id, g.name, d::date as day, public.recap_released_at(g.id, d::date, 7) as release_at
    from groups g
    cross join generate_series(current_date - 2, current_date, interval '1 day') d
  ),
  released as (
    select dy.* from days dy
    where dy.release_at <= now()
      -- Never catch up on old days, e.g. right after this is set up or if the job was paused.
      and dy.release_at > now() - interval '18 hours'
      -- Like the recap: only days someone in the group walked.
      and exists (
        select 1 from group_members m
        join daily_steps s on s.user_id = m.user_id and s.day = dy.day and s.steps > 0
        where m.group_id = dy.group_id
      )
  ),
  recipients as (
    select r.group_id, r.name, r.day, p.id as user_id, p.timezone,
           r.release_at at time zone p.timezone as local_release
    from released r
    join group_members m on m.group_id = r.group_id
    join profiles p on p.id = m.user_id
    where p.recap_push
      and exists (select 1 from push_tokens t where t.user_id = p.id)
      and not exists (
        select 1 from recap_pushes rp where rp.user_id = p.id and rp.group_id = r.group_id and rp.day = r.day
      )
  ),
  due as (
    select * from recipients
    where now() >= case
      -- Anyone it would reach between 10 pm and 7 am gets it at 7 am instead.
      when local_release::time >= time '22:00'
        then ((local_release::date + 1)::timestamp + interval '7 hours') at time zone timezone
      when local_release::time < time '07:00'
        then (local_release::date::timestamp + interval '7 hours') at time zone timezone
      else local_release at time zone timezone
    end
  ),
  logged as (
    insert into recap_pushes (user_id, group_id, day)
    select user_id, group_id, day from due
    on conflict do nothing
    returning user_id, group_id, day
  ),
  per_user as (
    -- One notification per person and day, naming every group whose results are in.
    select d.user_id, d.day, d.timezone,
           array_agg(d.name order by d.name) as names,
           (array_agg(d.group_id order by d.name))[1] as first_group
    from due d
    join logged l using (user_id, group_id, day)
    group by d.user_id, d.day, d.timezone
  ),
  messages as (
    select jsonb_build_object(
             'to', t.token,
             'title', case
                        when u.day = (now() at time zone u.timezone)::date - 1 then 'Yesterday'
                        else to_char(u.day, 'FMDay')
                      end || '''s podium',
             'body', 'Results are in for ' || case cardinality(u.names)
                        when 1 then u.names[1]
                        else array_to_string(u.names[1:cardinality(u.names) - 1], ', ')
                             || ' and ' || u.names[cardinality(u.names)]
                      end,
             'data', jsonb_build_object(
                       'url', '/recap?day=' || to_char(u.day, 'YYYY-MM-DD') || '&groupId=' || u.first_group
                     ),
             'channelId', 'recap',
             'sound', 'default'
           ) as message,
           row_number() over () as n
    from per_user u
    join push_tokens t on t.user_id = u.user_id
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

-- Server only: it messages everyone.
revoke execute on function public.send_recap_pushes() from public, anon, authenticated;

-- Scheduling under the same name again replaces the job.
select cron.schedule('send-recap-pushes', '*/15 * * * *', $$select public.send_recap_pushes()$$);

commit;
