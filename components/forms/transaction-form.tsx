"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  INSTALLMENT_OPTIONS,
  InstallmentPlanPreview,
} from "@/components/forms/installment-plan-preview";
import { DateField } from "@/components/ui/date-field";
import { parseBRLToCents } from "@/lib/money/brl";
import type { BankAccount, Category, CreditCard, Member } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Guardando..." : "Lançar"}
    </Button>
  );
}

export function TransactionForm({
  categories,
  members,
  accounts,
  cards,
  defaultDate,
  onDone,
}: {
  categories: Category[];
  members: Member[];
  accounts: BankAccount[];
  cards: CreditCard[];
  defaultDate: string;
  onDone?: () => void;
}) {
  const [instrument, setInstrument] = useState("conta");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultDate);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [installments, setInstallments] = useState("1");
  const selectedCard = cards.find((item) => item.id === cardId) ?? cards[0];
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await createTransaction(formData);
      if (result?.ok) onDone?.();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        {instrument === "cartao" ? "Valor total" : "Valor"}
        <input
          name="amount"
          inputMode="decimal"
          required
          placeholder="87,50"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-lg text-slate-800 outline-none ring-teal-300 focus:ring-2"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Onde
        <Select
          name="instrument"
          defaultValue="conta"
          options={[
            { value: "conta", label: "Conta (Pix, débito, dinheiro)" },
            { value: "cartao", label: "Cartão de crédito" },
            { value: "transferencia", label: "Entre contas" },
          ]}
          onValueChange={setInstrument}
        />
      </label>
      {instrument === "cartao" ? (
        <>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Cartão
            <Select
              name="credit_card_id"
              defaultValue={cards[0]?.id}
              options={cards.map((card) => ({ value: card.id, label: card.name }))}
              onValueChange={setCardId}
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
          <InstallmentPlanPreview
            card={selectedCard}
            purchaseDate={occurredOn}
            amountCents={parseBRLToCents(amount)}
            installments={Number(installments) || 1}
          />
        </>
      ) : instrument === "transferencia" ? (
        accounts.length > 1 ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-600">
              Sai de
              <Select
                name="account_id"
                defaultValue={accounts[0]?.id}
                options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-600">
              Entra em
              <Select
                name="destination_account_id"
                defaultValue={accounts[1]?.id}
                options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              />
            </label>
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            Cadastre uma segunda conta em Configurações para transferir.
          </p>
        )
      ) : accounts.length > 0 ? (
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Conta
          <Select
            name="account_id"
            defaultValue={accounts[0]?.id}
            options={accounts.map((account) => ({ value: account.id, label: account.name }))}
          />
        </label>
      ) : null}
      {instrument !== "transferencia" ? (
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Categoria
        <Select
          name="category_id"
          required
          defaultValue={categories[0]?.id}
          options={categories.map((category) => ({
            value: category.id,
            label: `${category.name} · ${category.kind}`,
          }))}
        />
      </label>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Quem
          <Select
            name="member_id"
            defaultValue={members[0]?.id}
            options={members.map((member) => ({
              value: member.id,
              label: member.display_name,
            }))}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Data
          <DateField
            name="occurred_on"
            required
            value={occurredOn}
            onValueChange={setOccurredOn}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Nota
        <input
          name="notes"
          placeholder="opcional"
          className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-slate-800 outline-none"
        />
      </label>
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
