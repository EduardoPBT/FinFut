import test from "node:test";
import assert from "node:assert/strict";
import {
  monthBalanceRows,
  monthBalanceRowTone,
  monthBalanceSharePercent,
  fixedExpenseHint,
} from "@/lib/insights/month-balance";
import type { CoupleInsights } from "@/lib/insights/compute";

const baseInsights: CoupleInsights = {
  totalIncomeCents: 100_000,
  fixedIncomeCents: 80_000,
  variableIncomeCents: 20_000,
  remainingCents: 15_000,
  fixedCents: 60_000,
  variableCents: 25_000,
  fixedShare: 0.6,
  variableShare: 0.25,
  leak: null,
  suggestedReserveCents: 9_000,
  suggestedInvestCents: 6_000,
  unpaidFixedCents: 10_000,
  mood: "ok",
  headlines: [],
  envelopes: [],
  envelopeAlerts: [],
};

test("monthBalanceRows separa receitas fixas, variáveis e despesas", () => {
  const rows = monthBalanceRows(baseInsights);
  assert.equal(rows[0]?.label, "Receitas fixas");
  assert.equal(rows[0]?.cents, 80_000);
  assert.equal(rows[1]?.label, "Receitas variáveis");
  assert.equal(rows[1]?.cents, 20_000);
  assert.equal(rows[2]?.label, "Despesas fixas");
  assert.equal(rows[3]?.label, "Despesas variáveis");
  assert.equal(rows[4]?.label, "Sobra");
});

test("monthBalanceRowTone deixa só despesas em vermelho", () => {
  const rows = monthBalanceRows(baseInsights);
  assert.equal(monthBalanceRowTone(rows[0]!, baseInsights.remainingCents), "income");
  assert.equal(monthBalanceRowTone(rows[2]!, baseInsights.remainingCents), "tight");
  assert.equal(monthBalanceRowTone(rows[4]!, baseInsights.remainingCents), "good");
  const negativeRows = monthBalanceRows({ ...baseInsights, remainingCents: -5_000 });
  assert.equal(monthBalanceRowTone(negativeRows[4]!, -5_000), "default");
});

test("monthBalanceSharePercent evita divisão por zero", () => {
  assert.equal(monthBalanceSharePercent(10_000, 0), 0);
  assert.equal(monthBalanceSharePercent(25_000, 100_000), 25);
});

test("fixedExpenseHint separa contas pendentes de lançamentos já feitos", () => {
  assert.match(
    fixedExpenseHint({
      billsPaidCents: 6_000,
      billsTotalCents: 10_000,
      billsUnpaidCents: 4_000,
      otherSpentCents: 2_500,
    }),
    /60% contas pagas/,
  );
  assert.match(
    fixedExpenseHint({
      billsPaidCents: 6_000,
      billsTotalCents: 10_000,
      billsUnpaidCents: 4_000,
      otherSpentCents: 2_500,
    }),
    /a pagar/,
  );
  assert.match(
    fixedExpenseHint({
      billsPaidCents: 6_000,
      billsTotalCents: 10_000,
      billsUnpaidCents: 4_000,
      otherSpentCents: 2_500,
    }),
    /já lançado/,
  );
});
