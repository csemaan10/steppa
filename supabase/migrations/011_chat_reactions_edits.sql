-- Chat: emoji reactions, and editing your own messages (deleting was already allowed in 002).
-- Run in the Supabase SQL editor after 010. Safe for older builds: they ignore the new column/table.

begin;

-- ---------- Editing ----------

alter table public.group_messages add column if not exists edited_at timestamptz;

-- Only the body can change, and only on your own messages; edited_at is set by the trigger below.
create policy "messages_update_own" on public.group_messages
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Supabase's default privileges give table-wide UPDATE, which would make the column grant moot.
revoke update on public.group_messages from authenticated, anon;
grant update (body) on public.group_messages to authenticated;

create or replace function public.stamp_message_edit()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger group_messages_stamp_edit
  before update on public.group_messages
  for each row execute function public.stamp_message_edit();

-- ---------- Reactions ----------

-- One reaction per person per message (picking another emoji replaces it).
-- group_id is copied from the message so realtime can filter by group.
create table public.message_reactions (
  message_id bigint not null references public.group_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  emoji text not null check (emoji in ('like', 'love', 'laugh', 'fire', 'shoe', 'wow')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index message_reactions_group_idx on public.message_reactions (group_id);

alter table public.message_reactions enable row level security;

-- Same visibility as messages: group members only, minus people you blocked.
create policy "reactions_select_member" on public.message_reactions
  for select to authenticated using (
    public.is_group_member(group_id)
    and not exists (
      select 1 from public.blocked_users b
      where b.blocker_id = auth.uid() and b.blocked_id = message_reactions.user_id
    )
  );
create policy "reactions_insert_own" on public.message_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));
create policy "reactions_update_own" on public.message_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_group_member(group_id));
create policy "reactions_delete_own" on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());

-- The client upserts, which PostgREST turns into ON CONFLICT DO UPDATE SET for every column it
-- sent (message_id, user_id, emoji), so all three need UPDATE. group_id stays trigger-only.
grant select, insert, delete on public.message_reactions to authenticated;
revoke update on public.message_reactions from authenticated, anon;
grant update (message_id, user_id, emoji) on public.message_reactions to authenticated;

-- Fill group_id from the real message (on insert and update) so a client can't react across groups.
create or replace function public.fill_message_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.group_id into new.group_id from group_messages m where m.id = new.message_id;
  if new.group_id is null then
    raise exception 'Message not found';
  end if;
  return new;
end;
$$;

create trigger message_reactions_fill
  before insert or update on public.message_reactions
  for each row execute function public.fill_message_reaction();

-- Live updates in the app.
alter publication supabase_realtime add table public.message_reactions;

commit;
