alter table public.production_jobs
  add column if not exists plaque_required boolean not null default false;

comment on column public.production_jobs.plaque_required is
  'Whether this artwork production job needs a plaque.';
