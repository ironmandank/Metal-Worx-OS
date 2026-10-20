create table public.huddle_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_profile_id uuid not null references public.employee_profiles(id) on delete restrict,
  employee_name text not null,
  assignment_period text not null check (assignment_period in ('Today', 'This Week')),
  assignment_date date not null,
  assignment_text text not null check (char_length(btrim(assignment_text)) > 0),
  job_reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index huddle_assignments_date_employee_idx on public.huddle_assignments (assignment_date, employee_profile_id);
alter table public.huddle_assignments enable row level security;
grant select, insert, update, delete on public.huddle_assignments to authenticated;
create policy "Signed-in users can read huddle assignments" on public.huddle_assignments for select to authenticated using (true);
create policy "Signed-in users can add huddle assignments" on public.huddle_assignments for insert to authenticated with check (true);
create policy "Signed-in users can update huddle assignments" on public.huddle_assignments for update to authenticated using (true) with check (true);
create policy "Signed-in users can delete huddle assignments" on public.huddle_assignments for delete to authenticated using (true);