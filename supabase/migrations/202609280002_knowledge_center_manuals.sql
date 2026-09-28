create table if not exists public.knowledge_manuals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'General',
  manufacturer text,
  description text,
  file_name text not null,
  storage_path text not null unique,
  file_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_manuals_category_title_idx
  on public.knowledge_manuals (category, title);

alter table public.knowledge_manuals enable row level security;

drop policy if exists "Active employees can view manuals" on public.knowledge_manuals;
create policy "Active employees can view manuals"
  on public.knowledge_manuals for select
  to authenticated
  using ((select public.mw_calendar_is_active_employee()));

drop policy if exists "Active employees can add manuals" on public.knowledge_manuals;
create policy "Active employees can add manuals"
  on public.knowledge_manuals for insert
  to authenticated
  with check ((select public.mw_calendar_is_active_employee()));

drop policy if exists "Administrators can remove manuals" on public.knowledge_manuals;
create policy "Administrators can remove manuals"
  on public.knowledge_manuals for delete
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles profile
      where profile.auth_user_id = (select auth.uid())
        and profile.is_active is true
        and profile.access_level = 'Administrator'
    )
  );

revoke all on table public.knowledge_manuals from anon;
grant select, insert, delete on table public.knowledge_manuals to authenticated;

drop policy if exists "Active employees can upload manuals" on storage.objects;
create policy "Active employees can upload manuals"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = 'manuals'
    and (select public.mw_calendar_is_active_employee())
  );

drop policy if exists "Active employees can read manuals" on storage.objects;
create policy "Active employees can read manuals"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = 'manuals'
    and (select public.mw_calendar_is_active_employee())
  );

drop policy if exists "Administrators can remove manual files" on storage.objects;
create policy "Administrators can remove manual files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = 'manuals'
    and exists (
      select 1 from public.employee_profiles profile
      where profile.auth_user_id = (select auth.uid())
        and profile.is_active is true
        and profile.access_level = 'Administrator'
    )
  );
