with showroom_category as (
  select id
  from public.inventory_categories
  where name = 'Showroom & Craft Show Inventory'
  limit 1
), crate_artwork as (
  select distinct inventory_item_id
  from public.inventory_bin_balances
  where quantity_on_hand > 0
    and (bin_code ilike 'CR-%' or bin_code ilike 'LG-%')
)
update public.inventory_items item
set
  category_id = (select id from showroom_category),
  item_type = 'showroom',
  is_consumable = false,
  updated_at = now()
where item.id in (select inventory_item_id from crate_artwork)
  and exists (select 1 from showroom_category);

update public.inventory_items item
set
  item_type = 'showroom',
  is_consumable = false,
  updated_at = now()
from public.inventory_categories category
where item.category_id = category.id
  and category.name = 'Showroom & Craft Show Inventory'
  and (
    item.item_type is distinct from 'showroom'
    or item.is_consumable is distinct from false
  );
