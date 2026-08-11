-- Home Circle — migration 004
-- Adds email/password and username/password sign-up as alternatives to Apple Sign-In.
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- IMPORTANT MANUAL STEP: username accounts are implemented by mapping a
-- username to a synthetic internal email (username@users.homecircle.internal)
-- that can never receive mail. In Supabase Dashboard -> Authentication ->
-- Providers -> Email, you MUST disable "Confirm email" (or username sign-ups
-- will be stuck forever waiting on a confirmation email that can never
-- arrive). Real email sign-ups work either way; if you leave confirmation
-- on, those users just need to click the link in their inbox before their
-- first sign-in.

alter table public.profiles add column if not exists username text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key') then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end $$;

-- Persist display name / username from signup metadata as soon as the
-- auth.users row is created — this runs as security definer, so it works
-- even before email confirmation (when the client has no session yet and
-- couldn't otherwise write to profiles under RLS).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'username'
  )
  on conflict (id) do update set
    username = coalesce(public.profiles.username, excluded.username);
  return new;
end;
$$;
