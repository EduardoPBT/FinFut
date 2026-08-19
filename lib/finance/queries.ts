import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMonthData, type Competence } from "@/lib/data/month";
import { loadAccountMovements, loadUpcomingStatements } from "@/lib/data/ledger";
import { insightsFromMonth } from "@/lib/data/insights";
import { balancesByAccount, householdCashCents } from "@/lib/money/account-balance";
import { parseYearMonth, shiftYearMonth } from "@/lib/money/competence";
import { loadHouseholdContext } from "@/lib/finance/context";
import type { CardCharge, Category, InboundMessage, Transaction } from "@/lib/types";

export type FinanceEntryKind = "transaction" | "charge";

export type FinanceEntry = {
  kind: FinanceEntryKind;
  id: string;
  amountCents: number;
  occurredOn: string;
  categoryId: string | null;
  categoryName: string;
  notes: string | null;
};

function titleForTransaction(item: Transaction, categoryById: Map<string, Category>) {
  if (item.movement_kind === "transferencia") {
    if (item.destination_account_id) return "Transferência";
    if (item.goal_id) return "Aporte";
    return "Fatura";
  }
  return categoryById.get(item.category_id ?? "")?.name ?? "Lançamento";
}

function toEntries(
  transactions: Transaction[],
  charges: CardCharge[],
  categories: Category[],
): FinanceEntry[] {
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const fromTx = transactions.map((item) => ({
    kind: "transaction" as const,
    id: item.id,
    amountCents: item.amount_cents,
    occurredOn: item.occurred_on,
    categoryId: item.category_id,
    categoryName: titleForTransaction(item, categoryById),
    notes: item.notes,
  }));
  const fromCharges = charges.map((item) => ({
    kind: "charge" as const,
    id: item.id,
    amountCents: item.amount_cents,
    occurredOn: item.occurred_on,
    categoryId: item.category_id,
    categoryName: categoryById.get(item.category_id ?? "")?.name ?? "Compra no cartão",
    notes: item.notes,
  }));
  return [...fromTx, ...fromCharges].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
}

export async function loadMonthSnapshot(
  supabase: SupabaseClient,
  householdId: string,
  competence?: Competence,
) {
  const ctx = await loadHouseholdContext(supabase, householdId);
  const monthCompetence = competence ?? parseYearMonth();
  const month = await fetchMonthData(supabase, householdId, monthCompetence);
  const insights = insightsFromMonth({
    incomeSources: month.incomeSources,
    incomeInstances: month.incomeInstances,
    categories: ctx.categories,
    transactions: month.transactions,
    billInstances: month.billInstances,
    cardCharges: month.cardCharges,
    goals: month.goals,
    annualEvents: month.annualEvents,
    budgets: month.budgets,
    members: ctx.members,
  });
  const incomeCents = month.transactions
    .filter((item) => item.movement_kind === "receita")
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const cashExpenseCents = month.transactions
    .filter((item) => item.movement_kind === "despesa")
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const cardExpenseCents = month.cardCharges.reduce((sum, item) => sum + item.amount_cents, 0);
  const expenseCents = cashExpenseCents + cardExpenseCents;
  return {
    ctx,
    month,
    insights,
    competence: monthCompetence,
    incomeCents,
    expenseCents,
    remainingCents: incomeCents - expenseCents,
    entries: toEntries(month.transactions, month.cardCharges, ctx.categories),
  };
}

export async function spendingByCategory(
  supabase: SupabaseClient,
  householdId: string,
  categoryName: string,
  competence?: Competence,
) {
  const snapshot = await loadMonthSnapshot(supabase, householdId, competence);
  const needle = categoryName.toLowerCase().trim();
  const cents = snapshot.entries
    .filter((item) => item.categoryName.toLowerCase() === needle)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const matched = snapshot.ctx.categories.find((item) => item.name.toLowerCase() === needle);
  return {
    categoryName: matched?.name ?? categoryName,
    yearMonth: snapshot.competence.yearMonth,
    cents,
  };
}

export async function listRecentEntries(
  supabase: SupabaseClient,
  householdId: string,
  limit = 5,
) {
  const snapshot = await loadMonthSnapshot(supabase, householdId);
  return snapshot.entries.slice(0, Math.min(20, Math.max(1, limit)));
}

export async function listPendingBills(supabase: SupabaseClient, householdId: string) {
  const snapshot = await loadMonthSnapshot(supabase, householdId);
  const billById = new Map(snapshot.month.recurringBills.map((item) => [item.id, item]));
  return snapshot.month.billInstances
    .filter((item) => item.status !== "pago")
    .map((item) => ({
      id: item.id,
      name: billById.get(item.recurring_bill_id)?.name ?? "Conta",
      amountCents: item.amount_cents,
      dueOn: item.due_on,
    }));
}

export async function listInbox(supabase: SupabaseClient, householdId: string) {
  const { data } = await supabase
    .from("inbound_messages")
    .select("*")
    .eq("household_id", householdId)
    .eq("parse_status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as InboundMessage[];
}

export async function listGoals(supabase: SupabaseClient, householdId: string) {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", householdId)
    .order("priority");
  return (data ?? []).map((item) => ({
    name: item.name as string,
    currentCents: item.current_cents as number,
    targetCents: item.target_cents as number,
  }));
}

export async function listAccountBalances(supabase: SupabaseClient, householdId: string) {
  const ctx = await loadHouseholdContext(supabase, householdId);
  const movements = await loadAccountMovements(householdId, supabase);
  const rows = balancesByAccount(ctx.accounts, movements).map((item) => ({
    name: item.account.name,
    cents: item.balanceCents,
  }));
  return { rows, totalCents: householdCashCents(ctx.accounts, movements) };
}

export async function listCardStatements(supabase: SupabaseClient, householdId: string) {
  const ctx = await loadHouseholdContext(supabase, householdId);
  const statements = await loadUpcomingStatements(householdId, supabase);
  const cardById = new Map(ctx.cards.map((item) => [item.id, item]));
  return statements.map((item) => ({
    id: item.id,
    cardName: cardById.get(item.credit_card_id)?.name ?? "Cartão",
    dueOn: item.due_on,
    remainingCents: Math.max(0, item.totalCents - (item.paid_cents ?? 0)),
    status: item.displayStatus,
  }));
}

export async function compareWithPreviousMonth(supabase: SupabaseClient, householdId: string) {
  const current = await loadMonthSnapshot(supabase, householdId);
  const previousCompetence = parseYearMonth(shiftYearMonth(current.competence.yearMonth, -1));
  const previous = await loadMonthSnapshot(supabase, householdId, previousCompetence);
  return {
    currentYearMonth: current.competence.yearMonth,
    previousYearMonth: previous.competence.yearMonth,
    currentExpenseCents: current.expenseCents,
    previousExpenseCents: previous.expenseCents,
    deltaCents: current.expenseCents - previous.expenseCents,
  };
}

export async function searchFinanceEntries(
  supabase: SupabaseClient,
  householdId: string,
  filters: {
    amountCents?: number;
    category?: string;
    notes?: string;
    limit?: number;
  },
) {
  const snapshot = await loadMonthSnapshot(supabase, householdId);
  const needle = filters.category?.toLowerCase().trim();
  const notesNeedle = filters.notes?.toLowerCase().trim();
  return snapshot.entries
    .filter((item) => {
      if (filters.amountCents && item.amountCents !== filters.amountCents) return false;
      if (needle && !item.categoryName.toLowerCase().includes(needle) && !item.notes?.toLowerCase().includes(needle)) {
        return false;
      }
      if (notesNeedle && !item.notes?.toLowerCase().includes(notesNeedle) && !item.categoryName.toLowerCase().includes(notesNeedle)) {
        return false;
      }
      return true;
    })
    .slice(0, filters.limit ?? 5);
}
