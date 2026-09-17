create or replace function public.mw_next_number(p_sequence_name text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_prefix text;
  v_current bigint;
  v_highest_used bigint := 0;
  v_next bigint;
begin
  select sequence_row.prefix, sequence_row.current_number
  into v_prefix, v_current
  from public.number_sequences as sequence_row
  where sequence_row.sequence_name = p_sequence_name
  for update;

  if not found then
    raise exception 'Unknown number sequence: %', p_sequence_name;
  end if;

  if p_sequence_name = 'Project' then
    select coalesce(
      max((substring(project.project_number from '([0-9]+)$'))::bigint),
      0
    )
    into v_highest_used
    from public.projects as project
    where project.project_number ~ '[0-9]+$';
  elsif p_sequence_name = 'Quote' then
    select coalesce(
      max((substring(quote.quote_number from '([0-9]+)$'))::bigint),
      0
    )
    into v_highest_used
    from public.project_quotes as quote
    where quote.quote_number ~ '[0-9]+$';
  end if;

  v_next := greatest(coalesce(v_current, 0), v_highest_used) + 1;

  update public.number_sequences
  set current_number = v_next
  where sequence_name = p_sequence_name;

  return v_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

revoke execute on function public.mw_next_number(text) from public;
revoke execute on function public.mw_next_number(text) from anon;
grant execute on function public.mw_next_number(text) to authenticated;

update public.number_sequences
set current_number = greatest(
  coalesce(current_number, 0),
  coalesce((
    select max((substring(project.project_number from '([0-9]+)$'))::bigint)
    from public.projects as project
    where project.project_number ~ '[0-9]+$'
  ), 0)
)
where sequence_name = 'Project';

update public.number_sequences
set current_number = greatest(
  coalesce(current_number, 0),
  coalesce((
    select max((substring(quote.quote_number from '([0-9]+)$'))::bigint)
    from public.project_quotes as quote
    where quote.quote_number ~ '[0-9]+$'
  ), 0)
)
where sequence_name = 'Quote';
