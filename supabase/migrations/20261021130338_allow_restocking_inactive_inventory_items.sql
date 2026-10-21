CREATE OR REPLACE FUNCTION public.mw_adjust_inventory_quantity(p_inventory_item_id uuid, p_bin_id uuid, p_operation text, p_quantity numeric, p_reason text, p_notes text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_performed_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_stock inventory_stock%rowtype;
  v_item inventory_items%rowtype;
  v_operation text;
  v_quantity numeric(18, 4);
  v_quantity_before numeric(18, 4);
  v_quantity_after numeric(18, 4);
  v_quantity_change numeric(18, 4);
  v_movement_type text;
  v_movement_id uuid;
begin
  v_operation := lower(trim(coalesce(p_operation, '')));
  v_quantity := coalesce(p_quantity, 0);

  if p_inventory_item_id is null then
    raise exception 'Inventory item is required.';
  end if;

  if p_bin_id is null then
    raise exception 'Storage position is required.';
  end if;

  if v_operation not in ('add', 'remove', 'set', 'receive') then
    raise exception 'Operation must be add, remove, set, or receive.';
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'Adjustment reason is required.';
  end if;

  if v_operation in ('add', 'remove', 'receive') and v_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if v_operation = 'set' and v_quantity < 0 then
    raise exception 'Counted quantity cannot be negative.';
  end if;

  select *
  into v_item
  from inventory_items
  where id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item was not found.';
  end if;

  if not v_item.is_active and v_operation = 'remove' then
    raise exception 'Inactive inventory items cannot be reduced. Add stock or enter a positive count to reactivate the item.';
  end if;

  if not exists (
    select 1
    from inventory_bins
    where id = p_bin_id
      and is_active = true
  ) then
    raise exception 'Active storage position was not found.';
  end if;

  insert into inventory_stock (
    inventory_item_id,
    bin_id,
    quantity_on_hand,
    quantity_reserved,
    quantity_quarantined
  )
  values (
    p_inventory_item_id,
    p_bin_id,
    0,
    0,
    0
  )
  on conflict (inventory_item_id, bin_id)
  do nothing;

  select *
  into v_stock
  from inventory_stock
  where inventory_item_id = p_inventory_item_id
    and bin_id = p_bin_id
  for update;

  v_quantity_before := v_stock.quantity_on_hand;

  if v_operation in ('add', 'receive') then
    v_quantity_change := v_quantity;
    v_quantity_after := v_quantity_before + v_quantity;
  elsif v_operation = 'remove' then
    v_quantity_change := -v_quantity;
    v_quantity_after := v_quantity_before - v_quantity;
  else
    v_quantity_after := v_quantity;
    v_quantity_change := v_quantity_after - v_quantity_before;
  end if;

  if v_quantity_after < 0 then
    raise exception
      'This adjustment would create negative stock. Current quantity: %, requested removal: %.',
      v_quantity_before,
      v_quantity;
  end if;

  if v_quantity_after < (
    v_stock.quantity_reserved
    + v_stock.quantity_quarantined
  ) then
    raise exception
      'Quantity cannot be lower than the reserved and quarantined total of %.',
      (
        v_stock.quantity_reserved
        + v_stock.quantity_quarantined
      );
  end if;

  if v_operation = 'receive' then
    v_movement_type := 'Receipt';
  elsif v_operation = 'add' then
    v_movement_type := 'Adjustment Add';
  elsif v_operation = 'remove' then
    v_movement_type := 'Adjustment Remove';
  else
    v_movement_type := 'Physical Count';
  end if;

  update inventory_stock
  set
    quantity_on_hand = v_quantity_after,
    last_counted_quantity = case
      when v_operation = 'set'
        then v_quantity_after
      else last_counted_quantity
    end,
    last_counted_at = case
      when v_operation = 'set'
        then now()
      else last_counted_at
    end,
    last_received_at = case
      when v_operation = 'receive'
        then now()
      else last_received_at
    end,
    last_issued_at = case
      when v_operation = 'remove'
        then now()
      else last_issued_at
    end,
    last_movement_at = now(),
    updated_at = now()
  where id = v_stock.id;

  insert into inventory_movements (
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
  values (
    p_inventory_item_id,
    p_bin_id,
    v_movement_type,
    v_operation,
    v_quantity_change,
    v_quantity_before,
    v_quantity_after,
    trim(p_reason),
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_reference_type, '')), ''),
    p_reference_id,
    nullif(trim(coalesce(p_reference_number, '')), ''),
    nullif(trim(coalesce(p_performed_by, '')), ''),
    auth.uid()
  )
  returning id into v_movement_id;

  if not v_item.is_active and (
    v_operation in ('add', 'receive')
    or (v_operation = 'set' and v_quantity_after > 0)
  ) then
    update inventory_items
    set is_active = true,
        updated_at = now()
    where id = p_inventory_item_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'inventory_item_id', p_inventory_item_id,
    'bin_id', p_bin_id,
    'operation', v_operation,
    'movement_type', v_movement_type,
    'quantity_change', v_quantity_change,
    'quantity_before', v_quantity_before,
    'quantity_after', v_quantity_after
  );
end;
$function$
