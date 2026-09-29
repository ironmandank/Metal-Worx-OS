alter table public.inventory_reset_counts
  drop constraint if exists inventory_reset_counts_session_id_inventory_item_id_key;

alter table public.inventory_reset_counts
  add constraint inventory_reset_counts_session_item_bin_key
  unique (session_id, inventory_item_id, bin_id);

create or replace function public.mw_save_inventory_reset_count(
  p_session_id uuid,
  p_inventory_item_id uuid,
  p_bin_id uuid,
  p_quantity numeric,
  p_notes text default null,
  p_counted_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.inventory_reset_sessions%rowtype;
  v_result jsonb;
  v_item_total numeric;
begin
  if auth.uid() is null or not public.mw_calendar_is_active_employee() then
    raise exception 'An active employee account is required.';
  end if;

  select * into v_session
  from public.inventory_reset_sessions
  where id = p_session_id and status = 'In Progress'
  for update;

  if not found then
    raise exception 'The active inventory reset could not be found.';
  end if;

  if coalesce(p_quantity, -1) < 0 then
    raise exception 'Physical quantity cannot be negative.';
  end if;

  v_result := public.mw_adjust_inventory_quantity(
    p_inventory_item_id,
    p_bin_id,
    'set',
    p_quantity,
    'Inventory reset count',
    nullif(trim(coalesce(p_notes, '')), ''),
    'Inventory Reset',
    p_session_id,
    v_session.name,
    p_counted_by
  );

  update public.inventory_items
  set default_bin_id = coalesce(default_bin_id, p_bin_id), updated_at = now()
  where id = p_inventory_item_id;

  insert into public.inventory_reset_counts (
    session_id,
    inventory_item_id,
    bin_id,
    quantity,
    notes,
    counted_by,
    counted_by_user_id,
    counted_at
  ) values (
    p_session_id,
    p_inventory_item_id,
    p_bin_id,
    p_quantity,
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_counted_by, '')), ''),
    auth.uid(),
    now()
  )
  on conflict (session_id, inventory_item_id, bin_id)
  do update set
    quantity = excluded.quantity,
    notes = excluded.notes,
    counted_by = excluded.counted_by,
    counted_by_user_id = excluded.counted_by_user_id,
    counted_at = excluded.counted_at;

  select coalesce(sum(quantity), 0)
  into v_item_total
  from public.inventory_reset_counts
  where session_id = p_session_id
    and inventory_item_id = p_inventory_item_id;

  return v_result || jsonb_build_object(
    'session_id', p_session_id,
    'item_total', v_item_total
  );
end;
$$;

revoke all on function public.mw_save_inventory_reset_count(uuid, uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.mw_save_inventory_reset_count(uuid, uuid, uuid, numeric, text, text) to authenticated;
