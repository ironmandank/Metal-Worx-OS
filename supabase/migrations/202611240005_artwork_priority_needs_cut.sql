alter table public.artwork_priority_items
  add column if not exists needs_cut boolean not null default false;
