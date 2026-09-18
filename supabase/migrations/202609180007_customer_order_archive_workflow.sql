alter table public.customer_orders
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text,
  add column if not exists archive_reason text,
  add column if not exists archive_previous_status text;

create index if not exists customer_orders_archived_at_idx
  on public.customer_orders (archived_at)
  where archived_at is not null;

comment on column public.customer_orders.archived_at is
  'When the order was removed from active workflow but retained for search and history.';
comment on column public.customer_orders.archive_reason is
  'Required operational reason for archiving an order.';

