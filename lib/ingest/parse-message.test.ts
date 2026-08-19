import assert from "node:assert/strict";
import { test } from "node:test";
import { matchCategoryName, parseMessage } from "./parse-message.ts";

test("lê mercado 87,50", () => {
  const parsed = parseMessage("mercado 87,50");
  assert.equal(parsed.amountCents, 8750);
  assert.equal(parsed.description, "mercado");
  assert.equal(parsed.kindHint, "despesa");
});

test("lê R$ 1.250,00 salário", () => {
  const parsed = parseMessage("R$ 1.250,00 salário");
  assert.equal(parsed.amountCents, 125000);
  assert.equal(parsed.kindHint, "receita");
});

test("lê mercado 150 visa 3x", () => {
  const parsed = parseMessage("mercado 150 visa 3x");
  assert.equal(parsed.amountCents, 15000);
  assert.equal(parsed.installments, 3);
  assert.equal(parsed.cardHint, true);
});

test("casa descrição com categoria", () => {
  const category = matchCategoryName("mercado", [
    { id: "1", name: "Mercado" },
    { id: "2", name: "Lazer" },
  ]);
  assert.equal(category?.id, "1");
});
