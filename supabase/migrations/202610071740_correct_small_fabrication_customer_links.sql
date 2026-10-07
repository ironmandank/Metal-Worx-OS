update public.customer_orders
set customer_id = null,
    artwork_customer_name = 'Customer name needs review',
    updated_at = now()
where id between 40 and 45
  and order_type = 'Small Fabrication'
  and customer_id = 21;

update public.production_jobs
set customer_id = null
where customer_order_id between 40 and 45
  and customer_id = 21;

update public.work_orders
set customer_id = null
where customer_order_id between 40 and 45
  and customer_id = 21;
