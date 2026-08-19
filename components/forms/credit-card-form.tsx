"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCreditCard, deleteCreditCard, updateCreditCard } from "@/lib/actions/credit-cards";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatBRLInput } from "@/lib/money/brl";
import type { BankAccount, CreditCard } from "@/lib/types";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function CreditCardManager({
  cards,
  accounts,
}: {
  cards: CreditCard[];
  accounts: BankAccount[];
}) {
  const accountOptions = [
    { value: "", label: "Sem conta pagadora" },
    ...accounts.map((account) => ({ value: account.id, label: account.name })),
  ];
  const [createState, createAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => createCreditCard(formData),
    null,
  );

  return (
    <div className="grid gap-4">
      <form action={createAction} className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Novo cartão
          <input name="name" required placeholder="Visa Nubank" className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Fecha dia
            <input name="closing_day" type="number" min={1} max={31} defaultValue={10} className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Vence dia
            <input name="due_day" type="number" min={1} max={31} defaultValue={20} className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Conta que paga a fatura
          <Select name="payment_account_id" defaultValue="" options={accountOptions} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Limite (R$)
          <input name="credit_limit" placeholder="5.000,00" className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
        </label>
        <Submit label="criar cartão" />
      </form>
      {createState?.error ? <p className="text-sm text-rose-600">{createState.error}</p> : null}
      {cards.map((card) => (
        <form
          key={card.id}
          action={async (formData) => {
            await updateCreditCard(formData);
          }}
          className="grid gap-2 rounded-2xl bg-white/50 p-3"
        >
          <input type="hidden" name="id" value={card.id} />
          <input name="name" defaultValue={card.name} className="rounded-2xl bg-white/80 px-3 py-2 outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input name="closing_day" type="number" defaultValue={card.closing_day} className="rounded-2xl bg-white/80 px-3 py-2 outline-none" />
            <input name="due_day" type="number" defaultValue={card.due_day} className="rounded-2xl bg-white/80 px-3 py-2 outline-none" />
          </div>
          <Select name="payment_account_id" defaultValue={card.payment_account_id ?? ""} options={accountOptions} />
          <input
            name="credit_limit"
            defaultValue={card.credit_limit_cents ? formatBRLInput(card.credit_limit_cents) : ""}
            placeholder="limite"
            className="rounded-2xl bg-white/80 px-3 py-2 outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button type="submit" variant="soft" className="px-3 py-2">ok</Button>
            <button formAction={deleteCreditCard} className="text-xs text-slate-400">ocultar</button>
          </div>
        </form>
      ))}
    </div>
  );
}
