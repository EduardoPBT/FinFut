revoke all on function public.join_household_by_code(text) from public, anon;
grant execute on function public.join_household_by_code(text) to authenticated;

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
    (p_household_id, 'Reserva', 'fixa', 'seed', '#0f766e', 19),
    (p_household_id, 'Mercado', 'variavel', 'cart', '#0284c7', 20),
    (p_household_id, 'Delivery', 'variavel', 'bag', '#38bdf8', 21),
    (p_household_id, 'Lazer', 'variavel', 'smile', '#7dd3fc', 22),
    (p_household_id, 'Farmácia', 'variavel', 'plus', '#22d3ee', 23),
    (p_household_id, 'Vestuário', 'variavel', 'shirt', '#67e8f9', 24),
    (p_household_id, 'Outros', 'variavel', 'dots', '#94a3b8', 25);
end;
$$;
