import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cardUtilization,
  committedCardCents,
  emergencyMonths,
  projectCashflow,
} from "./cashflow.ts";

describe("projectCashflow", () => {
  it("aponta vermelho antes do fim do mês com aluguel e fatura", () => {
    const result = projectCashflow({
      startBalanceCents: 200_000,
      startDate: "2026-08-18",
      dayCount: 45,
      events: [
        { date: "2026-08-20", label: "Aluguel", cents: -150_000 },
        { date: "2026-08-21", label: "Fatura Nubank", cents: -180_000 },
      ],
    });

    assert.equal(result.firstNegativeOn, "2026-08-21");
    assert.ok(result.runwayDays < 14);
    assert.equal(result.nextOutflow?.label, "Aluguel");
    assert.ok((result.days.find((item) => item.date === "2026-08-20")?.projectedCents ?? 0) > 0);
    assert.ok((result.days.find((item) => item.date === "2026-08-21")?.projectedCents ?? 0) < 0);
  });

  it("renda prevista empurra o vermelho", () => {
    const result = projectCashflow({
      startBalanceCents: 50_000,
      startDate: "2026-08-18",
      events: [
        { date: "2026-08-19", label: "Salário", cents: 400_000 },
        { date: "2026-08-21", label: "Fatura", cents: -180_000 },
      ],
    });
    assert.equal(result.firstNegativeOn, null);
  });
});

describe("compromisso e reserva", () => {
  it("soma faturas aberta e futura", () => {
    assert.equal(
      committedCardCents([
        { displayStatus: "aberta", totalCents: 10_000 },
        { displayStatus: "futura", totalCents: 12_000 },
        { displayStatus: "fechada", totalCents: 99_000 },
      ]),
      22_000,
    );
  });

  it("reserva em meses", () => {
    assert.equal(emergencyMonths(1_800_000, 600_000), 3);
  });

  it("uso do limite", () => {
    assert.equal(cardUtilization(250_000, 1_000_000), 0.25);
  });
});
