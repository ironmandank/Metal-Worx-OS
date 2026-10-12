alter table public.google_calendar_event_links
  drop constraint if exists google_calendar_event_links_source_type_check;

alter table public.google_calendar_event_links
  add constraint google_calendar_event_links_source_type_check
  check (
    source_type in (
      'company_event',
      'project_site_visit',
      'project_test_fit',
      'project_install',
      'project_general_work'
    )
  );

comment on column public.google_calendar_event_links.source_type is
  'Metal Worx OS source record type linked to the dedicated Google calendar event.';
