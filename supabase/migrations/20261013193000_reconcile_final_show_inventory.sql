create or replace function public.mw_finalize_post_show_audit(
  p_show_event_id uuid,
  p_finalized_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event public.show_events%rowtype;
  v_unresolved integer;
  v_positions integer;
  v_units_sold numeric(14,4);
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to finalize a show audit.';
  end if;

  select * into v_event
  from public.show_events
  where id = p_show_event_id
  for update;

  if not found then
    raise exception 'Show event was not found.';
  end if;

  if v_event.status <> 'Closed' then
    raise exception 'Close the show before finalizing its post-show audit.';
  end if;

  select count(*) into v_unresolved
  from public.show_inventory_snapshots
  where show_event_id = p_show_event_id
    and needs_location;

  if v_unresolved > 0 then
    raise exception 'Resolve all % Needs Location item(s) before finalizing.', v_unresolved;
  end if;

  -- Freeze the actual physical inventory at finalization. This includes every
  -- crate-audit adjustment, transfer, location resolution, and found item.
  update public.show_inventory_snapshots snapshot
  set
    actual_return_quantity = coalesce((
      select balance.quantity_on_hand
      from public.inventory_bin_balances balance
      where balance.inventory_item_id = snapshot.inventory_item_id
        and balance.bin_id = snapshot.bin_id
        and balance.quantity_on_hand > 0
    ), 0),
    variance_quantity = coalesce((
      select balance.quantity_on_hand
      from public.inventory_bin_balances balance
      where balance.inventory_item_id = snapshot.inventory_item_id
        and balance.bin_id = snapshot.bin_id
        and balance.quantity_on_hand > 0
    ), 0) - snapshot.starting_quantity,
    reconciliation_reason = 'Final physical quantity from completed post-show audit',
    reconciliation_notes = 'Frozen from live crate inventory after all audit adjustments and transfers.',
    reconciled_at = now(),
    reconciled_by = nullif(trim(coalesce(p_finalized_by, '')), '')
  where snapshot.show_event_id = p_show_event_id;

  insert into public.show_inventory_snapshots (
    show_event_id,
    inventory_item_id,
    bin_id,
    item_number,
    item_name,
    bin_code,
    starting_quantity,
    expected_quantity,
    actual_return_quantity,
    variance_quantity,
    reconciliation_reason,
    reconciliation_notes,
    reconciled_at,
    reconciled_by
  )
  select
    p_show_event_id,
    balance.inventory_item_id,
    balance.bin_id,
    balance.item_number,
    balance.item_name,
    balance.bin_code,
    0,
    0,
    balance.quantity_on_hand,
    balance.quantity_on_hand,
    'Found or relocated during post-show audit',
    'Added to the frozen final inventory after the crate-by-crate audit.',
    now(),
    nullif(trim(coalesce(p_finalized_by, '')), '')
  from public.inventory_bin_balances balance
  where balance.quantity_on_hand > 0
    and (balance.bin_code ilike 'CR-%' or balance.bin_code ilike 'LG-%')
    and not exists (
      select 1
      from public.show_inventory_snapshots snapshot
      where snapshot.show_event_id = p_show_event_id
        and snapshot.inventory_item_id = balance.inventory_item_id
        and snapshot.bin_id = balance.bin_id
    );

  update public.show_events
  set
    audit_finalized_at = now(),
    audit_finalized_by = nullif(trim(coalesce(p_finalized_by, '')), ''),
    updated_at = now()
  where id = p_show_event_id;

  select
    count(*),
    coalesce(sum(greatest(starting_quantity - coalesce(actual_return_quantity, expected_quantity), 0)), 0)
  into v_positions, v_units_sold
  from public.show_inventory_snapshots
  where show_event_id = p_show_event_id;

  return jsonb_build_object(
    'success', true,
    'show_event_id', p_show_event_id,
    'event_name', v_event.event_name,
    'counted_positions', v_positions,
    'units_sold', v_units_sold,
    'audit_finalized_at', now()
  );
end;
$function$;

revoke all on function public.mw_finalize_post_show_audit(uuid, text) from public, anon;
grant execute on function public.mw_finalize_post_show_audit(uuid, text) to authenticated;
