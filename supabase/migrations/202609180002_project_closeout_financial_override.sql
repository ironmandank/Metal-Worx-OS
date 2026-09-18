alter table public.projects
  add column if not exists closeout_financial_bypass boolean not null default false,
  add column if not exists closeout_bypass_reason text,
  add column if not exists closed_by text;

drop function if exists public.mw_complete_project_closeout(bigint, text);

create or replace function public.mw_complete_project_closeout(
  p_project_id bigint,
  p_closed_by text default null,
  p_allow_financial_bypass boolean default false,
  p_bypass_reason text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_project public.projects%rowtype;
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_financial_warning boolean;
  v_closed_at timestamptz := now();
begin
  select *
  into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project % was not found.', p_project_id;
  end if;

  if lower(coalesce(v_project.status, '')) = 'cancelled' then
    raise exception 'A cancelled project cannot be completed.';
  end if;

  if lower(coalesce(v_project.status, '')) = 'completed' then
    return v_project;
  end if;

  if coalesce(v_project.install_required, false)
     and coalesce(v_project.install_status, '') <> 'Completed' then
    raise exception 'Installation must be completed before Office Closeout.';
  end if;

  if coalesce(v_project.final_inspection_status, 'Not Required')
     not in ('Passed', 'Not Required') then
    raise exception 'Final inspection must pass before Office Closeout.';
  end if;

  v_total := round(coalesce(v_project.contract_total, 0), 2);

  select round(coalesce(sum(amount), 0), 2)
  into v_paid
  from public.project_payments
  where project_id = p_project_id;

  v_remaining := greatest(round(v_total - v_paid, 2), 0);
  v_financial_warning := v_total <= 0 or v_remaining > 0;

  if v_financial_warning and not coalesce(p_allow_financial_bypass, false) then
    raise exception 'Financial closeout warning: contract total %, amount paid %, remaining %. Confirm Close Anyway to bypass.',
      v_total, v_paid, v_remaining;
  end if;

  if v_financial_warning and not public.mw_calendar_is_administrator() then
    raise exception 'Only an Administrator can approve a financial closeout override.';
  end if;

  if v_financial_warning and nullif(trim(coalesce(p_bypass_reason, '')), '') is null then
    raise exception 'A reason is required to close a project with a financial warning.';
  end if;

  update public.projects
  set
    amount_paid = v_paid,
    balance_due = v_remaining,
    balance_status = case when v_remaining <= 0 then 'Paid' else 'Closeout Override' end,
    status = 'Completed',
    percent_complete = 100,
    next_action = 'Project workflow is complete',
    is_active = false,
    completed_at = v_closed_at,
    closeout_financial_bypass = v_financial_warning,
    closeout_bypass_reason = case when v_financial_warning then trim(p_bypass_reason) else null end,
    closed_by = coalesce(
      public.current_employee_display_name(),
      nullif(trim(coalesce(p_closed_by, '')), '')
    ),
    notes = concat_ws(
      E'\n',
      notes,
      case
        when v_financial_warning then format(
          '[Financial closeout override %s] Closed by %s. Contract total: %s; paid: %s; remaining: %s. Reason: %s',
          to_char(v_closed_at, 'YYYY-MM-DD HH24:MI TZ'),
          coalesce(public.current_employee_display_name(), nullif(trim(coalesce(p_closed_by, '')), ''), 'Administrator'),
          v_total,
          v_paid,
          v_remaining,
          trim(p_bypass_reason)
        )
        else format(
          'Office closeout completed by %s on %s',
          coalesce(public.current_employee_display_name(), nullif(trim(coalesce(p_closed_by, '')), ''), 'Authorized user'),
          to_char(v_closed_at, 'YYYY-MM-DD HH24:MI TZ')
        )
      end
    )
  where id = p_project_id
  returning * into v_project;

  return v_project;
end;
$function$;

revoke all on function public.mw_complete_project_closeout(bigint, text, boolean, text) from public;
grant execute on function public.mw_complete_project_closeout(bigint, text, boolean, text) to authenticated;
