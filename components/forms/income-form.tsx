"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createIncomeSource } from "@/lib/actions/income";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { BankAccount, Category, Member } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Salvando..." : "Criar receita recorrente"}
    </Button>
  );
}

export function IncomeForm({
  categories,
  members,
  accounts,
  yearMonth,
}: {
  categories: Category[];
  members: Member[];
  accounts: BankAccount[];
  yearMonth: string;
}) {
  const receitas = categories.filter((category) => category.kind === "receita");
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      createIncomeSource(formData),
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
          placeholder="Salário (você)"
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
            placeholder="5.000,00"
            className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Dia previsto
          <input
            name="payday"
            type="number"
            min={1}
            max={31}
            defaultValue={5}
            className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Quem recebe
        <Select
          name="member_id"
          defaultValue={members[0]?.id}
          options={members.map((member) => ({
            value: member.id,
            label: member.display_name,
          }))}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Tipo
          <Select
            name="kind"
            defaultValue="fixo"
            options={[
              { value: "fixo", label: "Fixo (salário)" },
              { value: "variavel", label: "Variável (extra)" },
            ]}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Categoria
          <Select
            name="category_id"
            defaultValue={receitas[0]?.id}
            options={receitas.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        </label>
      </div>
      {accounts.length > 0 ? (
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Conta destino
          <Select
            name="account_id"
            defaultValue={accounts[0]?.id}
            options={accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
          />
        </label>
      ) : null}
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
