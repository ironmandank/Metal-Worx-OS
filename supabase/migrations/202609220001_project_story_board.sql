alter table public.project_files
  add column if not exists story_stage text,
  add column if not exists customer_visible boolean not null default false,
  add column if not exists is_cover_photo boolean not null default false,
  add column if not exists photo_taken_at timestamptz,
  add column if not exists story_sort_order integer not null default 0;

update public.project_files
set story_stage = case
  when category in ('Estimate / Site Photo', 'Site Photo') then 'Measurements / Site Visit'
  when category in ('Drawing / Design') then 'Design & Drawings'
  when category in ('Material Document') then 'Materials'
  when category in ('Fabrication Photo', 'Production File') then 'Fabrication'
  when category in ('Installation Photo') then 'Installation'
  when category in ('Completion Photo', 'Completion Document') then 'Completed Project'
  else story_stage
end
where story_stage is null;

alter table public.project_files
  drop constraint if exists project_files_story_stage_check;

alter table public.project_files
  add constraint project_files_story_stage_check
  check (
    story_stage is null or story_stage in (
      'Concept & Scope',
      'Measurements / Site Visit',
      'Design & Drawings',
      'Materials',
      'Fabrication',
      'Test Fit',
      'Paint / Powder Coat',
      'Installation',
      'Completed Project'
    )
  );

create index if not exists project_files_story_board_idx
  on public.project_files (project_id, story_stage, story_sort_order, created_at);

alter table public.projects
  add column if not exists site_visit_outcome text,
  add column if not exists site_visit_result_notes text,
  add column if not exists promised_quote_date date;

alter table public.projects
  drop constraint if exists projects_site_visit_outcome_check;

alter table public.projects
  add constraint projects_site_visit_outcome_check
  check (
    site_visit_outcome is null or site_visit_outcome in (
      'Ready for Quote',
      'Waiting on Customer',
      'Needs Measurements',
      'Needs Design / Engineering',
      'No Quote Needed',
      'Lost / Declined'
    )
  );
