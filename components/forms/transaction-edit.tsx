"use client";

import { useState } from "react";
import { updateCardCharge, updateTransaction } from "@/lib/actions/transactions";
import { DateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { Amount } from "@/components/ui/amount";
import { formatBRLInput } from "@/lib/money/brl";
import type { CardCharge, Category, Transaction } from "@/lib/types";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function EditPencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-lg p-1 text-slate-400 transition hover:bg-white/60 hover:text-teal-700"
    >
      <PencilIcon className="h-4 w-4" />
    </button>
  );
}

function TransactionEditForm({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await updateTransaction(formData);
        onClose();
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="id" value={transaction.id} />
      <input
        name="amount"
        defaultValue={formatBRLInput(transaction.amount_cents)}
        className="rounded-xl bg-white/80 px-3 py-2 text-sm outline-none"
      />
      {transaction.movement_kind !== "transferencia" ? (
        <Select
          name="category_id"
          defaultValue={transaction.category_id ?? categories[0]?.id}
          options={categories.map((item) => ({ value: item.id, label: item.name }))}
        />
      ) : (
        <input type="hidden" name="category_id" value="" />
      )}
      <DateField name="occurred_on" required defaultValue={transaction.occurred_on} />
      <input
        name="notes"
        defaultValue={transaction.notes ?? ""}
        placeholder="nota"
        className="rounded-xl bg-white/80 px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <button type="submit" className="text-xs font-semibold text-teal-700">
          salvar
        </button>
        <button type="button" className="text-xs text-slate-400" onClick={onClose}>
          cancelar
        </button>
      </div>
    </form>
  );
}

function CardChargeEditForm({
  charge,
  categories,
  onClose,
}: {
  charge: CardCharge;
  categories: Category[];
  onClose: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await updateCardCharge(formData);
        onClose();
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="id" value={charge.id} />
      <Select
        name="category_id"
        defaultValue={charge.category_id ?? categories[0]?.id}
        options={categories.map((item) => ({ value: item.id, label: item.name }))}
      />
      <input
        name="notes"
        defaultValue={charge.notes ?? ""}
        placeholder="nota"
        className="rounded-xl bg-white/80 px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <button type="submit" className="text-xs font-semibold text-teal-700">
          salvar
        </button>
        <button type="button" className="text-xs text-slate-400" onClick={onClose}>
          cancelar
        </button>
      </div>
    </form>
  );
}

export function TransactionListItem({
  transaction,
  categories,
  categoryName,
  categoryColor,
  memberLabel,
  metaExtra,
  income,
  transfer,
  cashOut = false,
  deleteAction,
}: {
  transaction: Transaction;
  categories: Category[];
  categoryName: string;
  categoryColor: string;
  memberLabel: string;
  metaExtra: string;
  income: boolean;
  transfer: boolean;
  cashOut?: boolean;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = !(transaction.movement_kind === "transferencia" && transaction.statement_payment_id);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/55 px-3 py-3">
      <span className="h-10 w-10 rounded-2xl" style={{ background: categoryColor }} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-800">{categoryName}</span>
        <span className="text-xs text-slate-500">
          {memberLabel}
          {metaExtra}
        </span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {canEdit && !open ? (
          <EditPencilButton onClick={() => setOpen(true)} label="Editar lançamento" />
        ) : null}
        <Amount
          cents={transaction.amount_cents}
          tone={income ? "income" : cashOut ? "tight" : transfer ? "muted" : "default"}
        />
        <form action={deleteAction}>
          <input type="hidden" name="id" value={transaction.id} />
          <button className="px-1 text-xs text-slate-400" type="submit">
            x
          </button>
        </form>
      </div>
      {open && canEdit ? (
        <div className="w-full basis-full pl-[52px]">
          <TransactionEditForm
            transaction={transaction}
            categories={categories}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </li>
  );
}

export function CardChargeListItem({
  charge,
  categories,
  categoryName,
  categoryColor,
  meta,
}: {
  charge: CardCharge;
  categories: Category[];
  categoryName: string;
  categoryColor: string;
  meta: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/55 px-3 py-3">
      <span className="h-10 w-10 rounded-2xl" style={{ background: categoryColor }} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-800">{categoryName}</span>
        <span className="text-xs text-slate-500">{meta}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {!open ? (
          <EditPencilButton onClick={() => setOpen(true)} label="Editar compra no cartão" />
        ) : null}
        <Amount cents={charge.amount_cents} tone="tight" />
      </div>
      {open ? (
        <div className="w-full basis-full pl-[52px]">
          <CardChargeEditForm
            charge={charge}
            categories={categories}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </li>
  );
}
