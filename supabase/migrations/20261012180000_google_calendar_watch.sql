alter table public.google_calendar_connections
  add column if not exists watch_channel_id text,
  add column if not exists watch_resource_id text,
  add column if not exists watch_token_hash text,
  add column if not exists watch_expires_at timestamptz;

comment on column public.google_calendar_connections.watch_channel_id is
  'Google Calendar push-notification channel used for automatic inbound sync.';

