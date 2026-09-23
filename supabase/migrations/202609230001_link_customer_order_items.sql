-- Allow PostgREST/Supabase nested order queries to discover the
-- customer_orders -> customer_order_items relationship.
alter table public.customer_order_items
  add constraint customer_order_items_order_id_fkey
  foreign key (order_id)
  references public.customer_orders(id)
  on delete cascade;

notify pgrst, 'reload schema';
