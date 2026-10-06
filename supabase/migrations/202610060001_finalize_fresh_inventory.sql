create or replace function public.mw_finalize_inventory_reset(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived_items integer := 0;
  v_archived_bins integer := 0;
  v_active_items integer := 0;
  v_active_bins integer := 0;
begin
  if auth.uid() is null or not public.mw_calendar_is_active_employee() then
    raise exception 'Only an active employee can finalize an inventory reset.';
  end if;

  perform 1
  from public.inventory_reset_sessions
  where id = p_session_id and status = 'In Progress'
  for update;

  if not found then
    raise exception 'The active inventory reset could not be found.';
  end if;

  update public.inventory_items i
  set is_active = false,
      available_for_show_sales = false,
      default_bin_id = null,
      updated_at = now()
  where i.is_active = true
    and not exists (
      select 1
      from public.inventory_stock s
      where s.inventory_item_id = i.id
        and s.quantity_on_hand > 0
    );
  get diagnostics v_archived_items = row_count;

  update public.inventory_bins b
  set is_active = false,
      updated_at = now()
  where b.is_active = true
    and (upper(b.code) like 'CR-%' or upper(b.code) like 'LG-%')
    and not exists (
      select 1
      from public.inventory_stock s
      where s.bin_id = b.id
        and s.quantity_on_hand > 0
    );
  get diagnostics v_archived_bins = row_count;

  update public.inventory_reset_sessions
  set status = 'Completed', completed_at = now()
  where id = p_session_id;

  select count(*) into v_active_items
  from public.inventory_items
  where is_active = true;

  select count(*) into v_active_bins
  from public.inventory_bins
  where is_active = true;

  return jsonb_build_object(
    'active_item_count', v_active_items,
    'archived_item_count', v_archived_items,
    'active_bin_count', v_active_bins,
    'archived_bin_count', v_archived_bins
  );
end;
$$;

revoke all on function public.mw_finalize_inventory_reset(uuid) from public, anon;
grant execute on function public.mw_finalize_inventory_reset(uuid) to authenticated;
