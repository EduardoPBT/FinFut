"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCardPurchase } from "@/lib/actions/credit-cards";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  INSTALLMENT_OPTIONS,
  InstallmentPlanPreview,
} from "@/components/forms/installment-plan-preview";
import { DateField } from "@/components/ui/date-field";
import { defaultPaidOn } from "@/lib/money/bill-payment";
import { parseBRLToCents } from "@/lib/money/brl";
import type { Category, CreditCard, Member } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Lançando..." : "Lançar no cartão"}
    </Button>
  );
}

export function CardChargeForm({
  card,
  cards,
  categories,
  members,
}: {
  card?: CreditCard;
  cards: CreditCard[];
  categories: Category[];
  members: Member[];
}) {
  const expenses = categories.filter((item) => item.kind !== "receita");
  const [cardId, setCardId] = useState(card?.id ?? cards[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultPaidOn());
  const [installments, setInstallments] = useState("1");
  const selected = cards.find((item) => item.id === cardId) ?? card ?? cards[0];
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => createCardPurchase(formData),
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      <Select
        name="credit_card_id"
        defaultValue={cardId}
        options={cards.map((item) => ({ value: item.id, label: item.name }))}
        onValueChange={setCardId}
      />
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Valor total
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="1.000,00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Data da compra
          <DateField
            name="occurred_on"
            required
            value={occurredOn}
            onValueChange={setOccurredOn}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Parcelas
          <Select
            name="installments"
            defaultValue="1"
            options={INSTALLMENT_OPTIONS}
            onValueChange={setInstallments}
          />
        </label>
      </div>
      <InstallmentPlanPreview
        card={selected}
        purchaseDate={occurredOn}
        amountCents={parseBRLToCents(amount)}
        installments={Number(installments) || 1}
      />
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Categoria
        <Select
          name="category_id"
          defaultValue={expenses[0]?.id}
          options={expenses.map((item) => ({ value: item.id, label: item.name }))}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Quem
        <Select
          name="member_id"
          defaultValue={members[0]?.id}
          options={members.map((item) => ({ value: item.id, label: item.display_name }))}
        />
      </label>
      <input
        name="notes"
        placeholder="Mercado, Uber..."
        className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
      />
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
