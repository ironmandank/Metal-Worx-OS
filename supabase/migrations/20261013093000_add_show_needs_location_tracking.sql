alter table public.show_inventory_snapshots
  add column if not exists needs_location boolean not null default false,
  add column if not exists location_quantity numeric(14,4) not null default 0,
  add column if not exists location_flagged_at timestamptz,
  add column if not exists location_flagged_by text,
  add column if not exists location_resolution text,
  add column if not exists relocated_bin_id uuid references public.inventory_bins(id) on delete set null,
  add column if not exists location_resolved_at timestamptz,
  add column if not exists location_resolved_by text;

create index if not exists idx_show_inventory_snapshots_needs_location
  on public.show_inventory_snapshots (show_event_id, needs_location)
  where needs_location = true;

create index if not exists idx_show_inventory_snapshots_relocated_bin
  on public.show_inventory_snapshots (relocated_bin_id)
  where relocated_bin_id is not null;

comment on column public.show_inventory_snapshots.needs_location is
  'True when inventory is believed to exist but was not in its recorded crate during the post-show audit.';

comment on column public.show_inventory_snapshots.location_quantity is
  'Quantity temporarily held for location review instead of being recorded as sold.';
