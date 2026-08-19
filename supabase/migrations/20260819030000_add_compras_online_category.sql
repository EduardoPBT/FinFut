-- Categoria para marketplaces e compras na internet (Mercado Livre, Amazon, etc.)
insert into public.categories (household_id, name, kind, icon, color, sort_order)
select h.id, 'Compras online', 'variavel', 'bag', '#6366f1', 95
from public.households h
where not exists (
  select 1
  from public.categories c
  where c.household_id = h.id
    and c.name = 'Compras online'
);
