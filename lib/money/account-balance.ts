import type { BankAccount, MovementKind, Transaction } from "@/lib/types";

export type BalanceMovement = Pick<
  Transaction,
  "account_id" | "amount_cents" | "movement_kind"
> & {
  destination_account_id?: string | null;
};

export function movementSignedCents(kind: MovementKind, amountCents: number) {
  if (kind === "receita") return amountCents;
  return -amountCents;
}

export function balanceForAccount(account: BankAccount, transactions: BalanceMovement[]) {
  const delta = transactions.reduce((sum, item) => {
    if (item.account_id === account.id) {
      return sum + movementSignedCents(item.movement_kind, item.amount_cents);
    }
    if (
      item.movement_kind === "transferencia" &&
      item.destination_account_id === account.id
    ) {
      return sum + item.amount_cents;
    }
    return sum;
  }, 0);
  return account.initial_balance_cents + delta;
}

export function balancesByAccount(accounts: BankAccount[], transactions: BalanceMovement[]) {
  return accounts.map((account) => ({
    account,
    balanceCents: balanceForAccount(account, transactions),
  }));
}

export function householdCashCents(
  accounts: BankAccount[],
  transactions: BalanceMovement[],
) {
  return balancesByAccount(accounts, transactions).reduce(
    (sum, item) => sum + item.balanceCents,
    0,
  );
}
