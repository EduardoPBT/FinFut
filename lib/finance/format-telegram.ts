import { formatBRL } from "@/lib/money/brl";
import { formatDay, monthLabel } from "@/lib/money/competence";

export type FormattableEntry = {
  amountCents: number;
  occurredOn: string;
  title: string;
  notes?: string | null;
};

export function formatMonthSummary(params: {
  yearMonth: string;
  incomeCents: number;
  expenseCents: number;
  remainingCents: number;
}) {
  const sobraTone = params.remainingCents >= 0 ? "Sobra" : "Falta";
  return [
    `Resumo de ${monthLabel(params.yearMonth)}`,
    "",
    `Receitas: ${formatBRL(params.incomeCents)}`,
    `Despesas: ${formatBRL(params.expenseCents)}`,
    `${sobraTone}: ${formatBRL(Math.abs(params.remainingCents))}`,
  ].join("\n");
}

export function formatEntryList(entries: FormattableEntry[], empty = "Nenhum lançamento.") {
  if (entries.length === 0) return empty;
  return entries
    .map((item, index) => {
      const note = item.notes ? ` · ${item.notes}` : "";
      return `${index + 1}) ${formatBRL(item.amountCents)} · ${item.title}${note} · ${formatDay(item.occurredOn)}`;
    })
    .join("\n");
}

export function formatSpendingByCategory(params: {
  categoryName: string;
  yearMonth: string;
  cents: number;
}) {
  return `Em ${params.categoryName} (${monthLabel(params.yearMonth)}): ${formatBRL(params.cents)}.`;
}

export function formatHelp() {
  return [
    "FinFut no Telegram",
    "",
    "Lançar: gastei 45 no mercado no pix",
    "Perguntar: quanto gastei em mercado?",
    "Editar: apaga os 45 do mercado",
    "",
    "Comandos:",
    "/mes — resumo do mês",
    "/ultimos — últimos lançamentos",
    "/fatura — fatura do cartão",
    "/contas — contas pendentes",
    "/inbox — mensagens para revisar",
    "/saldo — saldo das contas",
    "/metas — progresso das metas",
    "/help — esta lista",
  ].join("\n");
}

export function formatBalances(rows: { name: string; cents: number }[], totalCents: number) {
  if (rows.length === 0) return "Nenhuma conta cadastrada.";
  const lines = rows.map((row) => `${row.name}: ${formatBRL(row.cents)}`);
  lines.push("", `Total: ${formatBRL(totalCents)}`);
  return lines.join("\n");
}

export function formatGoals(rows: { name: string; currentCents: number; targetCents: number }[]) {
  if (rows.length === 0) return "Nenhuma meta cadastrada.";
  return rows
    .map((row) => {
      const pct = row.targetCents > 0 ? Math.round((row.currentCents / row.targetCents) * 100) : 0;
      return `${row.name}: ${formatBRL(row.currentCents)} de ${formatBRL(row.targetCents)} (${pct}%)`;
    })
    .join("\n");
}

export function formatPendingBills(
  rows: { name: string; amountCents: number; dueOn: string }[],
) {
  if (rows.length === 0) return "Nenhuma conta pendente neste mês.";
  return rows
    .map((row) => `${row.name}: ${formatBRL(row.amountCents)} · vence ${formatDay(row.dueOn)}`)
    .join("\n");
}

export function formatStatements(
  rows: { cardName: string; dueOn: string; remainingCents: number; status: string }[],
) {
  if (rows.length === 0) return "Nenhuma fatura aberta ou a pagar.";
  return rows
    .map(
      (row) =>
        `${row.cardName}: ${formatBRL(row.remainingCents)} · vence ${formatDay(row.dueOn)} · ${row.status}`,
    )
    .join("\n");
}

export function formatConfirmPrompt(actionLabel: string, entry: FormattableEntry) {
  return [
    `${actionLabel}:`,
    `${formatBRL(entry.amountCents)} · ${entry.title}${entry.notes ? ` · ${entry.notes}` : ""} · ${formatDay(entry.occurredOn)}`,
    "",
    "Responda sim para confirmar ou cancela.",
  ].join("\n");
}
