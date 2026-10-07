do $$
declare
  v_from_bin_id constant uuid := '3aa5eea5-1fa0-4fbf-98bf-704ea6e2a67c';
  v_to_bin_id constant uuid := 'cc68486c-82f9-48b1-aa59-907f805c0604';
  v_stock record;
  v_destination_before numeric;
begin
  for v_stock in
    select inventory_item_id, quantity_on_hand
    from public.inventory_stock
    where bin_id = v_from_bin_id
      and quantity_on_hand > 0
    for update
  loop
    select quantity_on_hand
    into v_destination_before
    from public.inventory_stock
    where inventory_item_id = v_stock.inventory_item_id
      and bin_id = v_to_bin_id
    for update;

    if not found then
      v_destination_before := 0;

      insert into public.inventory_stock (
        inventory_item_id,
        bin_id,
        quantity_on_hand,
        last_movement_at
      ) values (
        v_stock.inventory_item_id,
        v_to_bin_id,
        v_stock.quantity_on_hand,
        now()
      );
    else
      update public.inventory_stock
      set quantity_on_hand = quantity_on_hand + v_stock.quantity_on_hand,
          last_movement_at = now(),
          updated_at = now()
      where inventory_item_id = v_stock.inventory_item_id
        and bin_id = v_to_bin_id;
    end if;

    update public.inventory_stock
    set quantity_on_hand = 0,
        last_movement_at = now(),
        updated_at = now()
    where inventory_item_id = v_stock.inventory_item_id
      and bin_id = v_from_bin_id;

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
      performed_by
    ) values
      (
        v_stock.inventory_item_id,
        v_from_bin_id,
        'Adjustment Remove',
        'remove',
        -v_stock.quantity_on_hand,
        v_stock.quantity_on_hand,
        0,
        'Corrected duplicate crate code',
        'Merged incorrect CR-06 into LG-06 Flowers and Spades.',
        'Inventory Location Correction',
        'Codex'
      ),
      (
        v_stock.inventory_item_id,
        v_to_bin_id,
        'Adjustment Add',
        'add',
        v_stock.quantity_on_hand,
        v_destination_before,
        v_destination_before + v_stock.quantity_on_hand,
        'Corrected duplicate crate code',
        'Merged incorrect CR-06 into LG-06 Flowers and Spades.',
        'Inventory Location Correction',
        'Codex'
      );
  end loop;

  update public.inventory_items
  set default_bin_id = v_to_bin_id,
      updated_at = now()
  where default_bin_id = v_from_bin_id;

  update public.inventory_bins
  set is_active = false,
      description = trim(both from concat_ws(' ', description, 'Retired: duplicate of LG-06 Flowers and Spades.')),
      updated_at = now()
  where id = v_from_bin_id;
end;
$$;
