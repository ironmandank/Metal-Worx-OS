create or replace function public.mw_add_business_days(
  p_start_date date,
  p_business_days integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_date date := p_start_date;
  v_added integer := 0;
begin
  if p_start_date is null then
    return null;
  end if;

  while v_added < greatest(coalesce(p_business_days, 0), 0) loop
    v_date := v_date + 1;
    if extract(isodow from v_date) < 6 then
      v_added := v_added + 1;
    end if;
  end loop;

  return v_date;
end;
$function$;

create or replace function public.mw_apply_artwork_laser_due_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order_type text;
  v_order_due_date date;
  v_job_due_date date;
  v_due_date date;
  v_laser_date date;
begin
  if new.department is distinct from 'Laser'
    or new.status is null
    or new.status not in ('Ready', 'In Progress', 'Blocked', 'Needs Plaque')
    or new.customer_order_id is null
    or new.production_job_id is null
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.department is not distinct from old.department
    and new.status is not distinct from old.status
    and new.station_entered_at is not distinct from old.station_entered_at
  then
    return new;
  end if;

  select
    lower(coalesce(o.order_type, '')),
    o.due_date,
    pj.due_date
  into
    v_order_type,
    v_order_due_date,
    v_job_due_date
  from public.customer_orders o
  join public.production_jobs pj
    on pj.id = new.production_job_id
    and pj.customer_order_id = o.id
  where o.id = new.customer_order_id
  for update of o, pj;

  if not found or v_order_type not like '%artwork%' then
    return new;
  end if;

  -- Keep an entered date; otherwise start 12 business days from the actual
  -- Laser station-entry timestamp. The day of arrival is day zero.
  v_due_date := coalesce(v_job_due_date, v_order_due_date);

  if v_due_date is null then
    v_laser_date := (new.station_entered_at at time zone 'America/New_York')::date;
    v_due_date := public.mw_add_business_days(v_laser_date, 12);
  end if;

  update public.production_jobs
  set due_date = coalesce(due_date, v_due_date)
  where id = new.production_job_id;

  update public.customer_orders
  set due_date = coalesce(due_date, v_due_date)
  where id = new.customer_order_id;

  return new;
end;
$function$;

revoke execute on function public.mw_add_business_days(date, integer) from public, anon, authenticated;
revoke execute on function public.mw_apply_artwork_laser_due_date() from public, anon, authenticated;

drop trigger if exists mw_apply_artwork_laser_due_date on public.work_orders;
create trigger mw_apply_artwork_laser_due_date
after insert or update of department, status, station_entered_at
on public.work_orders
for each row
execute function public.mw_apply_artwork_laser_due_date();

-- Backfill active artwork with a recorded Laser arrival and no entered due date.
-- Queued Laser steps are excluded because they have not reached that station.
with laser_arrivals as (
  select
    pj.id as production_job_id,
    pj.customer_order_id,
    min(wo.station_entered_at at time zone 'America/New_York')::date as laser_date
  from public.production_jobs pj
  join public.customer_orders co
    on co.id = pj.customer_order_id
  join public.work_orders wo
    on wo.production_job_id = pj.id
    and wo.customer_order_id = co.id
    and wo.department = 'Laser'
    and wo.is_active is true
    and wo.status in ('Ready', 'In Progress', 'Blocked', 'Needs Plaque', 'Completed')
  where pj.is_active is true
    and lower(coalesce(co.order_type, '')) like '%artwork%'
    and coalesce(pj.due_date, co.due_date) is null
    and coalesce(co.status, '') not in ('Completed', 'Ready for Pickup', 'Ready to Ship', 'Cancelled')
  group by pj.id, pj.customer_order_id
),
updated_jobs as (
  update public.production_jobs pj
  set due_date = public.mw_add_business_days(la.laser_date, 12)
  from laser_arrivals la
  where pj.id = la.production_job_id
    and pj.due_date is null
  returning pj.id, pj.customer_order_id, pj.due_date
)
update public.customer_orders co
set due_date = uj.due_date
from updated_jobs uj
where co.id = uj.customer_order_id
  and co.due_date is null;
