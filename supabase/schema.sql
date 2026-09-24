-- Steppa schema. Run in the Supabase SQL editor (or `supabase db push` as a migration).

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_color text not null default '#006C4C' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  daily_goal integer not null default 10000 check (daily_goal between 1000 and 100000),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 200),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.daily_steps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  steps integer not null check (steps between 0 and 200000),
  source text,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- Helper functions (security definer avoids recursive RLS) ----------

create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------- Triggers ----------

-- Create a profile on sign-up from the metadata sent by the app.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8))),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Walker')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Group creator automatically becomes the owner member.
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ---------- RPCs ----------

create or replace function public.join_group_by_code(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select id into gid from groups where invite_code = upper(trim(code));
  if gid is null then
    raise exception 'Invalid invite code';
  end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end;
$$;

-- Leaderboard over a date range; RLS on daily_steps still applies (security invoker).
create or replace function public.group_leaderboard(gid uuid, from_day date, to_day date)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_color text,
  total_steps bigint
) language sql stable security invoker set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_color,
         coalesce(sum(s.steps), 0)::bigint as total_steps
  from group_members m
  join profiles p on p.id = m.user_id
  left join daily_steps s on s.user_id = m.user_id and s.day between from_day and to_day
  where m.group_id = gid
  group by p.id
  order by total_steps desc, p.display_name;
$$;

revoke execute on function public.join_group_by_code(text) from anon;
revoke execute on function public.group_leaderboard(uuid, date, date) from anon;

-- ---------- Row level security ----------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.daily_steps enable row level security;

-- Profiles: any signed-in user can view (for search/compare); only edit your own.
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Groups: members can view; anyone can create as owner; owner can edit/delete.
-- owner_id check is needed so INSERT ... RETURNING passes before the owner membership row exists.
create policy "groups_select_member" on public.groups
  for select to authenticated using (owner_id = auth.uid() or public.is_group_member(id));
create policy "groups_insert_owner" on public.groups
  for insert to authenticated with check (owner_id = auth.uid());
create policy "groups_update_owner" on public.groups
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "groups_delete_owner" on public.groups
  for delete to authenticated using (owner_id = auth.uid());

-- Members: visible to fellow members; joining happens via join_group_by_code.
create policy "members_select" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "members_leave_or_kick" on public.group_members
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- Steps: you and people who share a group with you can read; you write your own.
create policy "steps_select" on public.daily_steps
  for select to authenticated using (user_id = auth.uid() or public.shares_group_with(user_id));
create policy "steps_insert_own" on public.daily_steps
  for insert to authenticated with check (user_id = auth.uid());
create policy "steps_update_own" on public.daily_steps
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant select, insert, update on public.daily_steps to authenticated;
