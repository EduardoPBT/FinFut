"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteIncomeSource,
  markIncomeReceived,
  unmarkIncomeReceived,
  updateIncomeSource,
} from "@/lib/actions/income";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { defaultPaidOn } from "@/lib/money/bill-payment";
import {
  incomeAmountTone,
  incomeDueLabel,
  incomeReceivedLabel,
  incomeStatusLabel,
} from "@/lib/money/income-status";
import { formatBRLInput } from "@/lib/money/brl";
import type { BankAccount, Category, IncomeInstanceView, IncomeSource, Member } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/chip";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="flex-1">
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

function ReceiveSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Registrando..." : "Confirmar recebimento"}
    </Button>
  );
}

function IncomeStatusChip({ status }: { status: IncomeInstanceView["status"] }) {
  return (
    <Chip
      active={status === "recebido"}
      className={cn(
        status === "atrasado" && "bg-amber-100 text-amber-800 ring-amber-200",
        status === "vence_hoje" && "bg-amber-100 text-amber-800 ring-amber-200",
        status === "pendente" && "bg-sky-50 text-sky-800 ring-sky-100",
        status === "recebido" && "bg-emerald-600 text-white ring-emerald-500/30",
      )}
    >
      {incomeStatusLabel(status)}
    </Chip>
  );
}

export function IncomeEditCard({
  instance,
  source,
  categories,
  members,
  accounts,
  yearMonth,
}: {
  instance: IncomeInstanceView;
  source: IncomeSource;
  categories: Category[];
  members: Member[];
  accounts: BankAccount[];
  yearMonth: string;
}) {
  const [editing, setEditing] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const receitas = categories.filter((category) => category.kind === "receita");
  const received = instance.status === "recebido";

  const [updateState, updateAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await updateIncomeSource(formData);
      if (result?.ok) setEditing(false);
      return result;
    },
    null,
  );

  const [receiveState, receiveAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await markIncomeReceived(formData);
      if (result?.ok) setReceiveOpen(false);
      return result;
    },
    null,
  );

  if (editing) {
    return (
      <form action={updateAction} className="grid gap-3 p-3">
        <input type="hidden" name="id" value={source.id} />
        <input type="hidden" name="instance_id" value={instance.id} />
        <input type="hidden" name="mes" value={yearMonth} />
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Nome
          <input name="name" required defaultValue={source.name} className="rounded-2xl bg-white/80 px-4 py-3 outline-none" />
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
            Dia previsto
            <input
              name="payday"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={source.payday ?? 5}
              className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Quem
            <Select
              name="member_id"
              defaultValue={source.member_id ?? members[0]?.id}
              options={members.map((member) => ({
                value: member.id,
                label: member.display_name,
              }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Tipo
            <Select
              name="kind"
              defaultValue={source.kind}
              options={[
                { value: "fixo", label: "Fixo (salário)" },
                { value: "variavel", label: "Variável (extra)" },
              ]}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Categoria
          <Select
            name="category_id"
            defaultValue={source.category_id ?? receitas[0]?.id}
            options={receitas.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        </label>
        {accounts.length > 0 ? (
          <label className="grid gap-1 text-sm font-medium text-slate-600">
            Conta destino
            <Select
              name="account_id"
              defaultValue={instance.account_id ?? source.default_account_id ?? accounts[0]?.id}
              options={accounts.map((account) => ({
                value: account.id,
                label: account.name,
              }))}
            />
          </label>
        ) : null}
        {updateState?.error ? <p className="text-sm text-rose-600">{updateState.error}</p> : null}
        <div className="flex gap-2">
          <SaveButton />
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>cancelar</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition",
          received && "bg-emerald-50/85",
          instance.status === "atrasado" && "bg-amber-50/70",
          instance.status === "vence_hoje" && "bg-amber-50/70",
          instance.status === "pendente" && "bg-white/55",
        )}
      >
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg",
            received && "bg-emerald-500 text-white",
            instance.status === "atrasado" && "bg-amber-100 text-amber-800",
            instance.status === "vence_hoje" && "bg-amber-100 text-amber-800",
            instance.status === "pendente" && "bg-sky-100 text-sky-800",
          )}
        >
          {received ? "✓" : "↗"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{source.name}</span>
            <IncomeStatusChip status={instance.status} />
          </span>
          <span className={cn("block text-xs", received ? "font-medium text-emerald-700" : "text-slate-500")}>
            {received && instance.received_on
              ? incomeReceivedLabel(instance.received_on)
              : incomeDueLabel(instance.expected_on)}
          </span>
          {source.kind === "variavel" ? (
            <span className="text-[11px] uppercase tracking-wide text-slate-400">extra</span>
          ) : null}
        </span>
        <Amount cents={instance.amount_cents} tone={incomeAmountTone(instance.status)} />
      </div>
      <div className="flex justify-end gap-3 px-3 pb-1">
        {received ? (
          <form action={unmarkIncomeReceived}>
            <input type="hidden" name="instance_id" value={instance.id} />
            <button type="submit" className="text-xs text-slate-400 hover:text-slate-600">
              desfazer recebimento
            </button>
          </form>
        ) : (
          <Button type="button" variant="soft" className="px-3 py-1.5 text-xs" onClick={() => setReceiveOpen(true)}>
            registrar recebimento
          </Button>
        )}
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-sky-700">
          editar
        </button>
        <form action={deleteIncomeSource}>
          <input type="hidden" name="id" value={source.id} />
          <button className="text-xs text-slate-400" type="submit">remover</button>
        </form>
      </div>
      <ModalPortal>
        <AnimatePresence>
          {receiveOpen ? (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-end bg-slate-900/30 p-4 backdrop-blur-sm sm:place-items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReceiveOpen(false)}
            >
              <motion.form
                action={receiveAction}
                className="max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white/95 p-5 shadow-2xl"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                onClick={(event) => event.stopPropagation()}
              >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">entrada</p>
              <h3 className="mt-1 text-xl font-bold text-slate-800">{source.name}</h3>
              <input type="hidden" name="instance_id" value={instance.id} />
              <input type="hidden" name="source_name" value={source.name} />
              <input type="hidden" name="category_id" value={source.category_id ?? ""} />
              <input type="hidden" name="member_id" value={source.member_id ?? ""} />
              <input type="hidden" name="amount_cents" value={instance.amount_cents} />
              {accounts.length > 0 ? (
                <label className="mt-4 grid gap-1 text-sm font-medium text-slate-600">
                  Conta destino
                  <Select
                    name="account_id"
                    defaultValue={instance.account_id ?? source.default_account_id ?? accounts[0]?.id}
                    options={accounts.map((account) => ({
                      value: account.id,
                      label: account.name,
                    }))}
                  />
                </label>
              ) : null}
              <label className="mt-4 grid gap-1 text-sm font-medium text-slate-600">
                Data que entrou
                <DateField name="received_on" required defaultValue={defaultPaidOn()} />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Um lançamento de receita será criado em Fluxo.
              </p>
              {receiveState?.error ? <p className="mt-2 text-sm text-rose-600">{receiveState.error}</p> : null}
              <div className="mt-4 grid gap-2">
                <ReceiveSubmit />
                <Button type="button" variant="ghost" onClick={() => setReceiveOpen(false)}>cancelar</Button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
        </AnimatePresence>
      </ModalPortal>
    </div>
  );
}
