alter table public.company_calendar_events
add column if not exists event_color text;

alter table public.company_calendar_events
drop constraint if exists company_calendar_events_event_color_check;

alter table public.company_calendar_events
add constraint company_calendar_events_event_color_check
check (event_color is null or event_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.company_calendar_events.event_color is
'Optional per-event display color. When null, the calendar uses the event-type default.';
