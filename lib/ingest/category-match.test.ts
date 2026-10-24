import assert from "node:assert/strict";
import { test } from "node:test";
import { inferLabelAndCategory, resolveCategory } from "./category-match.ts";
import type { Category } from "@/lib/types";

const categories: Category[] = [
  { id: "1", household_id: "h", name: "Mercado", kind: "variavel", icon: "x", color: "#000", sort_order: 1 },
  { id: "2", household_id: "h", name: "Compras online", kind: "variavel", icon: "x", color: "#000", sort_order: 2 },
  { id: "3", household_id: "h", name: "Outros", kind: "variavel", icon: "x", color: "#000", sort_order: 3 },
];

test("Mercado Livre não vira supermercado", () => {
  const inferred = inferLabelAndCategory(
    "gastei 1800 reais parcelado em 8 vezes no mercado livre",
    categories,
  );
  assert.equal(inferred.label, "Mercado Livre");
  assert.equal(inferred.categoryName, "Compras online");

  const resolved = resolveCategory(categories, {
    categoryName: inferred.categoryName,
    label: inferred.label,
    rawText: "gastei 1800 no mercado livre",
  });
  assert.equal(resolved?.name, "Compras online");
});

test("mercado avulso continua supermercado", () => {
  const resolved = resolveCategory(categories, {
    rawText: "gastei 45 no mercado no pix",
  });
  assert.equal(resolved?.name, "Mercado");
});

test("prioriza categoria da IA quando válida", () => {
  const resolved = resolveCategory(categories, {
    categoryName: "Compras online",
    rawText: "compra na amazon",
  });
  assert.equal(resolved?.name, "Compras online");
});

test("Uber no extrato vira Transporte", () => {
  const inferred = inferLabelAndCategory("UBER *TRIP SAO PAULO", categories);
  assert.equal(inferred.categoryName, "Transporte");
});

test("bolo vira Mercado, não Outros", () => {
  const inferred = inferLabelAndCategory("gastei 35 reais no bolo", categories);
  assert.equal(inferred.categoryName, "Mercado");
  assert.equal(inferred.label, "Bolo");

  const resolved = resolveCategory(categories, {
    categoryName: "Outros",
    label: "Bolo",
    rawText: "gastei 35 reais no bolo",
  });
  assert.equal(resolved?.name, "Mercado");
});
