alter table public.artwork_priority_items
  add column if not exists needs_clear_coat boolean not null default false;
