alter table public.projects
  add column if not exists work_queue_rank integer;

create index if not exists projects_active_work_queue_rank_idx
  on public.projects (work_queue_rank, due_date, planned_start_date)
  where is_active = true and archived_at is null;

comment on column public.projects.work_queue_rank is
  'Manual operating sequence for active outside work. Lower numbers are worked first.';
