-- Group icon + color (set by the owner in group settings), and room for digits in icon names.
-- Run in the Supabase SQL editor after 007.

alter table public.groups
  add column if not exists icon text check (icon ~ '^[a-z0-9-]{1,40}$'),
  add column if not exists color text not null default '#4355B9' check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.profiles drop constraint if exists profiles_avatar_icon_check;
alter table public.profiles
  add constraint profiles_avatar_icon_check check (avatar_icon ~ '^[a-z0-9-]{1,40}$');
