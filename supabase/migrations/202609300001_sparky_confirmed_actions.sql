create or replace function public.mw_sparky_move_design_to_laser(
  p_design_work_order_id bigint,
  p_actor text,
  p_confirmation text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_design public.work_orders%rowtype;
  v_order public.customer_orders%rowtype;
  v_result jsonb;
  v_is_admin boolean;
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
    raise exception 'Administrator access is required to release artwork to Laser.';
  end if;

  if p_confirmation <> 'CONFIRM DESIGN TO LASER' then
    raise exception 'Review and confirm the Design to Laser action first.';
  end if;

  select * into v_design
  from public.work_orders
  where id = p_design_work_order_id
    and is_active is true
    and department = 'Design'
  for update;

  if not found then
    raise exception 'The linked Design work order was not found. Refresh Sparky and try again.';
  end if;

  if v_design.status not in ('Ready', 'In Progress') then
    raise exception 'This Design work order is currently %. It cannot be released to Laser.', v_design.status;
  end if;

  select * into v_order
  from public.customer_orders
  where id = v_design.customer_order_id
  for update;

  if found and coalesce(v_order.design_fee_required, false)
     and not coalesce(v_order.design_fee_paid, false)
     and coalesce(v_order.design_fee_status, '') <> 'Paid' then
    raise exception 'The required design fee is not recorded as paid.';
  end if;

  v_note := 'Sparky confirmed Design to Laser release by '
    || coalesce(nullif(trim(coalesce(p_actor, '')), ''), 'Administrator')
    || ' on ' || to_char(now(), 'Mon DD, YYYY at HH12:MI AM');

  if v_design.status = 'Ready' then
    perform public.mw_start_work_order_with_history(v_design.id, p_actor);
  end if;

  v_result := public.mw_complete_work_order_with_history(
    v_design.id,
    p_actor,
    'Customer approval and production check confirmed through Sparky. Released to Laser.'
  );

  if v_design.customer_order_id is not null then
    update public.customer_orders
    set design_status = 'Customer Approved',
        design_notes = concat_ws(E'\n', nullif(design_notes, ''), v_note),
        updated_at = now()
    where id = v_design.customer_order_id;
  end if;

  return v_result || jsonb_build_object(
    'design_work_order_id', v_design.id,
    'customer_order_id', v_design.customer_order_id,
    'production_job_id', v_design.production_job_id,
    'authorized_by', nullif(trim(coalesce(p_actor, '')), '')
  );
end;
$$;

revoke execute on function public.mw_sparky_move_design_to_laser(bigint, text, text) from public, anon;
grant execute on function public.mw_sparky_move_design_to_laser(bigint, text, text) to authenticated;

comment on function public.mw_sparky_move_design_to_laser(bigint, text, text) is
  'Administrator-confirmed Sparky action that atomically releases an eligible Design work order to Laser using the standard workflow and audit history.';
