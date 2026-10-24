import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBRL } from "@/lib/money/brl";
import { monthLabel, parseYearMonth, shiftYearMonth } from "@/lib/money/competence";
import {
  formatMonthSummary,
  formatPendingBills,
  formatSpendingByCategory,
  formatStatements,
} from "@/lib/finance/format-telegram";
import { loadHouseholdContext, type HouseholdContext } from "@/lib/finance/context";
import {
  compareWithPreviousMonth,
  listCardStatements,
  listInbox,
  listPendingBills,
  loadMonthSnapshot,
  spendingByCategory,
} from "@/lib/finance/queries";
import { classifyQuestion } from "@/lib/telegram/qa-classify";

export async function handleQuestion(
  supabase: SupabaseClient,
  householdId: string,
  text: string,
  ctx?: HouseholdContext,
) {
  const context = ctx ?? (await loadHouseholdContext(supabase, householdId));
  const classified = await classifyQuestion(
    text,
    context.categories.map((item) => item.name),
  );
  if (classified.intent === "unknown" || classified.confidence < 0.7) {
    return { handled: false as const, reply: "Não entendi a pergunta. Tente /help ou seja mais específico." };
  }

  const competence =
    classified.period === "previous_month"
      ? parseYearMonth(shiftYearMonth(parseYearMonth().yearMonth, -1))
      : undefined;

  switch (classified.intent) {
    case "month_summary": {
      const snapshot = await loadMonthSnapshot(supabase, householdId, competence, context);
      return {
        handled: true as const,
        reply: formatMonthSummary({
          yearMonth: snapshot.competence.yearMonth,
          incomeCents: snapshot.incomeCents,
          expenseCents: snapshot.expenseCents,
          remainingCents: snapshot.remainingCents,
        }),
      };
    }
    case "spending_by_category": {
      const category = classified.category ?? "Outros";
      const spent = await spendingByCategory(supabase, householdId, category, competence, context);
      return { handled: true as const, reply: formatSpendingByCategory(spent) };
    }
    case "card_statement":
      return {
        handled: true as const,
        reply: formatStatements(await listCardStatements(supabase, householdId)),
      };
    case "pending_bills":
      return {
        handled: true as const,
        reply: formatPendingBills(await listPendingBills(supabase, householdId, context)),
      };
    case "budget_status": {
      const snapshot = await loadMonthSnapshot(supabase, householdId, competence, context);
      const envelopes = snapshot.insights.envelopes ?? [];
      if (envelopes.length === 0) {
        return { handled: true as const, reply: "Nenhum envelope de orçamento cadastrado." };
      }
      const lines = envelopes.map((item) => {
        const pct = item.limitCents > 0 ? Math.round((item.spentCents / item.limitCents) * 100) : 0;
        return `${item.name}: ${formatBRL(item.spentCents)} de ${formatBRL(item.limitCents)} (${pct}%)`;
      });
      return { handled: true as const, reply: lines.join("\n") };
    }
    case "compare_periods": {
      const compared = await compareWithPreviousMonth(supabase, householdId, context);
      const verb = compared.deltaCents >= 0 ? "mais" : "menos";
      return {
        handled: true as const,
        reply: [
          `${monthLabel(compared.currentYearMonth)}: ${formatBRL(compared.currentExpenseCents)}`,
          `${monthLabel(compared.previousYearMonth)}: ${formatBRL(compared.previousExpenseCents)}`,
          `Este mês está ${formatBRL(Math.abs(compared.deltaCents))} ${verb}.`,
        ].join("\n"),
      };
    }
    case "inbox_count": {
      const inbox = await listInbox(supabase, householdId);
      return {
        handled: true as const,
        reply:
          inbox.length === 0
            ? "Inbox vazia."
            : `${inbox.length} mensagem(ns) pendente(s) na Inbox.`,
      };
    }
    default:
      return { handled: false as const, reply: "Não entendi a pergunta. Tente /help." };
  }
}
