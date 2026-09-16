revoke all on public.customer_quote_approvals from anon, authenticated;
grant select on public.customer_quote_approvals to authenticated;

revoke all on public.customer_quote_approval_events from anon, authenticated;
grant select on public.customer_quote_approval_events to authenticated;
