"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBankAccount, deleteBankAccount, updateBankAccount } from "@/lib/actions/accounts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatBRL, formatBRLInput } from "@/lib/money/brl";
import type { BankAccount } from "@/lib/types";

const KIND_OPTIONS = [
  { value: "corrente", label: "Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "dinheiro", label: "Dinheiro" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function AccountManager({
  accounts,
  balances,
}: {
  accounts: BankAccount[];
  balances: Map<string, number>;
}) {
  const [createState, createAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => createBankAccount(formData),
    null,
  );

  return (
    <div className="grid gap-4">
      <form action={createAction} className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto] md:items-end">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Nova conta
          <input name="name" required placeholder="Nubank conjunto" className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Tipo
          <Select name="kind" defaultValue="corrente" options={KIND_OPTIONS} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Saldo inicial
          <input name="initial_balance" inputMode="decimal" defaultValue="0,00" className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
        </label>
        <Submit label="criar" />
      </form>
      {createState?.error ? <p className="text-sm text-rose-600">{createState.error}</p> : null}
      {accounts.map((account) => (
        <form
          key={account.id}
          action={async (formData) => {
            await updateBankAccount(formData);
          }}
          className="grid gap-2 rounded-2xl bg-white/50 p-3 md:grid-cols-[1fr_140px_140px_auto_auto] md:items-end"
        >
          <input type="hidden" name="id" value={account.id} />
          <label className="grid gap-1 text-xs text-slate-500">
            Nome
            <input name="name" defaultValue={account.name} className="rounded-2xl bg-white/80 px-3 py-2 outline-none" />
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            Tipo
            <Select name="kind" defaultValue={account.kind} options={KIND_OPTIONS} />
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            Saldo inicial
            <input name="initial_balance" defaultValue={formatBRLInput(account.initial_balance_cents)} className="rounded-2xl bg-white/80 px-3 py-2 outline-none" />
          </label>
          <p className="text-sm font-semibold text-teal-800">
            {formatBRL(balances.get(account.id) ?? account.initial_balance_cents)}
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="soft" className="px-3 py-2">ok</Button>
            <button formAction={deleteBankAccount} className="text-xs text-slate-400">ocultar</button>
          </div>
        </form>
      ))}
    </div>
  );
}
