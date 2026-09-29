create table if not exists public.inventory_reset_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'In Progress'
    check (status in ('In Progress', 'Completed', 'Cancelled')),
  started_by text,
  started_by_user_id uuid default auth.uid(),
  snapshot jsonb not null default '{}'::jsonb,
  snapshot_item_count integer not null default 0,
  snapshot_position_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.inventory_reset_counts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_reset_sessions(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  bin_id uuid not null references public.inventory_bins(id),
  quantity numeric(18, 4) not null check (quantity >= 0),
  notes text,
  counted_by text,
  counted_by_user_id uuid default auth.uid(),
  counted_at timestamptz not null default now(),
  unique (session_id, inventory_item_id)
);

create index if not exists inventory_reset_sessions_created_at_idx
  on public.inventory_reset_sessions (created_at desc);

create index if not exists inventory_reset_counts_session_idx
  on public.inventory_reset_counts (session_id, counted_at desc);

alter table public.inventory_reset_sessions enable row level security;
alter table public.inventory_reset_counts enable row level security;

drop policy if exists "Active employees can view inventory resets" on public.inventory_reset_sessions;
create policy "Active employees can view inventory resets"
  on public.inventory_reset_sessions for select
  to authenticated
  using ((select public.mw_calendar_is_active_employee()));

drop policy if exists "Active employees can view inventory reset counts" on public.inventory_reset_counts;
create policy "Active employees can view inventory reset counts"
  on public.inventory_reset_counts for select
  to authenticated
  using ((select public.mw_calendar_is_active_employee()));

revoke all on table public.inventory_reset_sessions from anon;
revoke all on table public.inventory_reset_counts from anon;
grant select on table public.inventory_reset_sessions to authenticated;
grant select on table public.inventory_reset_counts to authenticated;

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
    updated_at = now()
  where id is not null;

  update public.inventory_items
  set default_bin_id = null, updated_at = now()
  where is_active is true;

  return v_session;
end;
$$;

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
  v_stock record;
  v_result jsonb;
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

  for v_stock in
    select bin_id, quantity_on_hand
    from public.inventory_stock
    where inventory_item_id = p_inventory_item_id
      and bin_id <> p_bin_id
      and quantity_on_hand <> 0
  loop
    perform public.mw_adjust_inventory_quantity(
      p_inventory_item_id,
      v_stock.bin_id,
      'set',
      0,
      'Inventory reset relocation',
      'Moved during ' || v_session.name,
      'Inventory Reset',
      p_session_id,
      v_session.name,
      p_counted_by
    );
  end loop;

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
  set default_bin_id = p_bin_id, updated_at = now()
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
  on conflict (session_id, inventory_item_id)
  do update set
    bin_id = excluded.bin_id,
    quantity = excluded.quantity,
    notes = excluded.notes,
    counted_by = excluded.counted_by,
    counted_by_user_id = excluded.counted_by_user_id,
    counted_at = excluded.counted_at;

  return v_result || jsonb_build_object('session_id', p_session_id);
end;
$$;

create or replace function public.mw_complete_inventory_reset(p_session_id uuid)
returns public.inventory_reset_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.inventory_reset_sessions%rowtype;
begin
  if auth.uid() is null or not public.mw_calendar_is_active_employee() then
    raise exception 'An active employee account is required.';
  end if;

  update public.inventory_reset_sessions
  set status = 'Completed', completed_at = now()
  where id = p_session_id and status = 'In Progress'
  returning * into v_session;

  if not found then
    raise exception 'The active inventory reset could not be found.';
  end if;

  return v_session;
end;
$$;

revoke all on function public.mw_start_inventory_reset(text, text) from public, anon;
revoke all on function public.mw_save_inventory_reset_count(uuid, uuid, uuid, numeric, text, text) from public, anon;
revoke all on function public.mw_complete_inventory_reset(uuid) from public, anon;
grant execute on function public.mw_start_inventory_reset(text, text) to authenticated;
grant execute on function public.mw_save_inventory_reset_count(uuid, uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.mw_complete_inventory_reset(uuid) to authenticated;
