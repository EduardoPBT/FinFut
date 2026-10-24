import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsvText, rowsToStatement } from "./spreadsheet.ts";

test("lê CSV brasileiro com ponto e vírgula", () => {
  const rows = parseCsvText(`Data;Histórico;Valor
15/03/2026;PADARIA CENTRAL;-45,90
05/03/2026;SALARIO;3200,00
`);
  const parsed = rowsToStatement(rows);
  assert.equal(parsed.transactions.length, 2);
  assert.equal(parsed.transactions[0].occurredOn, "2026-03-15");
  assert.equal(parsed.transactions[0].amountCents, -4590);
  assert.equal(parsed.transactions[0].description, "PADARIA CENTRAL");
  assert.equal(parsed.transactions[1].amountCents, 320000);
});

test("lê colunas de débito e crédito", () => {
  const parsed = rowsToStatement([
    ["Data", "Descrição", "Débito", "Crédito"],
    ["01/09/2026", "SUPERMERCADO BOM", "87,50", ""],
    ["02/09/2026", "PIX RECEBIDO", "", "200,00"],
  ]);
  assert.equal(parsed.transactions[0].amountCents, -8750);
  assert.equal(parsed.transactions[1].amountCents, 20000);
});

test("infere colunas sem cabeçalho", () => {
  const parsed = rowsToStatement([
    ["2026-03-10", "IFOOD *PIZZA", "-32.90"],
    ["2026-03-11", "UBER TRIP", "-18.40"],
  ]);
  assert.equal(parsed.transactions.length, 2);
  assert.equal(parsed.transactions[0].description, "IFOOD *PIZZA");
  assert.equal(parsed.transactions[1].amountCents, -1840);
});
