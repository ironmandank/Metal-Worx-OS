do $$
declare
  v_from_bin_id constant uuid := 'ca804e1b-7cf2-48b8-b608-aeaa88657972';
  v_to_bin_id constant uuid := 'abfb9a49-d4bc-4769-8566-d61af5b75e4c';
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
        'Corrected crate assignment',
        'Merged CR-01 inventory into LG-04.',
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
        'Corrected crate assignment',
        'Merged CR-01 inventory into LG-04.',
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
      description = trim(both from concat_ws(' ', description, 'Retired: inventory merged into LG-04.')),
      updated_at = now()
  where id = v_from_bin_id;
end;
$$;
