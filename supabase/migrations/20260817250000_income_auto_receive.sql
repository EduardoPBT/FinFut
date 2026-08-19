alter table public.income_instances
  add column if not exists suppress_auto_receive boolean not null default false;
