create table if not exists public.show_crate_audit_progress (
  id uuid primary key default gen_random_uuid(),
  show_event_id uuid not null references public.show_events(id) on delete cascade,
  bin_id uuid not null references public.inventory_bins(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_event_id, bin_id)
);

alter table public.show_crate_audit_progress enable row level security;

drop policy if exists "Authenticated users can view show crate audit progress" on public.show_crate_audit_progress;
create policy "Authenticated users can view show crate audit progress"
  on public.show_crate_audit_progress for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can save show crate audit progress" on public.show_crate_audit_progress;
create policy "Authenticated users can save show crate audit progress"
  on public.show_crate_audit_progress for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update show crate audit progress" on public.show_crate_audit_progress;
create policy "Authenticated users can update show crate audit progress"
  on public.show_crate_audit_progress for update
  to authenticated
  using (true)
  with check (true);

create index if not exists show_crate_audit_progress_event_idx
  on public.show_crate_audit_progress(show_event_id, completed_at);
