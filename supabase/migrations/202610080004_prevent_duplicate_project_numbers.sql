create or replace function public.mw_next_project_number()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sequence_id bigint;
  v_current integer;
  v_next integer;
  v_prefix text;
  v_project_max integer;
begin
  select id, coalesce(current_number, 0), coalesce(prefix, 'PRJ')
    into v_sequence_id, v_current, v_prefix
  from public.number_sequences
  where sequence_name = 'Project'
  order by id
  limit 1
  for update;

  select coalesce(max((regexp_match(project_number, '^PRJ-([0-9]+)$'))[1]::integer), 0)
    into v_project_max
  from public.projects
  where project_number ~ '^PRJ-[0-9]+$';

  v_next := greatest(coalesce(v_current, 0), v_project_max) + 1;

  if v_sequence_id is null then
    insert into public.number_sequences
      (sequence_name, current_number, prefix, is_active)
    values ('Project', v_next, 'PRJ', true)
    returning id, prefix into v_sequence_id, v_prefix;
  else
    update public.number_sequences
    set current_number = v_next
    where id = v_sequence_id;
  end if;

  return v_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$function$;
