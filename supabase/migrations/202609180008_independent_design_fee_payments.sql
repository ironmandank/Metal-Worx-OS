create or replace function public.record_customer_order_payment(
  p_customer_order_id bigint,
  p_payment_type text,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference_number text default null,
  p_notes text default null,
  p_recorded_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.customer_orders%rowtype;
  v_payment public.customer_order_payments%rowtype;
  v_current_balance numeric;
  v_new_balance numeric;
  v_is_design_fee boolean := p_payment_type = 'Design Fee';
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_payment_type not in ('Design Fee', 'Deposit', 'Partial Payment', 'Final Payment') then
    raise exception 'Invalid payment type.';
  end if;

  select * into v_order
  from public.customer_orders
  where id = p_customer_order_id
  for update;

  if not found then
    raise exception 'Customer order not found.';
  end if;

  v_current_balance := greatest(
    coalesce(v_order.balance_due, coalesce(v_order.order_total, 0) - coalesce(v_order.down_payment, 0)),
    0
  );

  if not v_is_design_fee and p_amount > v_current_balance then
    raise exception 'Payment exceeds the remaining balance of %.',
      to_char(v_current_balance, 'FM$999,999,990.00');
  end if;

  v_new_balance := case
    when v_is_design_fee then v_current_balance
    else greatest(v_current_balance - p_amount, 0)
  end;

  insert into public.customer_order_payments (
    customer_order_id, payment_type, amount, payment_method, payment_date,
    reference_number, notes, recorded_by
  ) values (
    p_customer_order_id, p_payment_type, p_amount,
    coalesce(nullif(trim(p_payment_method), ''), 'Other'),
    coalesce(p_payment_date, current_date), nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''), nullif(trim(p_recorded_by), '')
  ) returning * into v_payment;

  update public.customer_orders
  set
    balance_due = v_new_balance,
    design_fee_required = case when v_is_design_fee then true else design_fee_required end,
    design_fee_amount = case when v_is_design_fee then greatest(coalesce(design_fee_amount, 0), p_amount) else design_fee_amount end,
    design_fee_paid = case when v_is_design_fee then true else design_fee_paid end,
    design_fee_status = case when v_is_design_fee then 'Paid' else design_fee_status end,
    design_fee_paid_at = case when v_is_design_fee then now() else design_fee_paid_at end,
    down_payment = case when p_payment_type = 'Deposit' then coalesce(down_payment, 0) + p_amount else down_payment end,
    deposit_received = case when p_payment_type = 'Deposit' then true else deposit_received end,
    final_payment_received = case when v_is_design_fee then final_payment_received else v_new_balance = 0 end,
    final_payment_received_at = case
      when v_is_design_fee then final_payment_received_at
      when v_new_balance = 0 then now()
      else null
    end
  where id = p_customer_order_id;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'amount_paid', greatest(coalesce(v_order.order_total, 0) - v_new_balance, 0),
    'balance_due', v_new_balance,
    'design_fee_paid', v_is_design_fee or coalesce(v_order.design_fee_paid, false),
    'paid_in_full', v_new_balance = 0
  );
end;
$$;

