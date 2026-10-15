alter table public.customer_orders
  add column if not exists sales_history_hidden boolean not null default false,
  add column if not exists sales_history_hidden_at timestamptz,
  add column if not exists sales_history_hidden_by text;

comment on column public.customer_orders.sales_history_hidden is
  'Reversibly removes duplicate or unwanted completed orders from the normal Sales History view without deleting the order.';
