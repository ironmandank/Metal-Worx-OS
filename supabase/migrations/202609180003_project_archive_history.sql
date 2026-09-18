alter table public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text,
  add column if not exists archive_reason text;

create or replace function public.mw_archive_project(
  p_project_id bigint,
  p_reason text,
  p_archived_by text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_project public.projects%rowtype;
  v_actor text;
  v_archived_at timestamptz := now();
begin
  if not public.mw_calendar_is_administrator() then
    raise exception 'Only an Administrator can archive an outside project.';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'An archive reason is required.';
  end if;

  v_actor := coalesce(
    public.current_employee_display_name(),
    nullif(trim(coalesce(p_archived_by, '')), ''),
    'Administrator'
  );

  update public.projects
  set
    is_active = false,
    status = case when status = 'Completed' then status else 'Archived' end,
    next_action = 'Archived — no active action',
    archived_at = v_archived_at,
    archived_by = v_actor,
    archive_reason = trim(p_reason),
    notes = concat_ws(
      E'\n',
      notes,
      format(
        '[Archived %s] Archived by %s. Reason: %s',
        to_char(v_archived_at, 'YYYY-MM-DD HH24:MI TZ'),
        v_actor,
        trim(p_reason)
      )
    )
  where id = p_project_id
  returning * into v_project;

  if not found then
    raise exception 'Project % was not found.', p_project_id;
  end if;

  return v_project;
end;
$function$;

revoke all on function public.mw_archive_project(bigint, text, text) from public;
grant execute on function public.mw_archive_project(bigint, text, text) to authenticated;

