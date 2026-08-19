import assert from "node:assert/strict";
import { test } from "node:test";
import { computeInsights } from "./compute.ts";

test("sugere reserva e aporte quando sobra dinheiro", () => {
  const result = computeInsights({
    plannedFixedIncomeCents: 1_000_000,
    variableIncomeCents: 0,
    fixedBillsCents: 400_000,
    fixedPaidCents: 400_000,
    variableSpentCents: 200_000,
    variableByCategory: [{ name: "Mercado", cents: 80_000 }],
    goalsRemainingCents: 50_000,
  });

  assert.equal(result.remainingCents, 400_000);
  assert.equal(result.suggestedReserveCents, 240_000);
  assert.equal(result.suggestedInvestCents, 160_000);
  assert.equal(result.mood, "good");
});

test("envelope estourado vira headline de teto", () => {
  const result = computeInsights({
    plannedFixedIncomeCents: 800_000,
    variableIncomeCents: 0,
    fixedBillsCents: 300_000,
    fixedPaidCents: 300_000,
    variableSpentCents: 200_000,
    variableByCategory: [{ name: "Mercado", cents: 200_000 }],
    goalsRemainingCents: 0,
    envelopes: [{ name: "Mercado", spentCents: 200_000, limitCents: 150_000 }],
  });

  assert.equal(result.leak?.name, "Mercado");
  assert.ok(result.headlines.some((line) => line.includes("envelope Mercado")));
});

test("marca vazamento quando uma categoria domina as variáveis", () => {
  const result = computeInsights({
    plannedFixedIncomeCents: 800_000,
    variableIncomeCents: 0,
    fixedBillsCents: 300_000,
    fixedPaidCents: 300_000,
    variableSpentCents: 200_000,
    variableByCategory: [
      { name: "Delivery", cents: 140_000 },
      { name: "Mercado", cents: 60_000 },
    ],
    goalsRemainingCents: 0,
  });

  assert.equal(result.leak?.name, "Delivery");
  assert.ok((result.leak?.share ?? 0) >= 0.35);
});
