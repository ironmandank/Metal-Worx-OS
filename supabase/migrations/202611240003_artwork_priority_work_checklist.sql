alter table public.artwork_priority_items
  add column if not exists needs_patina boolean not null default false,
  add column if not exists needs_welding boolean not null default false;
