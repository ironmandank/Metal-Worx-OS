create table if not exists public.quick_turnaround_contacts (
  commitment_id uuid primary key references public.quick_turnaround_commitments(id) on delete cascade,
  customer_phone text,
  customer_email text,
  updated_at timestamptz not null default now()
);

alter table public.quick_turnaround_contacts enable row level security;

create policy quick_turnaround_contacts_read
on public.quick_turnaround_contacts for select
to authenticated
using ((select public.mw_calendar_is_active_employee()));

create policy quick_turnaround_contacts_insert
on public.quick_turnaround_contacts for insert
to authenticated
with check ((select public.mw_calendar_is_active_employee()));

create policy quick_turnaround_contacts_update
on public.quick_turnaround_contacts for update
to authenticated
using ((select public.mw_calendar_is_active_employee()))
with check ((select public.mw_calendar_is_active_employee()));

grant select, insert, update on public.quick_turnaround_contacts to authenticated;

create table if not exists public.quick_turnaround_images (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.quick_turnaround_commitments(id) on delete cascade,
  storage_path text not null unique,
  caption text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table public.quick_turnaround_images enable row level security;

create policy quick_turnaround_images_read
on public.quick_turnaround_images for select
to authenticated
using ((select public.mw_calendar_is_active_employee()));

create policy quick_turnaround_images_insert
on public.quick_turnaround_images for insert
to authenticated
with check ((select public.mw_calendar_is_active_employee()));

create policy quick_turnaround_images_delete
on public.quick_turnaround_images for delete
to authenticated
using ((select public.mw_calendar_is_active_employee()));

grant select, insert, delete on public.quick_turnaround_images to authenticated;
