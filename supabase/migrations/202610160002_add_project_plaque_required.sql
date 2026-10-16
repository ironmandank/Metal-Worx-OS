alter table public.projects
  add column if not exists plaque_required boolean not null default false;

comment on column public.projects.plaque_required is
  'Whether this project requires a plaque.';
