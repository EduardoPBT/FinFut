create or replace function private.user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.households where owner_id = auth.uid();
$$;

revoke all on function private.user_household_ids() from public;
grant execute on function private.user_household_ids() to authenticated, service_role;

create or replace function private.seed_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voce uuid;
  v_esposa uuid;
begin
  insert into public.members (household_id, display_name, role)
  values (p_household_id, 'Você', 'voce')
  returning id into v_voce;

  insert into public.members (household_id, display_name, role)
  values (p_household_id, 'Esposa', 'esposa')
  returning id into v_esposa;

  insert into public.income_sources (household_id, member_id, name, kind, typical_amount_cents, payday)
  values
    (p_household_id, v_voce, 'Salário (você)', 'fixo', 0, 5),
    (p_household_id, v_esposa, 'Salário (esposa)', 'fixo', 0, 5),
    (p_household_id, null, 'Extra / variável', 'variavel', 0, null);

  insert into public.categories (household_id, name, kind, icon, color, sort_order) values
    (p_household_id, 'Salário', 'receita', 'wallet', '#0ea5e9', 1),
    (p_household_id, 'Extra', 'receita', 'spark', '#38bdf8', 2),
    (p_household_id, 'Moradia', 'fixa', 'home', '#0f766e', 10),
    (p_household_id, 'Energia', 'fixa', 'bolt', '#14b8a6', 11),
    (p_household_id, 'Água', 'fixa', 'drop', '#22d3ee', 12),
    (p_household_id, 'Internet', 'fixa', 'wifi', '#06b6d4', 13),
    (p_household_id, 'Celular', 'fixa', 'phone', '#0891b2', 14),
    (p_household_id, 'Saúde', 'fixa', 'heart', '#0d9488', 15),
    (p_household_id, 'Transporte', 'fixa', 'bus', '#155e75', 16),
    (p_household_id, 'Streaming', 'fixa', 'play', '#67e8f9', 17),
    (p_household_id, 'Academia', 'fixa', 'dumbbell', '#2dd4bf', 18),
    (p_household_id, 'Mercado', 'variavel', 'cart', '#0284c7', 20),
    (p_household_id, 'Delivery', 'variavel', 'bag', '#38bdf8', 21),
    (p_household_id, 'Lazer', 'variavel', 'smile', '#7dd3fc', 22),
    (p_household_id, 'Farmácia', 'variavel', 'plus', '#22d3ee', 23),
    (p_household_id, 'Vestuário', 'variavel', 'shirt', '#67e8f9', 24),
    (p_household_id, 'Outros', 'variavel', 'dots', '#94a3b8', 25);
end;
$$;

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

  select id into v_id from public.households where owner_id = p_user_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.households (owner_id, name)
  values (p_user_id, 'Nossa casa')
  returning id into v_id;

  perform private.seed_household(v_id);
  return v_id;
end;
$$;

create or replace function public.ensure_my_household()
returns uuid
language sql
security definer
set search_path = public, private
as $$
  select private.ensure_household(auth.uid());
$$;

revoke all on function public.ensure_my_household() from public;
grant execute on function public.ensure_my_household() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.ensure_household(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.income_sources enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.bill_instances enable row level security;
alter table public.goals enable row level security;
alter table public.inbound_messages enable row level security;

create policy households_owner on public.households
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy members_household on public.members
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy income_sources_household on public.income_sources
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy categories_household on public.categories
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy transactions_household on public.transactions
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy recurring_bills_household on public.recurring_bills
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy bill_instances_household on public.bill_instances
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy goals_household on public.goals
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

create policy inbound_messages_household on public.inbound_messages
  for all to authenticated
  using (household_id in (select private.user_household_ids()))
  with check (household_id in (select private.user_household_ids()));

grant usage on schema private to postgres, service_role;
revoke all on function private.ensure_household(uuid) from public;
revoke all on function private.seed_household(uuid) from public;
revoke all on function private.handle_new_user() from public;
