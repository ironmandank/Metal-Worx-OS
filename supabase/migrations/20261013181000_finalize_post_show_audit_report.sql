alter table public.show_events
  add column if not exists audit_finalized_at timestamptz,
  add column if not exists audit_finalized_by text;

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

  with audited_sales as (
    select
      movement.inventory_item_id,
      movement.bin_id,
      sum(abs(movement.quantity_change)) as sold_quantity
    from public.inventory_movements movement
    where movement.reference_id = p_show_event_id
      and movement.operation = 'remove'
      and movement.reference_type in ('Post-Show Crate Audit', 'Post-Show Location Review')
    group by movement.inventory_item_id, movement.bin_id
  )
  update public.show_inventory_snapshots snapshot
  set
    actual_return_quantity = greatest(0, snapshot.expected_quantity - coalesce(audited.sold_quantity, 0)),
    variance_quantity = -least(snapshot.expected_quantity, coalesce(audited.sold_quantity, 0)),
    reconciliation_reason = case
      when coalesce(audited.sold_quantity, 0) > 0 then 'Sold at show - confirmed by post-show crate audit'
      else 'Post-show crate audit matched'
    end,
    reconciliation_notes = 'Final quantity confirmed from the completed crate-by-crate post-show audit.',
    reconciled_at = now(),
    reconciled_by = nullif(trim(coalesce(p_finalized_by, '')), '')
  from (
    select snapshot_row.id, audited_sales.sold_quantity
    from public.show_inventory_snapshots snapshot_row
    left join audited_sales
      on audited_sales.inventory_item_id = snapshot_row.inventory_item_id
     and audited_sales.bin_id = snapshot_row.bin_id
    where snapshot_row.show_event_id = p_show_event_id
  ) audited
  where snapshot.id = audited.id;

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

create or replace view public.show_product_performance
with (security_invoker = true)
as
with inventory as (
  select
    snapshot.show_event_id,
    snapshot.inventory_item_id,
    max(snapshot.item_number) as item_number,
    max(snapshot.item_name) as item_name,
    sum(snapshot.starting_quantity) as starting_quantity,
    sum(snapshot.expected_quantity) as expected_ending_quantity,
    sum(coalesce(snapshot.actual_return_quantity, snapshot.expected_quantity)) as actual_ending_quantity
  from public.show_inventory_snapshots snapshot
  group by snapshot.show_event_id, snapshot.inventory_item_id
), recorded_sales as (
  select
    sale_item.show_event_id,
    sale_item.inventory_item_id,
    sum(sale_item.quantity) as units_sold,
    sum(sale_item.line_total) as product_revenue
  from public.show_sale_items sale_item
  join public.show_sales sale
    on sale.id = sale_item.show_sale_id
   and sale.sale_status = 'Completed'
  group by sale_item.show_event_id, sale_item.inventory_item_id
)
select
  inventory.show_event_id,
  inventory.inventory_item_id,
  inventory.item_number,
  inventory.item_name,
  inventory.starting_quantity,
  greatest(inventory.starting_quantity - inventory.actual_ending_quantity, 0) as units_sold,
  inventory.expected_ending_quantity,
  inventory.actual_ending_quantity,
  coalesce(recorded_sales.product_revenue, 0)
    + greatest(
        greatest(inventory.starting_quantity - inventory.actual_ending_quantity, 0)
          - coalesce(recorded_sales.units_sold, 0),
        0
      ) * coalesce(item.show_price, item.selling_price, 0) as product_revenue,
  case
    when inventory.starting_quantity > 0 then round(
      greatest(inventory.starting_quantity - inventory.actual_ending_quantity, 0)
        / inventory.starting_quantity * 100,
      2
    )
    else 0
  end as sell_through_percent
from inventory
left join recorded_sales
  on recorded_sales.show_event_id = inventory.show_event_id
 and recorded_sales.inventory_item_id = inventory.inventory_item_id
left join public.inventory_items item
  on item.id = inventory.inventory_item_id;

grant select on public.show_product_performance to authenticated;

create or replace view public.show_event_summary
with (security_invoker = true)
as
select
  event.id as show_event_id,
  event.event_name,
  event.event_code,
  event.venue_name,
  event.city,
  event.state,
  event.start_date,
  event.end_date,
  event.status,
  event.starting_cash,
  event.started_at,
  event.started_by,
  event.closed_at,
  event.closed_by,
  coalesce(inventory.inventory_positions, 0) as inventory_positions,
  coalesce(inventory.starting_units, 0) as starting_units,
  coalesce(inventory.expected_ending_units, 0) as expected_ending_units,
  coalesce(inventory.actual_ending_units, 0) as actual_ending_units,
  coalesce(inventory.variance_units, 0) as variance_units,
  coalesce(sales.completed_sales, 0) as completed_sales,
  coalesce(sales.voided_sales, 0) as voided_sales,
  coalesce(sales.refunded_sales, 0) as refunded_sales,
  coalesce(sales.gross_sales, 0) as gross_sales,
  coalesce(sales.discount_total, 0) as discount_total,
  coalesce(sales.tax_total, 0) as tax_total,
  coalesce(sales.average_sale, 0) as average_sale,
  coalesce(products.units_sold, 0) as units_sold,
  coalesce(products.product_sales, 0) as product_sales,
  coalesce(payments.cash_payments, 0) as cash_payments,
  coalesce(payments.card_payments, 0) as card_payments,
  coalesce(payments.digital_payments, 0) as digital_payments,
  coalesce(payments.other_payments, 0) as other_payments,
  coalesce(adjustments.damaged_units, 0) as damaged_units,
  coalesce(adjustments.missing_units, 0) as missing_units,
  coalesce(adjustments.giveaway_units, 0) as giveaway_units,
  coalesce(adjustments.adjustment_units, 0) as adjustment_units,
  event.audit_finalized_at,
  event.audit_finalized_by
from public.show_events event
left join lateral (
  select count(*) as inventory_positions,
    coalesce(sum(snapshot.starting_quantity), 0) as starting_units,
    coalesce(sum(snapshot.expected_quantity), 0) as expected_ending_units,
    coalesce(sum(coalesce(snapshot.actual_return_quantity, snapshot.expected_quantity)), 0) as actual_ending_units,
    coalesce(sum(snapshot.variance_quantity), 0) as variance_units
  from public.show_inventory_snapshots snapshot
  where snapshot.show_event_id = event.id
) inventory on true
left join lateral (
  select
    count(*) filter (where sale.sale_status = 'Completed') as completed_sales,
    count(*) filter (where sale.sale_status = 'Voided') as voided_sales,
    count(*) filter (where sale.sale_status = 'Refunded') as refunded_sales,
    coalesce(sum(sale.total_amount) filter (where sale.sale_status = 'Completed'), 0) as gross_sales,
    coalesce(sum(sale.discount_amount) filter (where sale.sale_status = 'Completed'), 0) as discount_total,
    coalesce(sum(sale.tax_amount) filter (where sale.sale_status = 'Completed'), 0) as tax_total,
    coalesce(avg(sale.total_amount) filter (where sale.sale_status = 'Completed'), 0) as average_sale
  from public.show_sales sale
  where sale.show_event_id = event.id
) sales on true
left join lateral (
  select coalesce(sum(performance.units_sold), 0) as units_sold,
    coalesce(sum(performance.product_revenue), 0) as product_sales
  from public.show_product_performance performance
  where performance.show_event_id = event.id
) products on true
left join lateral (
  select
    coalesce(sum(payment.amount) filter (where payment.payment_method = 'Cash'), 0) as cash_payments,
    coalesce(sum(payment.amount) filter (where payment.payment_method in ('Credit Card', 'Debit Card', 'Square')), 0) as card_payments,
    coalesce(sum(payment.amount) filter (where payment.payment_method in ('Venmo', 'PayPal')), 0) as digital_payments,
    coalesce(sum(payment.amount) filter (where payment.payment_method not in ('Cash', 'Credit Card', 'Debit Card', 'Square', 'Venmo', 'PayPal')), 0) as other_payments
  from public.show_sale_payments payment
  join public.show_sales sale on sale.id = payment.show_sale_id and sale.sale_status = 'Completed'
  where sale.show_event_id = event.id
) payments on true
left join lateral (
  select
    coalesce(sum(adjustment.quantity) filter (where adjustment.adjustment_type = 'Damaged'), 0) as damaged_units,
    coalesce(sum(adjustment.quantity) filter (where adjustment.adjustment_type = 'Missing'), 0) as missing_units,
    coalesce(sum(adjustment.quantity) filter (where adjustment.adjustment_type = 'Giveaway'), 0) as giveaway_units,
    coalesce(sum(adjustment.quantity), 0) as adjustment_units
  from public.show_inventory_adjustments adjustment
  where adjustment.show_event_id = event.id
) adjustments on true;

grant select on public.show_event_summary to authenticated;
