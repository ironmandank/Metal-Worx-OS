create or replace function public.mw_sparky_create_quote_draft(
  p_customer_id bigint,
  p_customer_name text,
  p_quote_title text,
  p_scope_of_work text,
  p_items jsonb,
  p_tax_treatment text,
  p_actor text,
  p_confirmation text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_quote_id bigint;
  v_quote_number text;
  v_subtotal numeric := 0;
  v_tax_rate numeric := 0.07;
  v_tax_amount numeric := 0;
  v_total numeric := 0;
begin
  select exists (
    select 1
    from public.employee_profiles
    where auth_user_id = (select auth.uid())
      and is_active = true
      and lower(coalesce(access_level, '')) like '%admin%'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Administrator access is required to create quote drafts through Sparky.';
  end if;
  if p_confirmation is distinct from 'CONFIRM CREATE QUOTE DRAFT' then
    raise exception 'Explicit confirmation is required.';
  end if;
  if nullif(btrim(p_customer_name), '') is null or nullif(btrim(p_quote_title), '') is null then
    raise exception 'Customer and quote title are required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'One to twenty quote line items are required.';
  end if;
  if p_tax_treatment not in ('included', 'added_later') then
    raise exception 'Invalid tax treatment.';
  end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id and is_active = true) then
    raise exception 'The selected customer is not active.';
  end if;

  select coalesce(sum((item->>'quantity')::numeric * (item->>'unit_price')::numeric), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) as item
  where nullif(btrim(item->>'title'), '') is not null
    and (item->>'quantity')::numeric > 0
    and (item->>'unit_price')::numeric >= 0;

  if v_subtotal < 0 then raise exception 'Quote subtotal cannot be negative.'; end if;
  if p_tax_treatment = 'included' then v_tax_amount := round(v_subtotal * v_tax_rate, 2); end if;
  v_total := v_subtotal + v_tax_amount;
  v_quote_number := public.mw_next_number('Quote');

  insert into public.project_quotes (
    quote_number, project_id, quote_type, customer_id, customer_name, company_name, contact_name,
    project_name, quote_title, assigned_to, prepared_by, quote_date, valid_until, status, is_active,
    tax_rate, tax_treatment, subtotal, tax_amount, total_amount, quote_layout, scope_of_work,
    down_payment_terms, payment_terms, price_notes, warranty_terms, disclaimer, acceptance_terms
  ) values (
    v_quote_number, null, 'Standalone Quote', p_customer_id, btrim(p_customer_name), btrim(p_customer_name), btrim(p_customer_name),
    btrim(p_quote_title), btrim(p_quote_title), p_actor, p_actor, current_date, current_date + 15, 'Draft', true,
    v_tax_rate, p_tax_treatment, v_subtotal, v_tax_amount, v_total, 'Detailed Fabrication', nullif(btrim(p_scope_of_work), ''),
    '50% deposit required to begin work', '50% deposit required to begin work',
    'Taxes and card fees added on final invoice. North Carolina 7%.',
    'Metal Worx Inc. warrants fabricated products against defects in workmanship for 90 days from completion.',
    'Due to fluctuations in material costs, Metal Worx Inc. reserves the right to update this quote. All prices are subject to final material cost verification.',
    'By signing below, the customer accepts this quote, including its scope, price, assumptions, exclusions, payment schedule, and stated terms. Work outside the approved scope requires customer authorization.'
  ) returning id into v_quote_id;

  insert into public.project_quote_items (
    quote_id, item_type, title, description, quantity, unit_price, line_total,
    is_optional, is_selected, show_on_pdf, sort_order
  )
  select
    v_quote_id, 'Service', btrim(item->>'title'), nullif(btrim(coalesce(item->>'description', '')), ''),
    (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
    (item->>'quantity')::numeric * (item->>'unit_price')::numeric,
    false, true, true, ordinality::integer
  from jsonb_array_elements(p_items) with ordinality as parsed(item, ordinality)
  where nullif(btrim(item->>'title'), '') is not null
    and (item->>'quantity')::numeric > 0
    and (item->>'unit_price')::numeric >= 0;

  if not exists (select 1 from public.project_quote_items where quote_id = v_quote_id) then
    raise exception 'No valid quote line items were provided.';
  end if;

  return jsonb_build_object('quote_id', v_quote_id, 'quote_number', v_quote_number, 'status', 'Draft', 'subtotal', v_subtotal, 'tax_amount', v_tax_amount, 'total_amount', v_total);
end;
$$;

revoke execute on function public.mw_sparky_create_quote_draft(bigint, text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.mw_sparky_create_quote_draft(bigint, text, text, text, jsonb, text, text, text) to authenticated;

comment on function public.mw_sparky_create_quote_draft(bigint, text, text, text, jsonb, text, text, text) is
  'Creates an editable standalone Draft quote and line items after explicit administrator confirmation in Sparky.';
