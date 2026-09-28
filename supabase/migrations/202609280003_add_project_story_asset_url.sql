alter table public.project_files
  add column if not exists story_asset_url text;

comment on column public.project_files.story_asset_url is
  'Optional app-hosted or embedded image source used by project storyboard exports when storage_path is not a Supabase Storage object.';

