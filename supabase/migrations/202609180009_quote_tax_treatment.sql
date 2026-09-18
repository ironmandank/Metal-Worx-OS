alter table public.project_quotes
  add column if not exists tax_treatment text not null default 'included';

alter table public.project_quotes
  drop constraint if exists project_quotes_tax_treatment_check;

alter table public.project_quotes
  add constraint project_quotes_tax_treatment_check
  check (tax_treatment in ('included', 'plus', 'exempt'));

comment on column public.project_quotes.tax_treatment is
  'Controls whether tax is included in the quoted total, added later, or exempt.';

