create or replace function public.mw_restore_archived_project(p_project_id bigint)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_project public.projects%rowtype;
  v_actor text;
begin
  if (select auth.uid()) is null or not public.mw_calendar_is_administrator() then
    raise exception 'Only an Administrator can restore an archived project.';
  end if;

  v_actor := coalesce(public.current_employee_display_name(), 'Administrator');

  update public.projects
  set
    is_active = true,
    status = case when status in ('Archived', 'Cancelled') then 'In Progress' else status end,
    next_action = 'Review restored project and assign the next action',
    notes = concat_ws(
      E'\n',
      notes,
      format(
        '[Restored %s] Restored by %s. Previous archive reason: %s',
        to_char(now(), 'YYYY-MM-DD HH24:MI TZ'),
        v_actor,
        coalesce(archive_reason, 'Not recorded')
      )
    ),
    archived_at = null,
    archived_by = null,
    archive_reason = null
  where id = p_project_id
    and archived_at is not null
  returning * into v_project;

  if not found then
    raise exception 'Archived project % was not found.', p_project_id;
  end if;

  return v_project;
end;
$function$;

revoke execute on function public.mw_restore_archived_project(bigint) from public, anon;
grant execute on function public.mw_restore_archived_project(bigint) to authenticated;

