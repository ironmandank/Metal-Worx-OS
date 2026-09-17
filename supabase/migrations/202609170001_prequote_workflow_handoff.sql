alter table public.prequote_site_visits
  add column if not exists quote_id bigint references public.project_quotes(id) on delete set null,
  add column if not exists project_id bigint references public.projects(id) on delete set null,
  add column if not exists bypassed_to_production boolean not null default false,
  add column if not exists bypass_reason text,
  add column if not exists bypassed_by text,
  add column if not exists bypassed_at timestamptz;

create unique index if not exists prequote_site_visits_quote_id_unique
  on public.prequote_site_visits (quote_id)
  where quote_id is not null;

create unique index if not exists prequote_site_visits_project_id_unique
  on public.prequote_site_visits (project_id)
  where project_id is not null;

create or replace function public.mw_advance_prequote_site_visit(
  p_visit_id uuid,
  p_action text,
  p_actor text default null,
  p_bypass_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_visit public.prequote_site_visits%rowtype;
  v_quote public.project_quotes%rowtype;
  v_project public.projects%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_actor text := coalesce(nullif(trim(coalesce(p_actor, '')), ''), 'Metal Worx');
  v_prefix text;
  v_number bigint;
  v_quote_number text;
  v_is_admin boolean := false;
begin
  select * into v_visit
  from public.prequote_site_visits
  where id = p_visit_id
  for update;

  if not found then
    raise exception 'The pre-quote estimate was not found.';
  end if;

  if v_action = 'quote' then
    if v_visit.quote_id is not null then
      select * into v_quote from public.project_quotes where id = v_visit.quote_id;
      if found then
        return jsonb_build_object(
          'action', 'quote',
          'visit_id', v_visit.id,
          'quote_id', v_quote.id,
          'quote_number', v_quote.quote_number,
          'quote_status', v_quote.status,
          'existing', true
        );
      end if;
    end if;

    update public.number_sequences
    set current_number = current_number + 1
    where sequence_name = 'Quote'
    returning prefix, current_number into v_prefix, v_number;

    if v_number is null then
      raise exception 'The Quote number sequence is not configured.';
    end if;

    v_quote_number := v_prefix || '-' || lpad(v_number::text, 6, '0');

    insert into public.project_quotes (
      quote_number,
      quote_type,
      customer_name,
      company_name,
      contact_name,
      contact_phone,
      billing_address,
      job_site_address,
      project_name,
      quote_title,
      assigned_to,
      prepared_by,
      quote_date,
      valid_until,
      status,
      is_active,
      scope_of_work,
      specifications,
      travel_one_way_miles,
      travel_round_trip_miles,
      travel_rate_per_mile,
      subtotal,
      tax_amount,
      total_amount
    ) values (
      v_quote_number,
      'Standalone Quote',
      v_visit.customer_name,
      v_visit.customer_name,
      coalesce(v_visit.contact_name, v_visit.customer_name),
      v_visit.contact_phone,
      v_visit.job_site_address,
      v_visit.job_site_address,
      v_visit.customer_name,
      v_visit.customer_name || ' — Outside Estimate',
      coalesce(v_visit.assigned_estimator, v_actor),
      v_actor,
      current_date,
      current_date + 15,
      'Draft',
      true,
      coalesce(v_visit.notes, 'Complete the formal scope and pricing from the site estimate.'),
      concat_ws(E'\n',
        'Site estimate completed before formal quoting.',
        'Job-site address: ' || v_visit.job_site_address,
        case when v_visit.requested_visit_date is not null then 'Requested visit: ' || v_visit.requested_visit_date::text end
      ),
      coalesce(v_visit.one_way_miles, 0),
      coalesce(v_visit.one_way_miles, 0) * 2,
      coalesce(v_visit.rate_per_mile, 0),
      0,
      0,
      0
    ) returning * into v_quote;

    update public.prequote_site_visits
    set
      quote_id = v_quote.id,
      status = 'Converted to Quote',
      converted_at = now(),
      updated_at = now()
    where id = v_visit.id;

    return jsonb_build_object(
      'action', 'quote',
      'visit_id', v_visit.id,
      'quote_id', v_quote.id,
      'quote_number', v_quote.quote_number,
      'quote_status', v_quote.status,
      'existing', false
    );
  end if;

  if v_action = 'bypass' then
    select exists (
      select 1
      from public.employee_profiles employee
      where employee.auth_user_id = auth.uid()
        and employee.is_active = true
        and lower(coalesce(employee.access_level, '')) like '%admin%'
    ) into v_is_admin;

    if not v_is_admin then
      raise exception 'Administrator access is required to bypass quote and customer approval.';
    end if;

    if nullif(trim(coalesce(p_bypass_reason, '')), '') is null then
      raise exception 'Enter the reason for bypassing quote and customer approval.';
    end if;

    if v_visit.project_id is not null then
      select * into v_project from public.projects where id = v_visit.project_id;
      if found then
        return jsonb_build_object(
          'action', 'bypass',
          'visit_id', v_visit.id,
          'project_id', v_project.id,
          'project_number', v_project.project_number,
          'existing', true
        );
      end if;
    end if;

    insert into public.projects (
      project_number,
      project_name,
      project_type,
      project_category,
      intake_owner,
      work_location,
      status,
      priority,
      assigned_to,
      contact_name,
      contact_phone,
      job_address,
      site_visit_required,
      measurements_required,
      quote_required,
      customer_approval_required,
      quote_status,
      approval_status,
      design_required,
      design_status,
      fabrication_required,
      fabrication_status,
      test_fit_required,
      test_fit_status,
      finish_required,
      finish_status,
      assembly_required,
      assembly_status,
      install_required,
      install_status,
      down_payment_required,
      down_payment_status,
      balance_status,
      material_status,
      next_action,
      percent_complete,
      notes,
      is_active
    ) values (
      null,
      v_visit.customer_name,
      'Outside Project',
      'Outside Fabrication',
      v_actor,
      'Field + Shop',
      'Ready for Production',
      'Normal',
      coalesce(v_visit.assigned_estimator, v_actor),
      coalesce(v_visit.contact_name, v_visit.customer_name),
      v_visit.contact_phone,
      v_visit.job_site_address,
      false,
      false,
      false,
      false,
      'Bypassed',
      'Bypassed',
      false,
      'Not Required',
      true,
      'Not Started',
      true,
      'Not Started',
      true,
      'Not Started',
      false,
      'Not Required',
      true,
      'Not Started',
      false,
      'Not Required',
      'Not Required',
      'Not Needed',
      'Release to Fabrication',
      0,
      concat_ws(E'\n\n',
        'ADMINISTRATOR BYPASS — Quote and customer approval were intentionally bypassed.',
        'Bypassed by: ' || v_actor,
        'Reason: ' || trim(p_bypass_reason),
        nullif(v_visit.notes, '')
      ),
      true
    ) returning * into v_project;

    update public.projects
    set project_number = 'PRJ-' || lpad(v_project.id::text, 6, '0')
    where id = v_project.id
    returning * into v_project;

    if v_visit.quote_id is not null then
      update public.project_quotes
      set
        project_id = v_project.id,
        converted_project_id = v_project.id,
        converted_at = now(),
        converted_by = v_actor,
        quote_type = 'Project Quote'
      where id = v_visit.quote_id;
    end if;

    update public.prequote_site_visits
    set
      project_id = v_project.id,
      status = 'Bypassed to Production',
      bypassed_to_production = true,
      bypass_reason = trim(p_bypass_reason),
      bypassed_by = v_actor,
      bypassed_at = now(),
      converted_at = coalesce(converted_at, now()),
      updated_at = now()
    where id = v_visit.id;

    return jsonb_build_object(
      'action', 'bypass',
      'visit_id', v_visit.id,
      'project_id', v_project.id,
      'project_number', v_project.project_number,
      'existing', false
    );
  end if;

  raise exception 'Action must be quote or bypass.';
end;
$$;

revoke execute on function public.mw_advance_prequote_site_visit(uuid, text, text, text) from public, anon;
grant execute on function public.mw_advance_prequote_site_visit(uuid, text, text, text) to authenticated;
