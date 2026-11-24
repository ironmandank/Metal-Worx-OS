alter table public.artwork_priority_items
  add column if not exists due_date date;
