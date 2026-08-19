"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { unmarkBillPaid } from "@/lib/actions/bills";
import { Amount } from "@/components/ui/amount";
import { BillStatusChip } from "@/components/dashboard/bill-status-chip";
import { MarkBillPaidModal } from "@/components/forms/mark-bill-paid-form";
import { Button } from "@/components/ui/button";
import {
  billAmountTone,
  billDueLabel,
  paymentSummary,
} from "@/lib/money/bill-status";
import type { BankAccount, BillInstanceView, CreditCard, RecurringBill } from "@/lib/types";
import { cn } from "@/lib/cn";

export function BillRow({
  instance,
  bill,
  compact = false,
  accounts = [],
  cards = [],
}: {
  instance: BillInstanceView;
  bill?: RecurringBill;
  compact?: boolean;
  accounts?: BankAccount[];
  cards?: CreditCard[];
}) {
  const [payOpen, setPayOpen] = useState(false);
  const paid = instance.status === "pago";
  const name = bill?.name ?? "Conta";

  return (
    <>
      <div
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition",
          paid && "bg-teal-50/80",
          instance.status === "atrasado" && "bg-rose-50/70",
          instance.status === "vence_hoje" && "bg-amber-50/70",
          instance.status === "pendente" && "bg-white/55",
        )}
      >
        <motion.span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg",
            paid && "bg-teal-500 text-white",
            instance.status === "atrasado" && "bg-rose-100 text-rose-700",
            instance.status === "vence_hoje" && "bg-amber-100 text-amber-800",
            instance.status === "pendente" && "bg-sky-100 text-sky-800",
          )}
          animate={{ scale: paid ? 1 : [1, 1.04, 1] }}
          transition={{ duration: 2.2, repeat: paid ? 0 : Infinity }}
        >
          {paid ? "✓" : "⌂"}
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{name}</span>
            <BillStatusChip status={instance.status} />
          </span>
          <span className="block text-xs text-slate-500">{billDueLabel(instance.due_on)}</span>
          {paid && instance.payment_method ? (
            <span className="mt-0.5 block text-xs font-medium text-teal-700">
              {paymentSummary(instance)}
            </span>
          ) : null}
        </span>
        <Amount cents={instance.amount_cents} tone={billAmountTone(instance.status)} />
      </div>
      {!compact ? (
        <div className="flex justify-end gap-2 px-3 pb-1">
          {paid ? (
            <form action={unmarkBillPaid}>
              <input type="hidden" name="instance_id" value={instance.id} />
              <button type="submit" className="text-xs text-slate-400 hover:text-slate-600">
                desfazer pagamento
              </button>
            </form>
          ) : (
            <Button type="button" variant="soft" className="px-3 py-1.5 text-xs" onClick={() => setPayOpen(true)}>
              registrar pagamento
            </Button>
          )}
        </div>
      ) : paid ? (
        <form action={unmarkBillPaid} className="px-1">
          <input type="hidden" name="instance_id" value={instance.id} />
          <button type="submit" className="w-full py-1 text-[10px] text-slate-400">
            desfazer
          </button>
        </form>
      ) : (
        <Button
          type="button"
          variant="soft"
          className="w-full px-2 py-1 text-[11px]"
          onClick={() => setPayOpen(true)}
        >
          pagar
        </Button>
      )}
      {bill ? (
        <MarkBillPaidModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          instance={instance}
          bill={bill}
          accounts={accounts}
          cards={cards}
        />
      ) : null}
    </>
  );
}
