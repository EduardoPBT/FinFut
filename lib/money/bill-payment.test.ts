import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingDateForPayment } from "./bill-payment.ts";

test("crédito lança no mês seguinte à competência", () => {
  const date = bookingDateForPayment("credito", "2026-08-16", "2026-08-01");
  assert.equal(date, "2026-09-01");
});

test("pix lança na data do pagamento", () => {
  const date = bookingDateForPayment("pix", "2026-08-16", "2026-08-01");
  assert.equal(date, "2026-08-16");
});
