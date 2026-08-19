"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createGoal } from "@/lib/actions/goals";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import type { BankAccount } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Plantando..." : "Criar objetivo"}
    </Button>
  );
}

export function GoalForm({ accounts }: { accounts: BankAccount[] }) {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => createGoal(formData),
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium text-slate-600">
        Objetivo
        <input
          name="name"
          required
          placeholder="Reserva de emergência"
          className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Alvo
          <input
            name="target"
            required
            placeholder="10.000,00"
            className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Prazo
          <DateField name="due_on" />
        </label>
      </div>
      {accounts.length > 0 ? (
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Conta da reserva
          <Select
            name="account_id"
            defaultValue={accounts.find((item) => item.kind === "poupanca")?.id ?? accounts[0]?.id}
            options={accounts.map((account) => ({ value: account.id, label: account.name }))}
          />
        </label>
      ) : null}
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Submit />
    </form>
  );
}
