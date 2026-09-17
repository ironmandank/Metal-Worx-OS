create or replace function public.mw_release_project_to_production(
  p_project_id bigint,
  p_built_by text default null
)
returns public.production_jobs
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  project_row public.projects%rowtype;
  job_row public.production_jobs%rowtype;
  route_steps text[] := array[]::text[];
  route_departments text[] := array[]::text[];
  step_index integer;
  test_fit_pending boolean;
  outstanding_materials integer := 0;
begin
  if auth.uid() is null or not public.mw_calendar_is_active_employee() then
    raise exception 'An active Metal Worx employee login is required.';
  end if;

  select * into project_row
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project % was not found.', p_project_id;
  end if;

  select * into job_row
  from public.production_jobs
  where project_id = p_project_id
    and is_active is true
  order by id desc
  limit 1
  for update;

  if found then
    return job_row;
  end if;

  if project_row.status in ('Cancelled', 'On Hold') then
    raise exception 'Remove the project hold before releasing it to production.';
  end if;

  if project_row.customer_approval_required is not false
     and coalesce(project_row.approval_status, '') not in ('Approved', 'Bypassed') then
    raise exception 'Customer approval must be recorded before production release.';
  end if;

  if project_row.down_payment_required
     and coalesce(project_row.down_payment_status, '') not in ('Received', 'Paid', 'Not Required') then
    raise exception 'The required down payment must be received before production release.';
  end if;

  select count(*) into outstanding_materials
  from public.project_material_requests request
  where request.project_id = p_project_id
    and coalesce(request.request_scope, 'Project') <> 'Reference Only'
    and not (
      coalesce(request.received, false)
      or coalesce(request.quantity_received, 0) >= coalesce(request.quantity, 0)
    );

  if outstanding_materials > 0 then
    raise exception '% material request(s) still require pricing, ordering, or receiving.', outstanding_materials;
  end if;

  test_fit_pending :=
    project_row.test_fit_required
    and coalesce(project_row.test_fit_status, 'Not Started')
      not in ('Completed', 'Not Required');

  if project_row.design_required
     and coalesce(project_row.design_status, 'Not Started')
       not in ('Completed', 'Not Required') then
    route_steps := array_append(route_steps, 'Design');
    route_departments := array_append(route_departments, 'Design');
  end if;

  if project_row.fabrication_required
     and coalesce(project_row.fabrication_status, 'Not Started')
       not in ('Completed', 'Not Required') then
    route_steps := array_append(route_steps, 'Laser Cutting');
    route_departments := array_append(route_departments, 'Laser');
    route_steps := array_append(route_steps, 'Welding / Fabrication');
    route_departments := array_append(route_departments, 'Welding');
  end if;

  -- Test fit is field work and pauses the shop route before finishing.
  if not test_fit_pending then
    if project_row.finish_required
       and coalesce(project_row.finish_status, 'Not Started')
         not in ('Completed', 'Not Required') then
      route_steps := array_append(route_steps, 'Surface Prep');
      route_departments := array_append(route_departments, 'Prep');
      route_steps := array_append(route_steps, 'Finish / Corrections');
      route_departments := array_append(route_departments, 'Paint/Powder');
    end if;

    if project_row.assembly_required
       and coalesce(project_row.assembly_status, 'Not Started')
         not in ('Completed', 'Not Required') then
      route_steps := array_append(route_steps, 'Assembly');
      route_departments := array_append(route_departments, 'Assembly');
    end if;

    route_steps := array_append(route_steps, 'Final QC');
    route_departments := array_append(route_departments, 'Final QC / Showroom');
  end if;

  if cardinality(route_steps) = 0 then
    if test_fit_pending then
      raise exception 'Shop fabrication is complete. Schedule and complete the test fit before releasing finishing work.';
    end if;
    if project_row.install_required then
      raise exception 'Shop production is complete. Schedule the installation.';
    end if;
    raise exception 'No incomplete production stages remain for this project.';
  end if;

  insert into public.production_jobs (
    production_job_number, project_id, customer_id, status,
    current_department, progress_percent, due_date, rush, notes, is_active
  ) values (
    'PJ-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    project_row.id,
    project_row.customer_id,
    'In Production',
    route_departments[1],
    0,
    coalesce(project_row.target_completion_date, project_row.due_date),
    lower(coalesce(project_row.priority, '')) in ('rush', 'emergency', 'high'),
    concat_ws(E'\n', project_row.notes,
      case when nullif(trim(coalesce(p_built_by, '')), '') is not null
        then 'Released by ' || trim(p_built_by) end),
    true
  ) returning * into job_row;

  for step_index in 1..cardinality(route_steps) loop
    insert into public.work_orders (
      work_order_number, production_job_id, project_id, customer_id,
      step_name, department, step_order, status, quantity, is_active
    ) values (
      'WO-' || job_row.id || '-PRJ-' || lpad(step_index::text, 2, '0'),
      job_row.id,
      project_row.id,
      project_row.customer_id,
      route_steps[step_index],
      route_departments[step_index],
      step_index,
      case when step_index = 1 then 'Ready' else 'Queued' end,
      1,
      true
    );
  end loop;

  update public.projects
  set
    status = 'In Production',
    material_status = case
      when outstanding_materials = 0 then
        case when exists (
          select 1 from public.project_material_requests r where r.project_id = p_project_id
        ) then 'Received' else 'Not Needed' end
      else material_status
    end,
    materials_ordered = case when outstanding_materials = 0 then true else materials_ordered end,
    materials_received = case when outstanding_materials = 0 then true else materials_received end,
    ready_for_install = false,
    design_status = case when route_steps[1] = 'Design' then 'Ready' else design_status end,
    fabrication_status = case when route_steps[1] in ('Laser Cutting', 'Welding / Fabrication') then 'Ready' else fabrication_status end,
    finish_status = case when route_steps[1] in ('Surface Prep', 'Finish / Corrections') then 'Ready' else finish_status end,
    assembly_status = case when route_steps[1] = 'Assembly' then 'Ready' else assembly_status end,
    next_action = 'Start ' || route_steps[1]
  where id = project_row.id;

  return job_row;
end;
$$;

revoke execute on function public.mw_release_project_to_production(bigint, text) from public, anon;
grant execute on function public.mw_release_project_to_production(bigint, text) to authenticated;
