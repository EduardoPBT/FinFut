do $$ begin
  create type public.payment_method as enum ('pix', 'debito', 'credito', 'boleto', 'outro');
exception when duplicate_object then null;
end $$;

alter table public.bill_instances
  add column if not exists payment_method public.payment_method,
  add column if not exists payment_account text,
  add column if not exists paid_on date,
  add column if not exists transaction_id uuid references public.transactions (id) on delete set null;

alter table public.transactions
  add column if not exists bill_instance_id uuid references public.bill_instances (id) on delete set null;

create index if not exists transactions_bill_instance_idx
  on public.transactions (bill_instance_id)
  where bill_instance_id is not null;
