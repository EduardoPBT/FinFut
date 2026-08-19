-- Uma transação por instância de receita recorrente.
-- Limpeza: remove órfãos antes do índice (corrida no auto-recebimento).
delete from public.transactions t
where t.income_instance_id is not null
  and not exists (
    select 1
    from public.income_instances ii
    where ii.transaction_id = t.id
  );

create unique index if not exists transactions_income_instance_id_unique
  on public.transactions (income_instance_id)
  where income_instance_id is not null;

-- Telegram: notas vazias (categoria já aparece na lista)
update public.transactions
set notes = null
where origin = 'telegram'
  and notes is not null;
