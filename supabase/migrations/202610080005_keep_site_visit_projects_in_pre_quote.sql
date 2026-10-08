create or replace function public.mw_sync_required_site_visit_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.site_visit_required is true
     and coalesce(new.site_visit_status, 'Not Required') = 'Not Required' then
    new.site_visit_status := case
      when new.site_visit_date is null then 'Needs Scheduling'
      else 'Scheduled'
    end;
  end if;
  return new;
end;
$function$;

drop trigger if exists mw_sync_required_site_visit_status_trigger on public.projects;

create trigger mw_sync_required_site_visit_status_trigger
before insert or update of site_visit_required, site_visit_date, site_visit_status
on public.projects
for each row
execute function public.mw_sync_required_site_visit_status();
