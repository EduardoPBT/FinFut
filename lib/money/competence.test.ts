import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDay, maskDateBR, parseDateBR } from "./competence.ts";

test("formatDay mantém dia 16 sem deslocar para 15", () => {
  const formatted = formatDay("2026-08-16");
  assert.equal(formatted, "16/08/2026");
});

test("parseDateBR lê dia/mês/ano e rejeita data inválida", () => {
  assert.equal(parseDateBR("18/08/2026"), "2026-08-18");
  assert.equal(parseDateBR("18/08/26"), "2026-08-18");
  assert.equal(parseDateBR("31/02/2026"), null);
});

test("maskDateBR aplica barras enquanto digita", () => {
  assert.equal(maskDateBR("18082026"), "18/08/2026");
});
