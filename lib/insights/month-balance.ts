import type { CoupleInsights } from "@/lib/insights/compute";
import { formatCompactBRL } from "@/lib/money/brl";

export type MonthBalanceRowKind =
  | "income_fixed"
  | "income_variable"
  | "expense_fixed"
  | "expense_variable"
  | "result";

export type MonthBalanceRow = {
  label: string;
  cents: number;
  kind: MonthBalanceRowKind;
};

export function monthBalanceRows(insights: CoupleInsights): MonthBalanceRow[] {
  const rows: MonthBalanceRow[] = [
    { label: "Receitas fixas", cents: insights.fixedIncomeCents, kind: "income_fixed" },
    {
      label: "Receitas variáveis",
      cents: insights.variableIncomeCents,
      kind: "income_variable",
    },
    { label: "Despesas fixas", cents: insights.fixedCents, kind: "expense_fixed" },
    {
      label: "Despesas variáveis",
      cents: insights.variableCents,
      kind: "expense_variable",
    },
    {
      label: insights.remainingCents >= 0 ? "Sobra" : "Falta",
      cents: Math.abs(insights.remainingCents),
      kind: "result",
    },
  ];
  return rows;
}

export function monthBalanceSharePercent(partCents: number, totalIncomeCents: number) {
  if (totalIncomeCents <= 0) return 0;
  return Math.round((partCents / totalIncomeCents) * 100);
}

export function billsPaidShare(billsPaidCents: number, billsTotalCents: number) {
  if (billsTotalCents <= 0) return 0;
  return Math.round((billsPaidCents / billsTotalCents) * 100);
}

export function fixedExpenseHint(params: {
  billsPaidCents: number;
  billsTotalCents: number;
  billsUnpaidCents: number;
  otherSpentCents: number;
}) {
  const parts: string[] = [];
  if (params.billsTotalCents > 0) {
    parts.push(`${billsPaidShare(params.billsPaidCents, params.billsTotalCents)}% contas pagas`);
  }
  if (params.billsUnpaidCents > 0) {
    parts.push(`${formatCompactBRL(params.billsUnpaidCents)} a pagar`);
  }
  if (params.otherSpentCents > 0) {
    parts.push(`${formatCompactBRL(params.otherSpentCents)} já lançado`);
  }
  if (parts.length === 0) return "Nenhuma conta fixa neste mês";
  return parts.join(" · ");
}

export function monthBalanceRowTone(
  row: MonthBalanceRow,
  remainingCents: number,
): "default" | "good" | "income" | "tight" {
  if (row.kind === "income_fixed" || row.kind === "income_variable") return "income";
  if (row.kind === "expense_fixed" || row.kind === "expense_variable") return "tight";
  if (row.kind === "result") return remainingCents >= 0 ? "good" : "default";
  return "default";
}
