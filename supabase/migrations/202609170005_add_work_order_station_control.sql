alter table public.work_orders
  add column if not exists assigned_to text,
  add column if not exists priority text not null default 'Normal',
  add column if not exists blocked_reason text,
  add column if not exists station_entered_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.mw_track_work_order_station_time()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.station_entered_at := coalesce(new.station_entered_at, now());
  elsif new.department is distinct from old.department
    or (new.status is distinct from old.status and new.status = 'Ready') then
    new.station_entered_at := now();
  end if;

  if new.status <> 'Blocked' then
    new.blocked_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists mw_track_work_order_station_time on public.work_orders;
create trigger mw_track_work_order_station_time
before insert or update on public.work_orders
for each row execute function public.mw_track_work_order_station_time();

revoke execute on function public.mw_track_work_order_station_time() from public;
revoke execute on function public.mw_track_work_order_station_time() from anon;
revoke execute on function public.mw_track_work_order_station_time() from authenticated;

create index if not exists work_orders_department_status_station_entered_idx
  on public.work_orders (department, status, station_entered_at)
  where is_active is true;
