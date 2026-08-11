-- Home Circle — migration 002
-- Adds shared step data, calendar visibility/ownership, and fixes realtime DELETE events.
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- ── Shared step data ────────────────────────────────────────────────────────
-- Each member writes only their own rows; every member can read the whole family.

create table if not exists public.step_entries (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null,
  steps integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id, date_key)
);

alter table public.step_entries enable row level security;

drop policy if exists "Members can view family steps" on public.step_entries;
create policy "Members can view family steps" on public.step_entries
  for select using (public.is_family_member(family_id));

drop policy if exists "Users can insert own steps" on public.step_entries;
create policy "Users can insert own steps" on public.step_entries
  for insert with check (user_id = auth.uid() and public.is_family_member(family_id));

drop policy if exists "Users can update own steps" on public.step_entries;
create policy "Users can update own steps" on public.step_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Calendar: private/shared visibility + creator attribution ────────────────

alter table public.calendar_events
  add column if not exists visibility text not null default 'shared';

alter table public.calendar_events
  add column if not exists created_by_name text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_visibility_check') then
    alter table public.calendar_events
      add constraint calendar_events_visibility_check check (visibility in ('private', 'shared'));
  end if;
end $$;

-- Shared events are visible to the family; private events only to their author.
drop policy if exists "Members can view family events" on public.calendar_events;
create policy "Members can view family events" on public.calendar_events
  for select using (
    public.is_family_member(family_id)
    and (visibility = 'shared' or created_by = auth.uid())
  );

-- You may only delete events you created.
drop policy if exists "Members can delete removable family events" on public.calendar_events;
drop policy if exists "Members can delete their own events" on public.calendar_events;
create policy "Members can delete their own events" on public.calendar_events
  for delete using (created_by = auth.uid() and read_only = false);

-- ── Realtime DELETE fix ─────────────────────────────────────────────────────
-- By default Postgres only ships primary-key columns in a DELETE's old record,
-- so realtime filters like `family_id=eq.<id>` never match and deletes are
-- silently dropped on other devices. REPLICA IDENTITY FULL ships the whole row.

alter table public.family_members replica identity full;
alter table public.calendar_events replica identity full;
alter table public.grocery_items replica identity full;
alter table public.photos replica identity full;
alter table public.photo_likes replica identity full;
alter table public.profiles replica identity full;
alter table public.step_entries replica identity full;

-- ── Realtime publication ────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.step_entries;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;
