alter table public.customer_orders
  add column if not exists artwork_customer_name text;

comment on column public.customer_orders.artwork_customer_name is
  'Order-specific display name for artwork workflow; does not create or modify a customer contact.';
