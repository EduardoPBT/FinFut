import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatConfirmPrompt,
  formatEntryList,
  formatHelp,
  formatMonthSummary,
} from "./format-telegram.ts";

test("resumo do mês formata receitas e sobra", () => {
  const text = formatMonthSummary({
    yearMonth: "2026-08",
    incomeCents: 450000,
    expenseCents: 320000,
    remainingCents: 130000,
  });
  assert.match(text, /Receitas: R\$.*4\.500,00/);
  assert.match(text, /Sobra: R\$.*1\.300,00/);
});

test("lista numerada e help incluem comandos", () => {
  const list = formatEntryList([
    { amountCents: 4500, occurredOn: "2026-08-18", title: "Mercado", notes: "pix" },
  ]);
  assert.match(list, /1\) R\$.*45,00 · Mercado · pix · 18\/08\/2026/);
  assert.match(formatHelp(), /\/mes/);
  assert.match(formatConfirmPrompt("Confirmar", {
    amountCents: 4500,
    occurredOn: "2026-08-18",
    title: "Mercado",
  }), /sim para confirmar/);
});
