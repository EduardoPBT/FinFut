"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TransactionForm } from "@/components/forms/transaction-form";
import type { BankAccount, Category, CreditCard, Member } from "@/lib/types";

export function QuickAdd({
  categories,
  members,
  accounts,
  cards,
  defaultDate,
}: {
  categories: Category[];
  members: Member[];
  accounts: BankAccount[];
  cards: CreditCard[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-teal-600 text-2xl text-white shadow-lg shadow-teal-700/30 sm:right-8"
        aria-label="Novo lançamento"
      >
        +
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-end bg-slate-900/30 p-4 backdrop-blur-sm md:place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-[28px] bg-white/90 p-5 shadow-2xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-lg font-bold text-slate-800">Lançar agora</p>
                <button type="button" onClick={() => setOpen(false)} className="text-slate-500">
                  fechar
                </button>
              </div>
              <TransactionForm
                categories={categories}
                members={members}
                accounts={accounts}
                cards={cards}
                defaultDate={defaultDate}
                onDone={() => setOpen(false)}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
