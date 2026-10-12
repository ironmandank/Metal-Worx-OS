create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google' check (provider = 'google'),
  google_email text,
  calendar_id text not null default 'primary',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  granted_scope text,
  oauth_state_hash text,
  oauth_state_expires_at timestamptz,
  status text not null default 'Pending' check (status in ('Pending', 'Connected', 'Error', 'Disconnected')),
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_calendar_connections_provider_key
  on public.google_calendar_connections(provider);

alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from anon, authenticated;

create table if not exists public.google_calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  source_type text not null check (source_type in ('company_event', 'project_site_visit', 'project_install')),
  source_id text not null,
  google_event_id text not null,
  google_etag text,
  google_updated_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, source_type, source_id),
  unique(connection_id, google_event_id)
);

create index if not exists google_calendar_event_links_source_idx
  on public.google_calendar_event_links(source_type, source_id);

alter table public.google_calendar_event_links enable row level security;
revoke all on public.google_calendar_event_links from anon, authenticated;

alter table public.company_calendar_events
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists google_etag text,
  add column if not exists google_updated_at timestamptz,
  add column if not exists google_last_synced_at timestamptz,
  add column if not exists google_sync_status text,
  add column if not exists calendar_source text not null default 'metal_worx_os';

create unique index if not exists company_calendar_events_google_event_key
  on public.company_calendar_events(google_calendar_id, google_event_id)
  where google_event_id is not null;

comment on table public.google_calendar_connections is
  'Service-role-only Google Calendar OAuth connection. Tokens are encrypted by the Edge Function before storage.';

comment on table public.google_calendar_event_links is
  'Service-role-only mapping that prevents duplicate Google events for Metal Worx calendar and project schedules.';
