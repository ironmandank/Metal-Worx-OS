alter table public.projects
  add column if not exists outside_job_stage text,
  add column if not exists outside_job_status text;

comment on column public.projects.outside_job_stage is
  'Current station for an independently tracked outside fabrication job.';

comment on column public.projects.outside_job_status is
  'Work status within the current station for an outside fabrication job.';
