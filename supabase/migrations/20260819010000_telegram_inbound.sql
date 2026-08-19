do $$
begin
  alter type public.transaction_origin add value 'telegram';
exception
  when duplicate_object then null;
end
$$;

alter table public.households
  add column if not exists telegram_chat_id text;

create unique index if not exists households_telegram_chat_id_idx
  on public.households (telegram_chat_id)
  where telegram_chat_id is not null;

alter table public.inbound_messages
  add column if not exists source text not null default 'app',
  add column if not exists parsed_installments smallint not null default 1,
  add column if not exists parsed_payment_method public.payment_method,
  add column if not exists parsed_kind public.movement_kind,
  add column if not exists telegram_update_id bigint,
  add column if not exists confidence numeric;

create unique index if not exists inbound_messages_telegram_update_idx
  on public.inbound_messages (telegram_update_id)
  where telegram_update_id is not null;
