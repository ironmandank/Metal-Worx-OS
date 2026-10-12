alter table public.company_calendar_events
  drop constraint if exists company_calendar_events_type_check;

alter table public.company_calendar_events
  add constraint company_calendar_events_type_check
  check (
    event_type in (
      'Employee Unavailable',
      'Time Off',
      'Company Event',
      'Holiday / Closure',
      'Training',
      'Equipment Maintenance',
      'Delivery / Vendor',
      'Important Reminder',
      'Outside Job'
    )
  );
