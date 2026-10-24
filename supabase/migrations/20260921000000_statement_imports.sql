do $$
begin
  alter type public.transaction_origin add value 'ofx';
exception
  when duplicate_object then null;
end
$$;

do $$ begin
  create type public.statement_import_kind as enum ('extrato', 'fatura');
exception when duplicate_object then null;
end $$;

create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.statement_import_kind not null,
  bank_account_id uuid references public.bank_accounts (id) on delete set null,
  credit_card_id uuid references public.credit_cards (id) on delete set null,
  file_name text not null,
  imported_count int not null default 0,
  skipped_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint statement_imports_target_chk check (
    (kind = 'extrato' and bank_account_id is not null)
    or (kind = 'fatura' and credit_card_id is not null)
  )
);

create table if not exists public.statement_import_lines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  statement_import_id uuid not null references public.statement_imports (id) on delete cascade,
  bank_account_id uuid references public.bank_accounts (id) on delete cascade,
  credit_card_id uuid references public.credit_cards (id) on delete cascade,
  fit_id text not null,
  occurred_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  transaction_id uuid references public.transactions (id) on delete set null,
  card_charge_id uuid references public.card_charges (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint statement_import_lines_target_chk check (
    (bank_account_id is not null and credit_card_id is null)
    or (credit_card_id is not null and bank_account_id is null)
  )
);

create unique index if not exists statement_import_lines_account_fit_idx
  on public.statement_import_lines (bank_account_id, fit_id)
  where bank_account_id is not null;

create unique index if not exists statement_import_lines_card_fit_idx
  on public.statement_import_lines (credit_card_id, fit_id)
  where credit_card_id is not null;

create index if not exists statement_imports_household_created_idx
  on public.statement_imports (household_id, created_at desc);

create index if not exists statement_import_lines_import_idx
  on public.statement_import_lines (statement_import_id);

alter table public.statement_imports enable row level security;
alter table public.statement_import_lines enable row level security;

drop policy if exists statement_imports_household on public.statement_imports;
create policy statement_imports_household on public.statement_imports
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

drop policy if exists statement_import_lines_household on public.statement_import_lines;
create policy statement_import_lines_household on public.statement_import_lines
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));
