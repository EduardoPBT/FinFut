"use client";

import { useActionState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  confirmInbound,
  dismissInbound,
  ingestInboundMessage,
} from "@/lib/actions/inbound";
import { formatBRL } from "@/lib/money/brl";
import type {
  BankAccount,
  Category,
  CreditCard,
  InboundMessage,
} from "@/lib/types";

export function InboxBoard({
  inbound,
  categories,
  accounts,
  cards,
}: {
  inbound: InboundMessage[];
  categories: Category[];
  accounts: BankAccount[];
  cards: CreditCard[];
}) {
  const [ingestState, ingestAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      ingestInboundMessage(formData),
    null,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <GlassPanel className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Colar recado</p>
        <form action={ingestAction} className="grid gap-3">
          <textarea
            name="raw_text"
            required
            placeholder="mercado 87,50 nubank 3x"
            className="min-h-28 rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
          <Button type="submit">ler mensagem</Button>
        </form>
        {ingestState?.error ? (
          <p className="mt-2 text-sm text-rose-600">{ingestState.error}</p>
        ) : null}
      </GlassPanel>
      <div className="grid gap-3">
        {inbound.length === 0 ? (
          <GlassPanel className="p-8 text-center text-sm text-slate-500">
            Nenhuma mensagem pendente. Mande um áudio ou texto no Telegram, ou cole aqui.
          </GlassPanel>
        ) : (
          inbound.map((item) => (
            <InboxItem
              key={item.id}
              item={item}
              categories={categories}
              accounts={accounts}
              cards={cards}
            />
          ))
        )}
      </div>
    </div>
  );
}

function InboxItem({
  item,
  categories,
  accounts,
  cards,
}: {
  item: InboundMessage;
  categories: Category[];
  accounts: BankAccount[];
  cards: CreditCard[];
}) {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      confirmInbound(formData),
    null,
  );

  return (
    <GlassPanel className="p-4">
      <p className="text-sm text-slate-700">{item.raw_text}</p>
      <p className="mt-1 text-xs text-slate-500">
        {item.source === "telegram" ? "Telegram · " : ""}
        {item.parsed_amount_cents ? formatBRL(item.parsed_amount_cents) : "sem valor"}
        {item.parsed_payment_method ? ` · ${item.parsed_payment_method}` : ""}
        {item.parsed_installments && item.parsed_installments > 1
          ? ` · ${item.parsed_installments}x`
          : ""}
      </p>
      <form action={action} className="mt-3 grid gap-2">
        <input type="hidden" name="id" value={item.id} />
        <Select
          name="category_id"
          defaultValue={item.parsed_category_id ?? categories[0]?.id}
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
        <Select
          name="instrument"
          defaultValue={item.parsed_payment_method === "credito" ? "cartao" : "conta"}
          options={[
            { value: "conta", label: "Conta" },
            { value: "cartao", label: "Cartão" },
          ]}
        />
        {accounts[0] ? (
          <Select
            name="account_id"
            defaultValue={accounts[0].id}
            options={accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
          />
        ) : null}
        {cards[0] ? (
          <Select
            name="credit_card_id"
            defaultValue={cards[0].id}
            options={cards.map((card) => ({
              value: card.id,
              label: card.name,
            }))}
          />
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">lançar</Button>
          <button formAction={dismissInbound} className="text-xs text-slate-400">
            ignorar
          </button>
        </div>
      </form>
      {state?.error ? <p className="mt-1 text-sm text-rose-600">{state.error}</p> : null}
    </GlassPanel>
  );
}
