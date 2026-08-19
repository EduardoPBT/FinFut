do $$ begin
  create type public.bank_account_kind as enum ('corrente', 'poupanca', 'dinheiro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.card_statement_status as enum ('aberta', 'fechada', 'paga');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.movement_kind as enum ('receita', 'despesa', 'transferencia');
exception when duplicate_object then null;
end $$;

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind public.bank_account_kind not null default 'corrente',
  initial_balance_cents bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  closing_day smallint not null check (closing_day >= 1 and closing_day <= 31),
  due_day smallint not null check (due_day >= 1 and due_day <= 31),
  payment_account_id uuid references public.bank_accounts (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.card_statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  cycle_start date not null,
  cycle_end date not null,
  due_on date not null,
  status public.card_statement_status not null default 'aberta',
  paid_on date,
  payment_transaction_id uuid references public.transactions (id) on delete set null,
  unique (credit_card_id, cycle_end)
);

create table if not exists public.card_charges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  card_statement_id uuid not null references public.card_statements (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  member_id uuid references public.members (id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  notes text,
  installment_group_id uuid,
  installment_number smallint not null default 1 check (installment_number >= 1),
  installment_total smallint not null default 1 check (installment_total >= 1),
  bill_instance_id uuid references public.bill_instances (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.income_sources
  add column if not exists default_account_id uuid references public.bank_accounts (id) on delete set null;

alter table public.income_instances
  add column if not exists account_id uuid references public.bank_accounts (id) on delete set null;

alter table public.recurring_bills
  add column if not exists default_account_id uuid references public.bank_accounts (id) on delete set null,
  add column if not exists default_credit_card_id uuid references public.credit_cards (id) on delete set null,
  add column if not exists default_payment_method public.payment_method;

alter table public.bill_instances
  add column if not exists account_id uuid references public.bank_accounts (id) on delete set null,
  add column if not exists credit_card_id uuid references public.credit_cards (id) on delete set null,
  add column if not exists card_charge_id uuid references public.card_charges (id) on delete set null;

alter table public.transactions
  add column if not exists account_id uuid references public.bank_accounts (id) on delete set null,
  add column if not exists card_charge_id uuid references public.card_charges (id) on delete set null,
  add column if not exists statement_payment_id uuid references public.card_statements (id) on delete set null,
  add column if not exists movement_kind public.movement_kind;

update public.transactions t
set movement_kind = 'receita'
from public.categories c
where t.category_id = c.id
  and c.kind = 'receita'
  and t.movement_kind is null;

update public.transactions
set movement_kind = 'despesa'
where movement_kind is null;

alter table public.transactions
  alter column movement_kind set default 'despesa',
  alter column movement_kind set not null;

create index if not exists bank_accounts_household_idx
  on public.bank_accounts (household_id, active);

create index if not exists credit_cards_household_idx
  on public.credit_cards (household_id, active);

create index if not exists card_statements_card_due_idx
  on public.card_statements (credit_card_id, due_on);

create index if not exists card_charges_statement_idx
  on public.card_charges (card_statement_id);

create index if not exists transactions_account_occurred_idx
  on public.transactions (account_id, occurred_on);

alter table public.bank_accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.card_statements enable row level security;
alter table public.card_charges enable row level security;

create policy bank_accounts_household on public.bank_accounts
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy credit_cards_household on public.credit_cards
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy card_statements_household on public.card_statements
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy card_charges_household on public.card_charges
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));
