create or replace function public.mw_start_inventory_reset(
  p_name text,
  p_started_by text default null
)
returns public.inventory_reset_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.inventory_reset_sessions%rowtype;
  v_snapshot jsonb;
begin
  if auth.uid() is null or not public.mw_calendar_is_active_employee() then
    raise exception 'An active employee account is required.';
  end if;

  if exists (
    select 1 from public.inventory_reset_sessions where status = 'In Progress'
  ) then
    raise exception 'An inventory reset is already in progress.';
  end if;

  select jsonb_build_object(
    'captured_at', now(),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.name)
      from public.inventory_items i
      where i.is_active is true
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.name)
      from public.inventory_locations l
    ), '[]'::jsonb),
    'bins', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.code)
      from public.inventory_bins b
    ), '[]'::jsonb),
    'stock', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.inventory_item_id, s.bin_id)
      from public.inventory_stock s
    ), '[]'::jsonb)
  ) into v_snapshot;

  insert into public.inventory_reset_sessions (
    name,
    started_by,
    started_by_user_id,
    snapshot,
    snapshot_item_count,
    snapshot_position_count
  )
  select
    coalesce(nullif(trim(p_name), ''), 'Inventory Reset ' || to_char(current_date, 'Mon DD, YYYY')),
    nullif(trim(coalesce(p_started_by, '')), ''),
    auth.uid(),
    v_snapshot,
    (select count(*) from public.inventory_items where is_active is true),
    (select count(*) from public.inventory_stock where quantity_on_hand <> 0)
  returning * into v_session;

  insert into public.inventory_movements (
    inventory_item_id,
    bin_id,
    movement_type,
    operation,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    notes,
    reference_type,
    reference_id,
    reference_number,
    performed_by,
    performed_by_user_id
  )
  select
    stock.inventory_item_id,
    stock.bin_id,
    'Physical Count',
    'set',
    -stock.quantity_on_hand,
    stock.quantity_on_hand,
    0,
    'Inventory reset started',
    'Previous values retained in the dated inventory reset backup.',
    'Inventory Reset',
    v_session.id,
    v_session.name,
    nullif(trim(coalesce(p_started_by, '')), ''),
    auth.uid()
  from public.inventory_stock stock
  where stock.quantity_on_hand <> 0;

  update public.inventory_stock
  set
    quantity_on_hand = 0,
    quantity_reserved = 0,
    quantity_quarantined = 0,
    last_counted_quantity = 0,
    last_counted_at = now(),
    last_movement_at = now(),
    updated_at = now();

  update public.inventory_items
  set default_bin_id = null, updated_at = now()
  where is_active is true;

  return v_session;
end;
$$;

