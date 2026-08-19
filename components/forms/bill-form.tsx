"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createRecurringBill } from "@/lib/actions/bills";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/money/bill-payment";
import type { BankAccount, Category, CreditCard } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Salvando..." : "Criar conta fixa"}
    </Button>
  );
}

export function BillForm({
  categories,
  accounts,
  cards,
  yearMonth,
}: {
  categories: Category[];
  accounts: BankAccount[];
  cards: CreditCard[];
  yearMonth: string;
}) {
  const fixed = categories.filter((category) => category.kind === "fixa");
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      createRecurringBill(formData),
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="mes" value={yearMonth} />
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Nome
        <input
          name="name"
          required
          placeholder="Internet"
          className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Valor (R$)
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="120,00"
            className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Dia do vencimento
          <input
            name="due_day"
            type="number"
            min={1}
            max={31}
            defaultValue={10}
            className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Categoria
        <Select
          name="category_id"
          defaultValue={fixed[0]?.id}
          options={fixed.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Pagamento padrão
        <Select
          name="payment_method"
          defaultValue="pix"
          options={PAYMENT_METHODS.map((item) => ({
            value: item.value,
            label: item.label,
          }))}
        />
      </label>
      {accounts.length > 0 ? (
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Conta padrão
          <Select
            name="account_id"
            defaultValue={accounts[0]?.id}
            options={accounts.map((account) => ({ value: account.id, label: account.name }))}
          />
        </label>
      ) : null}
      {cards.length > 0 ? (
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Cartão padrão
          <Select
            name="credit_card_id"
            defaultValue={cards[0]?.id}
            options={[
              { value: "", label: "Nenhum" },
              ...cards.map((card) => ({ value: card.id, label: card.name })),
            ]}
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="amount_flexible" className="rounded" />
        Valor varia no mês (energia, água)
      </label>
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
