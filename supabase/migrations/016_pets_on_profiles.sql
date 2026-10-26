-- Pets on profiles: people who share a group can see each other's pets, and how many steps they've
-- grown with, when they open each other's profiles (the same people who can see each other's steps).
-- Run in the Supabase SQL editor after 015. Safe for older builds: they only read their own pet, and
-- still call world_steps() with no arguments.

begin;

drop policy "worlds_select_own" on public.worlds;
create policy "worlds_select_mates" on public.worlds
  for select to authenticated using (user_id = auth.uid() or public.shares_group_with(user_id));

-- world_steps now takes whose pet (yours if left out). Security invoker, so it only adds up steps the
-- caller may see: their own, or a group mate's.
drop function public.world_steps();
create function public.world_steps(uid uuid default null)
returns bigint
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(s.steps), 0)::bigint
  from worlds w
  join daily_steps s on s.user_id = w.user_id and s.day >= w.started_on
  where w.user_id = coalesce(uid, auth.uid())
$$;

revoke execute on function public.world_steps(uuid) from public, anon;
grant execute on function public.world_steps(uuid) to authenticated;

commit;
