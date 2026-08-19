import assert from "node:assert/strict";
import { test } from "node:test";
import { classifiedFromModel, classifiedFromRegex } from "./classify.ts";
import { resolveCategory } from "./category-match.ts";

test("regex lê pix no mercado", () => {
  const categories = [
    { id: "1", household_id: "h", name: "Mercado", kind: "variavel" as const, icon: "x", color: "#000", sort_order: 1 },
  ];
  const parsed = classifiedFromRegex("gastei 40 reais no mercado no pix", categories);
  assert.equal(parsed.amountCents, 4000);
  assert.equal(parsed.paymentMethod, "pix");
  assert.equal(parsed.kind, "despesa");
  assert.equal(parsed.categoryName, "Mercado");
  assert.equal(parsed.needsReview, false);
});

test("regex lê crédito 3x", () => {
  const parsed = classifiedFromRegex("celular 1200 nubank 3x");
  assert.equal(parsed.installments, 3);
  assert.equal(parsed.paymentMethod, "credito");
});

test("modelo mapeia 13º como receita", () => {
  const parsed = classifiedFromModel({
    amount_brl: 1500,
    description: "13º",
    kind: "receita",
    payment_method: "pix",
    installments: 1,
    category_name: "Salário",
    confidence: 0.9,
    needs_review: false,
  });
  assert.equal(parsed.amountCents, 150000);
  assert.equal(parsed.kind, "receita");
  assert.equal(parsed.paymentMethod, "pix");
});

test("casa categoria pelo nome da IA", () => {
  const category = resolveCategory(
    [
      { id: "1", household_id: "h", name: "Mercado", kind: "variavel", icon: "x", color: "#000", sort_order: 1 },
      { id: "2", household_id: "h", name: "Lazer", kind: "variavel", icon: "x", color: "#000", sort_order: 2 },
    ],
    { categoryName: "Mercado", rawText: "mercado" },
  );
  assert.equal(category?.id, "1");
});
