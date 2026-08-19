create schema if not exists private;

do $$ begin
  create type public.member_role as enum ('voce', 'esposa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.income_kind as enum ('fixo', 'variavel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.category_kind as enum ('receita', 'fixa', 'variavel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_origin as enum ('app', 'whatsapp');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bill_status as enum ('pendente', 'pago', 'atrasado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inbound_status as enum ('pending', 'parsed', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'Nossa casa',
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (household_id, role)
);

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  name text not null,
  kind public.income_kind not null,
  typical_amount_cents bigint not null default 0,
  payday smallint check (payday is null or (payday >= 1 and payday <= 31)),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  icon text not null default 'circle',
  color text not null default '#14b8a6',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null default (timezone('America/Sao_Paulo', now()))::date,
  notes text,
  origin public.transaction_origin not null default 'app',
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_day smallint not null check (due_day >= 1 and due_day <= 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bill_instances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recurring_bill_id uuid not null references public.recurring_bills (id) on delete cascade,
  competence date not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_on date not null,
  status public.bill_status not null default 'pendente',
  paid_at timestamptz,
  unique (recurring_bill_id, competence)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  due_on date,
  priority smallint not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  raw_text text not null,
  parse_status public.inbound_status not null default 'pending',
  parsed_amount_cents bigint,
  parsed_category_id uuid references public.categories (id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_household_occurred_idx
  on public.transactions (household_id, occurred_on desc);
create index if not exists bill_instances_household_competence_idx
  on public.bill_instances (household_id, competence);
create index if not exists categories_household_kind_idx
  on public.categories (household_id, kind);
create index if not exists inbound_messages_household_status_idx
  on public.inbound_messages (household_id, parse_status);
