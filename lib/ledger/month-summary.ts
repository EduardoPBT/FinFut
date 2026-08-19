import type { CardCharge, Category, Transaction } from "@/lib/types";

export type LedgerSummary = {
  incomeCents: number;
  cashOutCents: number;
  cardSpendCents: number;
  statementPayCents: number;
  partialCents: number;
  entryCount: number;
};

export type LedgerSortEntry =
  | { kind: "transaction"; sortKey: string; transaction: Transaction }
  | { kind: "card_charge"; sortKey: string; charge: CardCharge };

export function summarizeLedgerMonth(
  transactions: Transaction[],
  cardCharges: CardCharge[],
): LedgerSummary {
  let incomeCents = 0;
  let cashOutCents = 0;
  let statementPayCents = 0;

  for (const item of transactions) {
    if (item.movement_kind === "receita") {
      incomeCents += item.amount_cents;
      continue;
    }
    if (item.movement_kind === "despesa") {
      cashOutCents += item.amount_cents;
      continue;
    }
    if (item.movement_kind === "transferencia" && item.statement_payment_id) {
      statementPayCents += item.amount_cents;
      cashOutCents += item.amount_cents;
    }
  }

  const cardSpendCents = cardCharges.reduce((sum, item) => sum + item.amount_cents, 0);

  return {
    incomeCents,
    cashOutCents,
    cardSpendCents,
    statementPayCents,
    partialCents: incomeCents - cashOutCents,
    entryCount: transactions.length + cardCharges.length,
  };
}

export function sortLedgerEntries(
  transactions: Transaction[],
  cardCharges: CardCharge[],
): LedgerSortEntry[] {
  const rows: LedgerSortEntry[] = [
    ...transactions.map((transaction) => ({
      kind: "transaction" as const,
      sortKey: `${transaction.occurred_on}T${transaction.created_at}`,
      transaction,
    })),
    ...cardCharges.map((charge) => ({
      kind: "card_charge" as const,
      sortKey: `${charge.occurred_on}T${charge.id}`,
      charge,
    })),
  ];
  return rows.sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}

export function transactionLedgerLabel(
  transaction: Transaction,
  category: Category | undefined,
  statementCardName?: string | null,
) {
  if (transaction.statement_payment_id) {
    const card = statementCardName ?? transaction.notes?.replace(/^Fatura\s+/i, "") ?? "cartão";
    return `Fatura · ${card}`;
  }
  if (transaction.movement_kind === "transferencia") {
    if (transaction.destination_account_id) return "Transferência entre contas";
    if (transaction.goal_id) return "Aporte em meta";
    return "Movimento";
  }
  return category?.name ?? "Lançamento";
}

export function isIncomeTransaction(transaction: Transaction, category?: Category) {
  return transaction.movement_kind === "receita" || category?.kind === "receita";
}

export function isStatementPayment(transaction: Transaction) {
  return Boolean(transaction.statement_payment_id);
}

export function isCashOutTransaction(transaction: Transaction) {
  return (
    transaction.movement_kind === "despesa" ||
    (transaction.movement_kind === "transferencia" && Boolean(transaction.statement_payment_id))
  );
}
