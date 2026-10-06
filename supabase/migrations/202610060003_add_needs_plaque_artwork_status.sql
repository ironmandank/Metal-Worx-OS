create or replace function public.mw_set_artwork_workflow_status(
  p_work_order_id bigint,
  p_workflow_status text,
  p_actor text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_work public.work_orders%rowtype;
  v_order_status text;
  v_method text;
  v_complete boolean := false;
  v_work_status text;
  v_is_admin boolean;
begin
  select exists (
    select 1 from public.employee_profiles
    where auth_user_id = (select auth.uid())
      and is_active is true
      and lower(coalesce(access_level, '')) like '%admin%'
  ) into v_is_admin;
  if not v_is_admin then raise exception 'Administrator access is required to change artwork workflow status.'; end if;

  if p_workflow_status not in (
    'Ready', 'In Progress', 'Needs Plaque', 'Blocked', 'Awaiting Customer Approval',
    'Waiting for Customer Pickup', 'Ready to Ship',
    'Completed — Picked Up', 'Completed — Shipped'
  ) then
    raise exception 'Choose a valid artwork status.';
  end if;

  select * into v_work from public.work_orders
  where id = p_work_order_id and is_active is true
  for update;
  if not found then raise exception 'This artwork job is no longer active. Refresh the workflow.'; end if;
  if p_workflow_status = 'Blocked' and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Enter the reason this artwork is blocked.';
  end if;

  if p_workflow_status in ('Ready', 'In Progress', 'Needs Plaque', 'Blocked') then
    v_work_status := p_workflow_status;
    update public.work_orders set
      status = v_work_status,
      started_at = case when v_work_status = 'In Progress' then coalesce(started_at, now()) when v_work_status = 'Ready' then null else started_at end,
      blocked_reason = case when v_work_status = 'Blocked' then trim(p_note) else null end,
      assigned_to = case when v_work_status = 'In Progress' then coalesce(assigned_to, nullif(trim(p_actor), '')) else assigned_to end
    where id = v_work.id;
  elsif p_workflow_status = 'Awaiting Customer Approval' then
    if v_work.department <> 'Design' then raise exception 'Customer Approval is available while artwork is in Design.'; end if;
    update public.customer_orders set status = 'Awaiting Customer Approval', design_status = 'Awaiting Customer Approval', updated_at = now()
    where id = v_work.customer_order_id;
  else
    v_complete := p_workflow_status like 'Completed%';
    v_method := case when p_workflow_status in ('Waiting for Customer Pickup', 'Completed — Picked Up') then 'Pickup' else 'Shipping' end;
    v_order_status := case
      when v_complete then 'Completed'
      when p_workflow_status = 'Waiting for Customer Pickup' then 'Ready for Pickup'
      else 'Ready to Ship'
    end;

    update public.work_orders set status = 'Completed', completed_at = coalesce(completed_at, now()), blocked_reason = null
    where production_job_id = v_work.production_job_id and is_active is true;
    update public.production_jobs set status = 'Completed', current_department = 'Final QC / Showroom', progress_percent = 100, completed_at = coalesce(completed_at, now())
    where id = v_work.production_job_id;
    update public.customer_orders set
      status = v_order_status,
      fulfillment_method = v_method,
      fulfillment_completed = v_complete,
      fulfilled_at = case when v_complete then now() else null end,
      updated_at = now()
    where id = v_work.customer_order_id;
  end if;

  insert into public.work_order_activity (
    work_order_id, production_job_id, event_type, from_status, to_status,
    from_department, to_department, actor, notes
  ) values (
    v_work.id, v_work.production_job_id, 'Artwork Status Changed', v_work.status,
    coalesce(v_work_status, p_workflow_status), v_work.department, v_work.department,
    nullif(trim(coalesce(p_actor, '')), ''), nullif(trim(coalesce(p_note, '')), '')
  );

  return jsonb_build_object('work_order_id', v_work.id, 'workflow_status', p_workflow_status);
end;
$$;

revoke execute on function public.mw_set_artwork_workflow_status(bigint, text, text, text) from public, anon;
grant execute on function public.mw_set_artwork_workflow_status(bigint, text, text, text) to authenticated;
