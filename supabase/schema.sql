-- Home Circle — initial schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_color text not null default '#1E5C4B',
  birthday date,
  created_at timestamptz not null default now()
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  date_key text not null,
  title text not null,
  time text not null,
  color text not null,
  type text not null default 'user' check (type in ('user', 'holiday', 'birthday')),
  read_only boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  category text not null,
  completed boolean not null default false,
  added_by uuid references auth.users (id),
  added_by_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  storage_path text not null,
  caption text not null default '',
  author_id uuid not null references auth.users (id),
  author_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.photo_likes (
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (photo_id, user_id)
);

-- ── Helper ────────────────────────────────────────────────────────────────

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = auth.uid()
  );
$$;

-- ── Create / join family (atomic, bypasses table RLS via security definer) ─

create or replace function public.create_family(p_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_family public.families;
begin
  loop
    v_code := upper(substring(regexp_replace(p_name, '[^a-zA-Z]', '', 'g') from 1 for 4));
    if v_code = '' then
      v_code := 'HOME';
    end if;
    v_code := v_code || '-' || lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.families where invite_code = v_code);
  end loop;

  insert into public.families (name, invite_code, created_by)
  values (p_name, v_code, auth.uid())
  returning * into v_family;

  insert into public.family_members (family_id, user_id) values (v_family.id, auth.uid());

  return v_family;
end;
$$;

create or replace function public.join_family(p_invite_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family public.families;
begin
  select * into v_family from public.families where invite_code = upper(p_invite_code);
  if not found then
    raise exception 'Invalid invite code';
  end if;

  insert into public.family_members (family_id, user_id)
  values (v_family.id, auth.uid())
  on conflict (family_id, user_id) do nothing;

  return v_family;
end;
$$;

grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;

-- ── Auto-create a profile row when a user signs up ──────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.profiles enable row level security;
create policy "Authenticated users can view profiles" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "Users can insert own profile" on public.profiles
  for insert with check (id = auth.uid());
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());

alter table public.families enable row level security;
create policy "Members can view their families" on public.families
  for select using (public.is_family_member(id));

alter table public.family_members enable row level security;
create policy "Members can view their family roster" on public.family_members
  for select using (public.is_family_member(family_id));

alter table public.calendar_events enable row level security;
create policy "Members can view family events" on public.calendar_events
  for select using (public.is_family_member(family_id));
create policy "Members can add family events" on public.calendar_events
  for insert with check (public.is_family_member(family_id) and created_by = auth.uid());
create policy "Members can delete removable family events" on public.calendar_events
  for delete using (public.is_family_member(family_id) and read_only = false);

alter table public.grocery_items enable row level security;
create policy "Members can view grocery items" on public.grocery_items
  for select using (public.is_family_member(family_id));
create policy "Members can add grocery items" on public.grocery_items
  for insert with check (public.is_family_member(family_id));
create policy "Members can update grocery items" on public.grocery_items
  for update using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "Members can delete grocery items" on public.grocery_items
  for delete using (public.is_family_member(family_id));

alter table public.photos enable row level security;
create policy "Members can view photos" on public.photos
  for select using (public.is_family_member(family_id));
create policy "Members can add photos" on public.photos
  for insert with check (public.is_family_member(family_id) and author_id = auth.uid());
create policy "Authors can delete their own photos" on public.photos
  for delete using (author_id = auth.uid());

alter table public.photo_likes enable row level security;
create policy "Members can view photo likes" on public.photo_likes
  for select using (
    exists (select 1 from public.photos p where p.id = photo_id and public.is_family_member(p.family_id))
  );
create policy "Members can like photos" on public.photo_likes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.photos p where p.id = photo_id and public.is_family_member(p.family_id))
  );
create policy "Users can remove their own like" on public.photo_likes
  for delete using (user_id = auth.uid());

-- ── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.family_members;
alter publication supabase_realtime add table public.calendar_events;
alter publication supabase_realtime add table public.grocery_items;
alter publication supabase_realtime add table public.photos;
alter publication supabase_realtime add table public.photo_likes;

-- ── Storage bucket for photos ────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "Public read access to photo files" on storage.objects
  for select using (bucket_id = 'photos');
create policy "Authenticated users can upload photos" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.role() = 'authenticated');
create policy "Users can delete their own uploaded photos" on storage.objects
  for delete using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── Follow-up: allow leaving a family ────────────────────────────────────────

create policy "Members can leave their family" on public.family_members
  for delete using (user_id = auth.uid());
