-- Let every signed-in team member view the shared artwork Hot Priority list.
-- Mutations remain controlled by the existing administrator policy and own-item policy.
drop policy if exists "Employees read their own artwork priority items" on public.artwork_priority_items;

create policy "Authenticated users can view artwork hot priority"
  on public.artwork_priority_items
  for select
  to authenticated
  using (true);
