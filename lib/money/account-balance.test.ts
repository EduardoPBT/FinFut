import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { balanceForAccount, movementSignedCents } from "./account-balance.ts";

describe("account balance", () => {
  const account = {
    id: "acc-1",
    household_id: "h",
    name: "Nubank",
    kind: "corrente" as const,
    initial_balance_cents: 100000,
    active: true,
  };

  it("receita soma e despesa/fatura subtraem", () => {
    const balance = balanceForAccount(account, [
      { account_id: "acc-1", amount_cents: 50000, movement_kind: "receita" },
      { account_id: "acc-1", amount_cents: 12000, movement_kind: "despesa" },
      { account_id: "acc-1", amount_cents: 30000, movement_kind: "transferencia" },
      { account_id: "other", amount_cents: 99999, movement_kind: "despesa" },
    ]);
    assert.equal(balance, 108000);
  });

  it("transferência credita o destino", () => {
    const poupanca = { ...account, id: "acc-2", name: "Poupança", initial_balance_cents: 0 };
    const txs = [
      {
        account_id: "acc-1",
        destination_account_id: "acc-2",
        amount_cents: 50000,
        movement_kind: "transferencia" as const,
      },
    ];
    assert.equal(balanceForAccount(account, txs), 50000);
    assert.equal(balanceForAccount(poupanca, txs), 50000);
  });

  it("sinal por tipo de movimento", () => {
    assert.equal(movementSignedCents("receita", 10), 10);
    assert.equal(movementSignedCents("despesa", 10), -10);
    assert.equal(movementSignedCents("transferencia", 10), -10);
  });
});
