create table if not exists public.project_storyboard_exports (
  project_id bigint not null references public.projects(id) on delete cascade,
  file_type text not null check (file_type in ('pptx', 'pdf')),
  part_index integer not null check (part_index >= 0),
  file_data bytea not null,
  file_name text not null,
  mime_type text not null,
  total_parts integer not null check (total_parts > 0),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null,
  uploaded_at timestamptz not null default now(),
  primary key (project_id, file_type, part_index)
);

alter table public.project_storyboard_exports enable row level security;

grant select on public.project_storyboard_exports to authenticated;

create policy "Administrators can download project storyboards"
on public.project_storyboard_exports
for select
to authenticated
using (
  exists (
    select 1
    from public.employee_profiles ep
    where ep.auth_user_id = (select auth.uid())
      and ep.is_active is true
      and ep.access_level = 'Administrator'
  )
);
