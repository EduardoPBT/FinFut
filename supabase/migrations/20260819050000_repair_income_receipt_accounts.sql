-- Receitas auto-recebidas sem conta bancária não entravam no saldo em caixa.
update public.transactions t
set account_id = coalesce(ii.account_id, isrc.default_account_id, (
  select ba.id
  from public.bank_accounts ba
  where ba.household_id = t.household_id and ba.active = true
  order by ba.created_at
  limit 1
))
from public.income_instances ii
join public.income_sources isrc on isrc.id = ii.income_source_id
where t.id = ii.transaction_id
  and t.movement_kind = 'receita'
  and t.account_id is null;

update public.income_instances ii
set account_id = t.account_id
from public.transactions t
where t.id = ii.transaction_id
  and ii.account_id is null
  and t.account_id is not null;
