alter table public.quick_turnaround_commitments
  alter column required_by drop not null;

create or replace view public.quick_turnaround_dashboard
with (security_invoker = true)
as
select
  commitment.*,
  greatest(0, current_date - commitment.date_received) as days_in_shop,
  case
    when commitment.status in ('Completed', 'Cancelled') then 'Closed'
    when commitment.status = 'Blocked' then 'Blocked'
    when commitment.required_by is null then 'No Date'
    when commitment.required_by < now() then 'Overdue'
    when commitment.required_by <= now() + interval '4 hours' then 'Due Soon'
    when commitment.required_by::date = current_date then 'Due Today'
    when commitment.required_by::date = current_date + 1 then 'Due Tomorrow'
    else 'Upcoming'
  end as timing_status,
  case
    when commitment.required_by is null then null::numeric(12,2)
    else greatest(0, extract(epoch from commitment.required_by - now()) / 3600)::numeric(12,2)
  end as hours_remaining,
  case
    when commitment.status in ('Completed', 'Cancelled') then 99
    when commitment.status = 'Blocked' then 1
    when commitment.required_by < now() then 2
    when commitment.priority = 'Critical' then 3
    when commitment.hot_reason_category = 'Aging' then 4
    when commitment.required_by <= now() + interval '4 hours' then 5
    when commitment.required_by::date = current_date then 6
    else 10
  end as attention_rank
from public.quick_turnaround_commitments commitment;

grant select on public.quick_turnaround_dashboard to authenticated;
revoke all on public.quick_turnaround_dashboard from anon;

create or replace function public.mw_save_quick_turnaround_commitment(
  p_id uuid default null,
  p_source_type text default 'Manual',
  p_source_id uuid default null,
  p_source_number text default null,
  p_title text default null,
  p_customer_name text default null,
  p_description text default null,
  p_priority text default 'Urgent',
  p_status text default 'Open',
  p_required_by timestamptz default null,
  p_assigned_to text default null,
  p_department text default null,
  p_materials_required boolean default false,
  p_materials_status text default 'Not Required',
  p_reason text default null,
  p_notes text default null,
  p_created_by text default null,
  p_date_received date default current_date,
  p_hot_reason_category text default 'Deadline'
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_commitment public.quick_turnaround_commitments%rowtype;
begin
  if not public.mw_calendar_is_active_employee() then
    raise exception 'Active employee access is required.';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Artwork title is required.';
  end if;

  if coalesce(p_hot_reason_category, '') not in ('Deadline', 'Aging', 'Customer Escalation', 'Other') then
    raise exception 'Select a valid reason for marking the artwork hot.';
  end if;

  if p_id is not null then
    update public.quick_turnaround_commitments
    set source_type = p_source_type,
        source_id = p_source_id,
        source_number = nullif(trim(coalesce(p_source_number, '')), ''),
        title = trim(p_title),
        customer_name = nullif(trim(coalesce(p_customer_name, '')), ''),
        description = nullif(trim(coalesce(p_description, '')), ''),
        priority = p_priority,
        status = p_status,
        required_by = p_required_by,
        promised_date = p_required_by::date,
        assigned_to = nullif(trim(coalesce(p_assigned_to, '')), ''),
        department = nullif(trim(coalesce(p_department, '')), ''),
        materials_required = coalesce(p_materials_required, false),
        materials_status = case when coalesce(p_materials_required, false) then p_materials_status else 'Not Required' end,
        reason = nullif(trim(coalesce(p_reason, '')), ''),
        notes = nullif(trim(coalesce(p_notes, '')), ''),
        date_received = coalesce(p_date_received, current_date),
        hot_reason_category = p_hot_reason_category
    where id = p_id
    returning * into v_commitment;
  else
    insert into public.quick_turnaround_commitments (
      source_type, source_id, source_number, title, customer_name,
      description, priority, status, required_by, promised_date,
      assigned_to, department, materials_required, materials_status,
      reason, notes, created_by, date_received, hot_reason_category
    ) values (
      p_source_type, p_source_id, nullif(trim(coalesce(p_source_number, '')), ''),
      trim(p_title), nullif(trim(coalesce(p_customer_name, '')), ''),
      nullif(trim(coalesce(p_description, '')), ''), p_priority, p_status,
      p_required_by, p_required_by::date,
      nullif(trim(coalesce(p_assigned_to, '')), ''),
      nullif(trim(coalesce(p_department, '')), ''),
      coalesce(p_materials_required, false),
      case when coalesce(p_materials_required, false) then p_materials_status else 'Not Required' end,
      nullif(trim(coalesce(p_reason, '')), ''),
      nullif(trim(coalesce(p_notes, '')), ''),
      nullif(trim(coalesce(p_created_by, '')), ''),
      coalesce(p_date_received, current_date),
      p_hot_reason_category
    ) returning * into v_commitment;
  end if;

  if v_commitment.id is null then
    raise exception 'Hot artwork item was not found.';
  end if;

  return to_jsonb(v_commitment);
end;
$$;

revoke execute on function public.mw_save_quick_turnaround_commitment(
  uuid, text, uuid, text, text, text, text, text, text,
  timestamptz, text, text, boolean, text, text, text, text, date, text
) from public, anon;

grant execute on function public.mw_save_quick_turnaround_commitment(
  uuid, text, uuid, text, text, text, text, text, text,
  timestamptz, text, text, boolean, text, text, text, text, date, text
) to authenticated;
