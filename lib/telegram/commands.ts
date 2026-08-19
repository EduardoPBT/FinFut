import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatBalances,
  formatEntryList,
  formatHelp,
  formatGoals,
  formatMonthSummary,
  formatPendingBills,
  formatStatements,
} from "@/lib/finance/format-telegram";
import {
  listAccountBalances,
  listCardStatements,
  listGoals,
  listInbox,
  listPendingBills,
  listRecentEntries,
  loadMonthSnapshot,
} from "@/lib/finance/queries";
import { formatBRL } from "@/lib/money/brl";

export function parseSlashCommand(text: string) {
  const [rawName, ...rest] = text.trim().split(/\s+/);
  const name = (rawName ?? "").replace(/@\w+$/, "").toLowerCase();
  return { name, arg: rest.join(" ").trim() };
}

export async function runTelegramCommand(
  supabase: SupabaseClient,
  householdId: string,
  text: string,
) {
  const { name, arg } = parseSlashCommand(text);
  switch (name) {
    case "/help":
    case "/start":
      return formatHelp();
    case "/mes": {
      const snapshot = await loadMonthSnapshot(supabase, householdId);
      return formatMonthSummary({
        yearMonth: snapshot.competence.yearMonth,
        incomeCents: snapshot.incomeCents,
        expenseCents: snapshot.expenseCents,
        remainingCents: snapshot.remainingCents,
      });
    }
    case "/ultimos": {
      const limit = Number(arg) || 5;
      const entries = await listRecentEntries(supabase, householdId, limit);
      return formatEntryList(
        entries.map((item) => ({
          amountCents: item.amountCents,
          occurredOn: item.occurredOn,
          title: item.categoryName,
          notes: item.notes,
        })),
      );
    }
    case "/fatura":
      return formatStatements(await listCardStatements(supabase, householdId));
    case "/contas":
      return formatPendingBills(await listPendingBills(supabase, householdId));
    case "/inbox": {
      const inbox = await listInbox(supabase, householdId);
      if (inbox.length === 0) return "Inbox vazia.";
      return inbox
        .map(
          (item, index) =>
            `${index + 1}) ${item.parsed_amount_cents ? formatBRL(item.parsed_amount_cents) : "?"} · ${item.raw_text}`,
        )
        .join("\n");
    }
    case "/saldo": {
      const balances = await listAccountBalances(supabase, householdId);
      return formatBalances(balances.rows, balances.totalCents);
    }
    case "/metas":
      return formatGoals(await listGoals(supabase, householdId));
    default:
      return `Comando ${name} não existe.\n\n${formatHelp()}`;
  }
}
