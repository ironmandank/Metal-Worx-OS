alter table public.company_calendar_events
  add column if not exists outside_project_id bigint
    references public.projects(id) on delete set null,
  add column if not exists outside_project_milestone text;

alter table public.company_calendar_events
  drop constraint if exists company_calendar_events_outside_project_milestone_check;

alter table public.company_calendar_events
  add constraint company_calendar_events_outside_project_milestone_check
  check (
    outside_project_milestone is null
    or outside_project_milestone in (
      'General Work',
      'Site Visit',
      'Test Fit',
      'Installation'
    )
  );

create index if not exists company_calendar_events_outside_project_id_idx
  on public.company_calendar_events(outside_project_id)
  where outside_project_id is not null;
