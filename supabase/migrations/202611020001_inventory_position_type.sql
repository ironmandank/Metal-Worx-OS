alter table public.inventory_bins
  add column if not exists position_type text not null default 'unclassified';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_bins_position_type_check'
      and conrelid = 'public.inventory_bins'::regclass
  ) then
    alter table public.inventory_bins
      add constraint inventory_bins_position_type_check
      check (position_type in (
        'unclassified',
        'small_crate',
        'large_crate',
        'shelf',
        'rack',
        'floor',
        'other'
      ));
  end if;
end
$$;

comment on column public.inventory_bins.position_type is
  'Physical storage position type; used to distinguish small and large crates in inventory and labels.';
