-- Home Circle — migration 003
-- Lets the family creator remove other members from the family.
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.

drop policy if exists "Creators can remove other family members" on public.family_members;
create policy "Creators can remove other family members" on public.family_members
  for delete using (
    user_id <> auth.uid()
    and exists (
      select 1 from public.families f
      where f.id = family_id and f.created_by = auth.uid()
    )
  );
