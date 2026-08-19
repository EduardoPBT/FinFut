import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  eventDateForProjection,
  pickIncomeReceiptAccountId,
  shouldAutoReceiveIncome,
} from "./income-receipt.ts";

describe("pickIncomeReceiptAccountId", () => {
  it("prioriza conta explícita, instância, fonte e fallback", () => {
    assert.equal(
      pickIncomeReceiptAccountId("a", "b", "c", "d"),
      "a",
    );
    assert.equal(pickIncomeReceiptAccountId(null, "b", "c", "d"), "b");
    assert.equal(pickIncomeReceiptAccountId(null, null, "c", "d"), "c");
    assert.equal(pickIncomeReceiptAccountId(null, null, null, "d"), "d");
  });
});

describe("eventDateForProjection", () => {
  it("empurra eventos atrasados para hoje", () => {
    assert.equal(eventDateForProjection("2026-08-10", "2026-08-18"), "2026-08-18");
    assert.equal(eventDateForProjection("2026-08-20", "2026-08-18"), "2026-08-20");
  });
});

describe("shouldAutoReceiveIncome", () => {
  it("confirma salário fixo após a data prevista", () => {
    assert.equal(shouldAutoReceiveIncome("fixo", "2026-08-10", "2026-08-17"), true);
    assert.equal(shouldAutoReceiveIncome("fixo", "2026-08-10", "2026-08-10"), true);
  });

  it("não confirma antes da data prevista", () => {
    assert.equal(shouldAutoReceiveIncome("fixo", "2026-08-20", "2026-08-17"), false);
  });

  it("não confirma extras variáveis automaticamente", () => {
    assert.equal(shouldAutoReceiveIncome("variavel", "2026-08-10", "2026-08-17"), false);
  });
});
