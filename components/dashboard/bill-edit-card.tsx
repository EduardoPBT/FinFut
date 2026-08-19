"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRecurringBill, updateRecurringBill } from "@/lib/actions/bills";
import { BillRow } from "@/components/dashboard/bill-row";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/money/bill-payment";
import { formatBRLInput } from "@/lib/money/brl";
import type { BankAccount, BillInstanceView, Category, CreditCard, RecurringBill } from "@/lib/types";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="flex-1">
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function BillEditCard({
  instance,
  bill,
  categories,
  accounts,
  cards,
  yearMonth,
}: {
  instance: BillInstanceView;
  bill: RecurringBill;
  categories: Category[];
  accounts: BankAccount[];
  cards: CreditCard[];
  yearMonth: string;
}) {
  const [editing, setEditing] = useState(false);
  const fixed = categories.filter((category) => category.kind === "fixa");
  const [state, updateAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await updateRecurringBill(formData);
      if (result?.ok) setEditing(false);
      return result;
    },
    null,
  );

  if (editing) {
    return (
      <form action={updateAction} className="grid gap-3 p-3">
        <input type="hidden" name="id" value={bill.id} />
        <input type="hidden" name="instance_id" value={instance.id} />
        <input type="hidden" name="mes" value={yearMonth} />
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Nome
          <input
            name="name"
            required
            defaultValue={bill.name}
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
              defaultValue={formatBRLInput(instance.amount_cents)}
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
              required
              defaultValue={bill.due_day}
              className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Categoria
          <Select
            name="category_id"
            defaultValue={bill.category_id ?? fixed[0]?.id}
            options={fixed.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        </label>
        {accounts.length > 0 ? (
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Conta padrão
            <Select
              name="account_id"
              defaultValue={bill.default_account_id ?? accounts[0]?.id}
              options={accounts.map((account) => ({ value: account.id, label: account.name }))}
            />
          </label>
        ) : null}
        {cards.length > 0 ? (
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Cartão padrão
            <Select
              name="credit_card_id"
              defaultValue={bill.default_credit_card_id ?? ""}
              options={[
                { value: "", label: "Nenhum" },
                ...cards.map((card) => ({ value: card.id, label: card.name })),
              ]}
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Pagamento padrão
          <Select
            name="payment_method"
            defaultValue={bill.default_payment_method ?? "pix"}
            options={PAYMENT_METHODS.map((item) => ({ value: item.value, label: item.label }))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="amount_flexible"
            defaultChecked={bill.amount_flexible}
            className="rounded"
          />
          Valor deste mês pode diferir do modelo
        </label>
        {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        <div className="flex gap-2">
          <SaveButton />
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-2">
      <BillRow instance={instance} bill={bill} accounts={accounts} cards={cards} />
      <div className="flex justify-end gap-3 px-3 pb-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-teal-700"
        >
          editar conta
        </button>
        <form action={deleteRecurringBill}>
          <input type="hidden" name="id" value={bill.id} />
          <button className="text-xs text-slate-400" type="submit">
            remover
          </button>
        </form>
      </div>
    </div>
  );
}
