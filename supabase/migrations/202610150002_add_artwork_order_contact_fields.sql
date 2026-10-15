alter table public.customer_orders
  add column if not exists artwork_customer_phone text,
  add column if not exists artwork_customer_email text;

comment on column public.customer_orders.artwork_customer_phone is
  'Order-specific contact phone for artwork and small fabrication jobs.';

comment on column public.customer_orders.artwork_customer_email is
  'Order-specific contact email for artwork and small fabrication jobs.';

-- Only copy legacy contact details when the order display name exactly matches
-- the linked customer. This avoids carrying an incorrectly linked customer''s
-- contact information onto an unrelated artwork order.
update public.customer_orders as orders
set
  artwork_customer_phone = customers.phone,
  artwork_customer_email = customers.email
from public.customers as customers
where orders.customer_id = customers.id
  and nullif(trim(orders.artwork_customer_name), '') is not null
  and lower(trim(orders.artwork_customer_name)) = lower(trim(concat_ws(' ', customers.first_name, customers.last_name)))
  and (orders.artwork_customer_phone is null or orders.artwork_customer_email is null);
