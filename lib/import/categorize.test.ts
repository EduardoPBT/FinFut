import assert from "node:assert/strict";
import { test } from "node:test";
import { inferLabelAndCategory, resolveCategory } from "@/lib/ingest/category-match";
import { isWeakCategory, suggestCategory } from "./categorize.ts";
import type { Category } from "@/lib/types";

const categories: Category[] = [
  { id: "t", household_id: "h", name: "Transporte", kind: "variavel", icon: "x", color: "#000", sort_order: 1 },
  { id: "d", household_id: "h", name: "Delivery", kind: "variavel", icon: "x", color: "#000", sort_order: 2 },
  { id: "s", household_id: "h", name: "Streaming", kind: "variavel", icon: "x", color: "#000", sort_order: 3 },
  { id: "m", household_id: "h", name: "Mercado", kind: "variavel", icon: "x", color: "#000", sort_order: 4 },
  { id: "o", household_id: "h", name: "Outros", kind: "variavel", icon: "x", color: "#000", sort_order: 5 },
  { id: "r", household_id: "h", name: "Salário", kind: "receita", icon: "x", color: "#000", sort_order: 6 },
];

test("Uber no extrato vira Transporte, Uber Eats vira Delivery", () => {
  assert.equal(inferLabelAndCategory("UBER *TRIP", categories).categoryName, "Transporte");
  assert.equal(inferLabelAndCategory("UBER EATS", categories).categoryName, "Delivery");
  assert.equal(resolveCategory(categories, { rawText: "NETFLIX.COM" })?.name, "Streaming");
});

test("suggestCategory marca Outros como fraca e Mercado como forte", () => {
  const weak = suggestCategory("PGTO PIX JOAO", categories, "despesa");
  assert.equal(weak.categoryName, "Outros");
  assert.equal(weak.weak, true);
  assert.equal(isWeakCategory(weak.categoryName), true);

  const strong = suggestCategory("PADARIA CENTRAL", categories, "despesa");
  assert.equal(strong.categoryName, "Mercado");
  assert.equal(strong.weak, false);
});
