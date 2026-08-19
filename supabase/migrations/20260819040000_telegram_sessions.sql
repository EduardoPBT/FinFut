-- Sessão multi-passo do Telegram (confirmação de edição/exclusão). Uma por chat.
create table if not exists public.telegram_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  chat_id text not null,
  step text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists telegram_sessions_chat_id_unique
  on public.telegram_sessions (chat_id);

create index if not exists telegram_sessions_expires_idx
  on public.telegram_sessions (expires_at);

alter table public.telegram_sessions enable row level security;
