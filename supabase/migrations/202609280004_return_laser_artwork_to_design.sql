create or replace function public.mw_return_laser_to_design(
  p_laser_work_order_id bigint,
  p_actor text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_laser public.work_orders%rowtype;
  v_design public.work_orders%rowtype;
  v_is_admin boolean;
  v_customer_order_id bigint;
  v_design_before_status text;
  v_progress integer;
  v_note text;
begin
  select exists (
    select 1
    from public.employee_profiles
    where auth_user_id = (select auth.uid())
      and is_active is true
      and lower(coalesce(access_level, '')) like '%admin%'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Administrator access is required to return Laser work to Design.';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Enter why this artwork is being returned to Design.';
  end if;

  select * into v_laser
  from public.work_orders
  where id = p_laser_work_order_id
    and department = 'Laser'
    and is_active is true
    and status in ('Ready', 'In Progress', 'Blocked')
  for update;

  if not found then
    raise exception 'This Laser work order is no longer available. Refresh the queue.';
  end if;

  v_design_before_status := v_design.status;

  select * into v_design
  from public.work_orders
  where production_job_id = v_laser.production_job_id
    and department = 'Design'
  order by step_order nulls last, id
  limit 1
  for update;

  if not found then
    raise exception 'No Design work order is linked to this production job.';
  end if;

  v_note := 'Returned from Laser to Design by '
    || coalesce(nullif(trim(coalesce(p_actor, '')), ''), 'Administrator')
    || ': ' || trim(p_reason);

  update public.work_orders
  set status = 'Pending',
      started_at = null,
      completed_at = null,
      blocked_reason = null,
      notes = concat_ws(E'\n', nullif(notes, ''), v_note)
  where id = v_laser.id;

  update public.work_orders
  set status = 'Ready',
      started_at = null,
      completed_at = null,
      blocked_reason = null,
      is_active = true,
      notes = concat_ws(E'\n', nullif(notes, ''), v_note)
  where id = v_design.id
  returning * into v_design;

  select customer_order_id into v_customer_order_id
  from public.production_jobs
  where id = v_laser.production_job_id;

  select round(
    100.0 * count(*) filter (where status = 'Completed')
    / nullif(count(*), 0)
  )::integer into v_progress
  from public.work_orders
  where production_job_id = v_laser.production_job_id
    and is_active is true;

  update public.production_jobs
  set current_department = 'Design',
      status = 'In Progress',
      progress_percent = coalesce(v_progress, 0),
      completed_at = null,
      is_active = true
  where id = v_laser.production_job_id;

  if v_customer_order_id is not null then
    update public.customer_orders
    set status = 'In Design',
        design_status = 'In Design',
        design_notes = concat_ws(E'\n', nullif(design_notes, ''), v_note),
        updated_at = now()
    where id = v_customer_order_id;
  end if;

  insert into public.work_order_activity (
    work_order_id, production_job_id, event_type, from_status, to_status,
    from_department, to_department, actor, notes
  ) values (
    v_laser.id, v_laser.production_job_id, 'Returned to Design',
    v_laser.status, 'Pending', 'Laser', 'Design',
    nullif(trim(coalesce(p_actor, '')), ''), trim(p_reason)
  );

  insert into public.work_order_activity (
    work_order_id, production_job_id, event_type, from_status, to_status,
    from_department, to_department, actor, notes
  ) values (
    v_design.id, v_design.production_job_id, 'Reopened',
    v_design_before_status, 'Ready', 'Design', 'Design',
    nullif(trim(coalesce(p_actor, '')), ''), trim(p_reason)
  );

  return jsonb_build_object(
    'production_job_id', v_laser.production_job_id,
    'design_work_order_id', v_design.id,
    'laser_work_order_id', v_laser.id,
    'current_department', 'Design',
    'progress_percent', coalesce(v_progress, 0)
  );
end;
$$;

revoke execute on function public.mw_return_laser_to_design(bigint, text, text) from public, anon;
grant execute on function public.mw_return_laser_to_design(bigint, text, text) to authenticated;
