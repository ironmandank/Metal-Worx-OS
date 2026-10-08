alter table public.projects
  add column if not exists workflow_stage_dates jsonb not null default '{}'::jsonb;

comment on column public.projects.workflow_stage_dates is
  'Automatic start/completion timestamps and employee names for the streamlined project workflow.';

create or replace function public.mw_stamp_project_workflow_stage_dates()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fields text[] := array[
    'site_visit_status', 'measurements_status', 'quote_status', 'approval_status',
    'down_payment_status', 'design_status', 'fabrication_status', 'test_fit_status',
    'finish_status', 'assembly_status', 'install_status', 'final_inspection_status',
    'balance_status'
  ];
  v_keys text[] := array[
    'siteVisit', 'measurements', 'quote', 'approval', 'downPayment', 'design',
    'production', 'testFit', 'finish', 'assembly', 'install', 'inspection', 'balance'
  ];
  v_field text;
  v_key text;
  v_old_status text;
  v_new_status text;
  v_complete boolean;
  v_dates jsonb := coalesce(new.workflow_stage_dates, '{}'::jsonb);
  i integer;
begin
  for i in 1..array_length(v_fields, 1) loop
    v_field := v_fields[i];
    v_key := v_keys[i];
    v_new_status := to_jsonb(new) ->> v_field;
    v_old_status := case when tg_op = 'UPDATE' then to_jsonb(old) ->> v_field else null end;

    if v_new_status is not distinct from v_old_status then
      continue;
    end if;

    if v_new_status is null or v_new_status in ('Not Started', 'Not Required', 'Pending', 'Waiting') then
      continue;
    end if;

    if not (v_dates ? v_key) or not (v_dates -> v_key ? 'started_at') then
      v_dates := jsonb_set(
        v_dates,
        array[v_key],
        coalesce(v_dates -> v_key, '{}'::jsonb) || jsonb_build_object('started_at', now()),
        true
      );
    end if;

    v_complete := case v_key
      when 'quote' then v_new_status in ('Sent', 'Approved')
      when 'approval' then v_new_status = 'Approved'
      when 'downPayment' then v_new_status = 'Received'
      when 'inspection' then v_new_status = 'Passed'
      when 'balance' then v_new_status = 'Paid'
      else v_new_status = 'Completed'
    end;

    if v_complete and (not (v_dates -> v_key ? 'completed_at')) then
      v_dates := jsonb_set(
        v_dates,
        array[v_key],
        coalesce(v_dates -> v_key, '{}'::jsonb) || jsonb_build_object('completed_at', now()),
        true
      );
    elsif not v_complete and (v_dates -> v_key ? 'completed_at') then
      v_dates := v_dates #- array[v_key, 'completed_at'];
      v_dates := v_dates #- array[v_key, 'completed_by'];
    end if;
  end loop;

  new.workflow_stage_dates := v_dates;
  return new;
end;
$$;

revoke all on function public.mw_stamp_project_workflow_stage_dates() from public, anon, authenticated;

drop trigger if exists mw_projects_stamp_workflow_stage_dates on public.projects;
create trigger mw_projects_stamp_workflow_stage_dates
before insert or update on public.projects
for each row execute function public.mw_stamp_project_workflow_stage_dates();

update public.projects
set workflow_stage_dates = jsonb_strip_nulls(
  coalesce(workflow_stage_dates, '{}'::jsonb)
  || case when site_visit_start is not null or site_visit_end is not null then
       jsonb_build_object('siteVisit', jsonb_strip_nulls(jsonb_build_object('started_at', site_visit_start, 'completed_at', site_visit_end)))
     else '{}'::jsonb end
  || case when test_fit_start is not null or test_fit_end is not null then
       jsonb_build_object('testFit', jsonb_strip_nulls(jsonb_build_object('started_at', test_fit_start, 'completed_at', test_fit_end)))
     else '{}'::jsonb end
  || case when install_start is not null or install_end is not null then
       jsonb_build_object('install', jsonb_strip_nulls(jsonb_build_object('started_at', install_start, 'completed_at', install_end)))
     else '{}'::jsonb end
)
where site_visit_start is not null or site_visit_end is not null
   or test_fit_start is not null or test_fit_end is not null
   or install_start is not null or install_end is not null;
