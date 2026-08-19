do $$ begin
  create type public.income_instance_status as enum ('pendente', 'recebido');
exception when duplicate_object then null;
end $$;

alter table public.income_sources
  add column if not exists active boolean not null default true,
  add column if not exists category_id uuid references public.categories (id) on delete set null;

alter table public.transactions
  add column if not exists income_instance_id uuid;

create table if not exists public.income_instances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  income_source_id uuid not null references public.income_sources (id) on delete cascade,
  competence date not null,
  amount_cents bigint not null check (amount_cents > 0),
  expected_on date not null,
  status public.income_instance_status not null default 'pendente',
  received_at timestamptz,
  received_on date,
  transaction_id uuid references public.transactions (id) on delete set null,
  unique (income_source_id, competence)
);

alter table public.transactions
  drop constraint if exists transactions_income_instance_id_fkey;

alter table public.transactions
  add constraint transactions_income_instance_id_fkey
  foreign key (income_instance_id) references public.income_instances (id) on delete set null;

create index if not exists income_instances_household_competence_idx
  on public.income_instances (household_id, competence);

alter table public.income_instances enable row level security;

create policy income_instances_household on public.income_instances
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));
