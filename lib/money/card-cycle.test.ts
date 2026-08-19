import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarMonths,
  clampInstallments,
  installmentCycles,
  resolveCycle,
  splitInstallmentAmounts,
  statementDisplayStatus,
} from "./card-cycle.ts";

describe("resolveCycle fechamento 10 vencimento 20", () => {
  it("A: compra 08/ago entra na fatura 20/ago", () => {
    const cycle = resolveCycle("2026-08-08", 10, 20);
    assert.equal(cycle.dueOn, "2026-08-20");
    assert.equal(cycle.cycleEnd, "2026-08-10");
    assert.equal(cycle.cycleStart, "2026-07-11");
  });

  it("B: compra 12/ago entra na fatura 20/set", () => {
    const cycle = resolveCycle("2026-08-12", 10, 20);
    assert.equal(cycle.dueOn, "2026-09-20");
    assert.equal(cycle.cycleStart, "2026-08-11");
    assert.equal(cycle.cycleEnd, "2026-09-10");
  });

  it("C: compra no fechamento 10/ago entra na fatura 20/ago", () => {
    const cycle = resolveCycle("2026-08-10", 10, 20);
    assert.equal(cycle.dueOn, "2026-08-20");
    assert.equal(cycle.cycleEnd, "2026-08-10");
  });

  it("D: compra no 1º dia do ciclo novo 11/ago entra na fatura 20/set", () => {
    const cycle = resolveCycle("2026-08-11", 10, 20);
    assert.equal(cycle.dueOn, "2026-09-20");
    assert.equal(cycle.cycleStart, "2026-08-11");
  });

  it("E: compra 05/jul entra na fatura 20/jul", () => {
    const cycle = resolveCycle("2026-07-05", 10, 20);
    assert.equal(cycle.dueOn, "2026-07-20");
    assert.equal(cycle.cycleEnd, "2026-07-10");
  });

  it("F: compra 31/jan com fechamento 28 vai para fatura de fevereiro", () => {
    const cycle = resolveCycle("2026-01-31", 28, 20);
    assert.equal(cycle.cycleEnd, "2026-02-28");
    assert.equal(cycle.dueOn, "2026-02-20");
  });
});

describe("parcelas", () => {
  it("G: 3x em 08/ago caem em ago/set/out", () => {
    const cycles = installmentCycles("2026-08-08", 10, 20, 3);
    assert.deepEqual(
      cycles.map((item) => item.dueOn),
      ["2026-08-20", "2026-09-20", "2026-10-20"],
    );
  });

  it("3x depois do fechamento seguem faturas consecutivas", () => {
    const cycles = installmentCycles("2026-08-12", 10, 20, 3);
    assert.deepEqual(
      cycles.map((item) => item.dueOn),
      ["2026-09-20", "2026-10-20", "2026-11-20"],
    );
  });

  it("Nubank fecha 14 vence 21: compra 18/ago entra na fatura 21/set", () => {
    const cycle = resolveCycle("2026-08-18", 14, 21);
    assert.equal(cycle.cycleStart, "2026-08-15");
    assert.equal(cycle.cycleEnd, "2026-09-14");
    assert.equal(cycle.dueOn, "2026-09-21");
  });

  it("Nubank fecha 14 vence 21: 3x em 18/ago caem em set/out/nov", () => {
    const dues = installmentCycles("2026-08-18", 14, 21, 3).map((item) => item.dueOn);
    assert.deepEqual(dues, ["2026-09-21", "2026-10-21", "2026-11-21"]);
  });

  it("3x em 31/jan com fechamento 28 não repetem a mesma fatura", () => {
    const dues = installmentCycles("2026-01-31", 28, 20, 3).map((item) => item.dueOn);
    assert.equal(new Set(dues).size, 3);
  });

  it("última parcela absorve os centavos", () => {
    assert.deepEqual(splitInstallmentAmounts(10000, 3), [3333, 3333, 3334]);
  });

  it("parcelas ficam entre 1 e 24", () => {
    assert.equal(clampInstallments(0), 1);
    assert.equal(clampInstallments(99), 24);
    assert.equal(clampInstallments(Number.NaN), 1);
  });

  it("addCalendarMonths não estoura fevereiro", () => {
    assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
  });
});

describe("statementDisplayStatus", () => {
  it("paga permanece paga", () => {
    assert.equal(
      statementDisplayStatus("paga", "2026-07-11", "2026-08-10", "2026-08-17"),
      "paga",
    );
  });

  it("aberta enquanto o ciclo não fechou", () => {
    assert.equal(
      statementDisplayStatus("aberta", "2026-07-11", "2026-08-10", "2026-08-08"),
      "aberta",
    );
  });

  it("fecha depois do último dia do ciclo", () => {
    assert.equal(
      statementDisplayStatus("aberta", "2026-07-11", "2026-08-10", "2026-08-11"),
      "fechada",
    );
  });

  it("futura antes de começar o ciclo", () => {
    assert.equal(
      statementDisplayStatus("aberta", "2026-08-11", "2026-09-10", "2026-08-08"),
      "futura",
    );
  });
});
