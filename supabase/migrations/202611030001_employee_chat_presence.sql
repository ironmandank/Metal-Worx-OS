drop policy if exists "Active employees can view Metal Worx presence" on realtime.messages;
drop policy if exists "Active employees can publish Metal Worx presence" on realtime.messages;

create policy "Active employees can view Metal Worx presence"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'mw:employee-presence'
  and extension = 'presence'
  and exists (
    select 1
    from public.employee_profiles as employee
    where employee.auth_user_id = (select auth.uid())
      and employee.profile_type = 'Person'
      and employee.is_active is true
  )
);

create policy "Active employees can publish Metal Worx presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() = 'mw:employee-presence'
  and extension = 'presence'
  and exists (
    select 1
    from public.employee_profiles as employee
    where employee.auth_user_id = (select auth.uid())
      and employee.profile_type = 'Person'
      and employee.is_active is true
  )
);
