import test from "node:test";
import assert from "node:assert/strict";
import {
  isStatementPayment,
  sortLedgerEntries,
  summarizeLedgerMonth,
  transactionLedgerLabel,
} from "@/lib/ledger/month-summary";
import type { CardCharge, Transaction } from "@/lib/types";

const tx = (partial: Partial<Transaction>): Transaction =>
  ({
    id: "t1",
    household_id: "h1",
    member_id: null,
    category_id: null,
    amount_cents: 1000,
    occurred_on: "2026-08-18",
    notes: null,
    origin: "app",
    bill_instance_id: null,
    income_instance_id: null,
    account_id: "a1",
    card_charge_id: null,
    statement_payment_id: null,
    movement_kind: "despesa",
    created_at: "2026-08-18T12:00:00Z",
    ...partial,
  }) as Transaction;

test("summarizeLedgerMonth separa entradas, saídas e fatura", () => {
  const summary = summarizeLedgerMonth(
    [
      tx({ movement_kind: "receita", amount_cents: 450_000 }),
      tx({ movement_kind: "despesa", amount_cents: 100_000 }),
      tx({
        movement_kind: "transferencia",
        statement_payment_id: "s1",
        amount_cents: 50_000,
        notes: "Fatura Nubank",
      }),
    ],
    [{ amount_cents: 8_700 } as CardCharge],
  );
  assert.equal(summary.incomeCents, 450_000);
  assert.equal(summary.cashOutCents, 150_000);
  assert.equal(summary.statementPayCents, 50_000);
  assert.equal(summary.cardSpendCents, 8_700);
  assert.equal(summary.partialCents, 300_000);
});

test("sortLedgerEntries ordena por data decrescente", () => {
  const sorted = sortLedgerEntries(
    [tx({ occurred_on: "2026-08-10", created_at: "2026-08-10T10:00:00Z" })],
    [
      {
        occurred_on: "2026-08-18",
        id: "charge-1",
      } as CardCharge,
    ],
  );
  assert.equal(sorted[0]?.kind, "card_charge");
});

test("transactionLedgerLabel identifica pagamento de fatura", () => {
  assert.equal(
    transactionLedgerLabel(
      tx({ statement_payment_id: "s1", movement_kind: "transferencia", notes: "Fatura Nubank" }),
      undefined,
      "Nubank",
    ),
    "Fatura · Nubank",
  );
  assert.equal(isStatementPayment(tx({ statement_payment_id: "s1" })), true);
});
