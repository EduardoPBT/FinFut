"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { markBillPaid } from "@/lib/actions/bills";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { PAYMENT_METHODS, defaultPaidOn } from "@/lib/money/bill-payment";
import type { BankAccount, BillInstanceView, CreditCard, PaymentMethod, RecurringBill } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Registrando..." : "Confirmar pagamento"}
    </Button>
  );
}

export function MarkBillPaidModal({
  open,
  onClose,
  instance,
  bill,
  accounts,
  cards,
}: {
  open: boolean;
  onClose: () => void;
  instance: BillInstanceView;
  bill: RecurringBill;
  accounts: BankAccount[];
  cards: CreditCard[];
}) {
  const defaultMethod = (bill.default_payment_method ?? "pix") as PaymentMethod;
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const isCredit = method === "credito";
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await markBillPaid(formData);
      if (result?.ok) onClose();
      return result;
    },
    null,
  );

  return (
    <ModalPortal>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-end bg-slate-900/30 p-4 backdrop-blur-sm sm:place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white/95 p-5 shadow-2xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                    registrar pagamento
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-800">{bill.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Pix e débito saem da conta. Crédito entra na fatura do cartão.
                  </p>
                </div>
                <button type="button" onClick={onClose} className="text-slate-400">
                  ✕
                </button>
              </div>
              <form action={action} className="grid gap-3">
                <input type="hidden" name="instance_id" value={instance.id} />
                <input type="hidden" name="bill_name" value={bill.name} />
                <input type="hidden" name="category_id" value={bill.category_id ?? ""} />
                <input type="hidden" name="amount_cents" value={instance.amount_cents} />
                <label className="grid gap-1 text-sm font-medium text-slate-600">
                  Como pagou?
                  <Select
                    name="payment_method"
                    required
                    defaultValue={defaultMethod}
                    options={PAYMENT_METHODS.map((item) => ({
                      value: item.value,
                      label: item.label,
                      hint: item.hint,
                    }))}
                    onValueChange={(value) => setMethod(value as PaymentMethod)}
                  />
                </label>
                {isCredit ? (
                  <label className="grid gap-1 text-sm font-medium text-slate-600">
                    Cartão
                    <Select
                      name="credit_card_id"
                      defaultValue={bill.default_credit_card_id ?? cards[0]?.id}
                      options={cards.map((item) => ({ value: item.id, label: item.name }))}
                    />
                  </label>
                ) : (
                  <label className="grid gap-1 text-sm font-medium text-slate-600">
                    Conta
                    <Select
                      name="account_id"
                      defaultValue={bill.default_account_id ?? accounts[0]?.id}
                      options={accounts.map((item) => ({ value: item.id, label: item.name }))}
                    />
                  </label>
                )}
                <label className="grid gap-1 text-sm font-medium text-slate-600">
                  Data do pagamento
                  <DateField name="paid_on" required defaultValue={defaultPaidOn()} />
                </label>
                {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
                <Submit />
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </ModalPortal>
  );
}
