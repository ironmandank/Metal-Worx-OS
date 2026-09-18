alter table public.customer_orders
  add column if not exists show_on_huddle boolean not null default false;

comment on column public.customer_orders.show_on_huddle is
  'Manually includes an undated artwork order in the Hot Items This Week TV Huddle list.';
