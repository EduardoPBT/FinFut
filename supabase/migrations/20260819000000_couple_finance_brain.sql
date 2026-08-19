alter table public.transactions
  add column if not exists destination_account_id uuid references public.bank_accounts (id) on delete set null,
  add column if not exists goal_id uuid references public.goals (id) on delete set null;

alter table public.recurring_bills
  add column if not exists amount_flexible boolean not null default false;

alter table public.credit_cards
  add column if not exists credit_limit_cents bigint check (credit_limit_cents is null or credit_limit_cents >= 0);

alter table public.card_statements
  add column if not exists paid_cents bigint not null default 0 check (paid_cents >= 0);

alter table public.goals
  add column if not exists account_id uuid references public.bank_accounts (id) on delete set null;

alter table public.households
  add column if not exists invite_code text,
  add column if not exists reminder_days smallint not null default 3 check (reminder_days >= 1 and reminder_days <= 14);

update public.households
set invite_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where invite_code is null;

alter table public.households
  alter column invite_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

create unique index if not exists households_invite_code_idx
  on public.households (invite_code);

create table if not exists public.household_users (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

insert into public.household_users (household_id, user_id, is_primary)
select id, owner_id, true from public.households
on conflict do nothing;

alter table public.household_users enable row level security;

create policy household_users_self on public.household_users
  for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_limit_cents bigint not null check (monthly_limit_cents > 0),
  unique (household_id, category_id)
);

alter table public.category_budgets enable row level security;

create policy category_budgets_household on public.category_budgets
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create table if not exists public.annual_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind public.category_kind not null default 'fixa',
  event_month smallint not null check (event_month >= 1 and event_month <= 12),
  amount_cents bigint not null check (amount_cents > 0),
  due_day smallint not null default 20 check (due_day >= 1 and due_day <= 31),
  category_id uuid references public.categories (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.annual_events enable row level security;

create policy annual_events_household on public.annual_events
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

insert into public.categories (household_id, name, kind, icon, color, sort_order)
select h.id, 'Reserva', 'fixa', 'seed', '#0f766e', 19
from public.households h
where not exists (
  select 1 from public.categories c
  where c.household_id = h.id and c.name = 'Reserva'
);

create or replace function private.user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.household_users where user_id = auth.uid()
  union
  select id from public.households where owner_id = auth.uid();
$$;

drop policy if exists households_owner on public.households;

create policy households_members on public.households
  for all to authenticated
  using (id in (select private.user_household_ids()) or owner_id = auth.uid())
  with check (id in (select private.user_household_ids()) or owner_id = auth.uid());

create or replace function private.ensure_household(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'not authenticated';
  end if;

  select household_id into v_id
  from public.household_users
  where user_id = p_user_id and is_primary
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_id from public.households where owner_id = p_user_id;
  if v_id is not null then
    insert into public.household_users (household_id, user_id, is_primary)
    values (v_id, p_user_id, true)
    on conflict do nothing;
    return v_id;
  end if;

  insert into public.households (owner_id, name)
  values (p_user_id, 'Nossa casa')
  returning id into v_id;

  insert into public.household_users (household_id, user_id, is_primary)
  values (v_id, p_user_id, true)
  on conflict do nothing;

  perform private.seed_household(v_id);
  return v_id;
end;
$$;

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_id
  from public.households
  where lower(invite_code) = lower(trim(p_code));

  if v_id is null then
    raise exception 'Código inválido';
  end if;

  update public.household_users
  set is_primary = false
  where user_id = v_uid;

  insert into public.household_users (household_id, user_id, is_primary)
  values (v_id, v_uid, true)
  on conflict (household_id, user_id)
  do update set is_primary = true;

  return v_id;
end;
$$;

revoke all on function public.join_household_by_code(text) from public, anon;
grant execute on function public.join_household_by_code(text) to authenticated;
