create or replace function public.mw_transfer_inventory_quantity(
  p_inventory_item_id uuid,
  p_from_bin_id uuid,
  p_to_bin_id uuid,
  p_quantity numeric,
  p_notes text default null,
  p_performed_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remove jsonb;
  v_add jsonb;
begin
  if auth.uid() is null or not public.mw_calendar_is_active_employee() then
    raise exception 'An active employee account is required.';
  end if;

  if p_from_bin_id is null or p_to_bin_id is null then
    raise exception 'Both the current crate and destination crate are required.';
  end if;

  if p_from_bin_id = p_to_bin_id then
    raise exception 'Choose a different destination crate.';
  end if;

  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'Transfer quantity must be greater than zero.';
  end if;

  v_remove := public.mw_adjust_inventory_quantity(
    p_inventory_item_id, p_from_bin_id, 'remove', p_quantity,
    'Transferred to another crate', p_notes, 'Inventory Transfer', null, null, p_performed_by
  );

  v_add := public.mw_adjust_inventory_quantity(
    p_inventory_item_id, p_to_bin_id, 'add', p_quantity,
    'Transferred from another crate', p_notes, 'Inventory Transfer', null, null, p_performed_by
  );

  update public.inventory_items
  set default_bin_id = p_to_bin_id, updated_at = now()
  where id = p_inventory_item_id and default_bin_id = p_from_bin_id;

  return jsonb_build_object('success', true, 'from', v_remove, 'to', v_add);
end;
$$;

revoke all on function public.mw_transfer_inventory_quantity(uuid, uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.mw_transfer_inventory_quantity(uuid, uuid, uuid, numeric, text, text) to authenticated;
