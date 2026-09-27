-- Chat moderation (block users, report messages) and in-app account deletion.
-- Both are App Store requirements (guidelines 1.2 and 5.1.1(v)).
-- Run in the Supabase SQL editor after 008. Wrapped in a transaction so it applies all or nothing
-- (the chat read policy is dropped and re-created; a half-applied run would hide all messages).

begin;

-- ---------- Blocking ----------

create table public.blocked_users (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "blocks_select_own" on public.blocked_users
  for select to authenticated using (blocker_id = auth.uid());
create policy "blocks_insert_own" on public.blocked_users
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocks_delete_own" on public.blocked_users
  for delete to authenticated using (blocker_id = auth.uid());

grant select, insert, delete on public.blocked_users to authenticated;

-- ---------- Reports ----------

-- Review these in the Supabase dashboard (Table editor → message_reports).
-- body/reported_user_id are snapshots, so a report survives the message being deleted.
create table public.message_reports (
  id bigint generated always as identity primary key,
  message_id bigint references public.group_messages (id) on delete set null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  body text,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table public.message_reports enable row level security;

-- Reporters can see their own reports (the chat policy below uses this to hide them).
create policy "reports_select_own" on public.message_reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "reports_insert_own" on public.message_reports
  for insert to authenticated with check (reporter_id = auth.uid());

grant select, insert on public.message_reports to authenticated;

-- Fill the snapshot from the real message so a client can't misreport who said what.
create or replace function public.fill_message_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.user_id, m.group_id, m.body
    into new.reported_user_id, new.group_id, new.body
  from group_messages m
  where m.id = new.message_id and public.is_group_member(m.group_id);
  if new.body is null then
    raise exception 'Message not found';
  end if;
  return new;
end;
$$;

create trigger message_reports_fill
  before insert on public.message_reports
  for each row execute function public.fill_message_report();

-- ---------- Chat visibility ----------

-- Hide messages from people you blocked and messages you reported. Realtime applies the
-- same policy, so they disappear from live updates too.
drop policy if exists "messages_select_member" on public.group_messages;
create policy "messages_select_member" on public.group_messages
  for select to authenticated using (
    public.is_group_member(group_id)
    and not exists (
      select 1 from public.blocked_users b
      where b.blocker_id = auth.uid() and b.blocked_id = group_messages.user_id
    )
    and not exists (
      select 1 from public.message_reports r
      where r.reporter_id = auth.uid() and r.message_id = group_messages.id
    )
  );

-- ---------- Account deletion ----------

-- Deletes the caller's login. Everything else (profile, steps, memberships, messages,
-- blocks, reports, and groups they own) goes with it via ON DELETE CASCADE.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
