"use client";

import { BillRow } from "@/components/dashboard/bill-row";
import type { BankAccount, BillInstanceView, CreditCard, RecurringBill } from "@/lib/types";

export function BillToggle({
  instance,
  bill,
  accounts,
  cards,
}: {
  instance: BillInstanceView;
  bill?: RecurringBill;
  accounts: BankAccount[];
  cards: CreditCard[];
}) {
  return <BillRow instance={instance} bill={bill} compact accounts={accounts} cards={cards} />;
}
