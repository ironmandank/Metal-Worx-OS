create or replace function public.mw_sparky_create_artwork_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_project_name text,
  p_description text,
  p_special_instructions text,
  p_due_date date,
  p_design_source text,
  p_actor text,
  p_confirmation text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_active_employee boolean;
  v_customer_id bigint;
  v_order_id bigint;
  v_order_number text;
  v_needs_design boolean;
  v_starting_department text;
  v_name_parts text[];
begin
  select exists (select 1 from public.employee_profiles where auth_user_id = (select auth.uid()) and is_active = true) into v_active_employee;
  if not v_active_employee then raise exception 'An active employee login is required.'; end if;
  if p_confirmation is distinct from 'CONFIRM CREATE ARTWORK ORDER' then raise exception 'Explicit confirmation is required.'; end if;
  if nullif(btrim(p_customer_name), '') is null or nullif(btrim(p_project_name), '') is null or nullif(btrim(p_description), '') is null then raise exception 'Customer, artwork name, and description are required.'; end if;
  if nullif(btrim(coalesce(p_phone, '')), '') is null and nullif(btrim(coalesce(p_email, '')), '') is null then raise exception 'A phone number or email address is required.'; end if;
  if p_design_source not in ('New Design Required', 'Design Already on File') then raise exception 'Invalid design source.'; end if;

  select id into v_customer_id from public.customers
  where is_active = true and ((p_email is not null and lower(email) = lower(btrim(p_email))) or (p_phone is not null and phone = btrim(p_phone)))
  order by id limit 1;
  if v_customer_id is null then
    v_name_parts := regexp_split_to_array(btrim(p_customer_name), '\s+');
    insert into public.customers(first_name,last_name,phone,email,customer_type,is_active)
    values(v_name_parts[1], nullif(array_to_string(v_name_parts[2:array_length(v_name_parts,1)], ' '), ''), nullif(btrim(coalesce(p_phone,'')), ''), nullif(btrim(coalesce(p_email,'')), ''), 'Retail', true)
    returning id into v_customer_id;
  end if;

  v_needs_design := p_design_source = 'New Design Required';
  v_starting_department := case when v_needs_design then 'Design' else 'Laser' end;
  v_order_number := 'MW-' || extract(year from current_date)::int || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  insert into public.customer_orders(order_number,customer_id,status,due_date,rush,notes,total_amount,deposit_received,deposit_amount,order_type,order_owner,design_needed,design_fee_required,design_fee_status,design_fee_amount,design_status,design_notes,starting_department,fulfillment_method)
  values(v_order_number,v_customer_id,case when v_needs_design then 'Design Needed' else 'Ready for Production' end,p_due_date,false,nullif(btrim(coalesce(p_special_instructions,'')),''),0,false,0,'Custom Artwork',p_actor,v_needs_design,v_needs_design,case when v_needs_design then 'Pending' else 'Not Required' end,case when v_needs_design then 50 else 0 end,case when v_needs_design then 'Ready' else 'Existing Design' end,p_design_source || E'\n' || btrim(p_description),v_starting_department,'Pickup') returning id into v_order_id;
  insert into public.customer_order_items(order_id,product_template_id,item_name,description,quantity,unit_price,notes)
  values(v_order_id,null,btrim(p_project_name),btrim(p_description),1,0,nullif(btrim(coalesce(p_special_instructions,'')),''));
  perform public.mw_release_customer_order_to_production(v_order_id,v_starting_department,p_actor);
  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'customer_id',v_customer_id,'starting_department',v_starting_department);
end;
$$;

revoke execute on function public.mw_sparky_create_artwork_order(text,text,text,text,text,text,date,text,text,text) from public, anon;
grant execute on function public.mw_sparky_create_artwork_order(text,text,text,text,text,text,date,text,text,text) to authenticated;
