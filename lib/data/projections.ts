import { createClient } from "@/lib/supabase/server";
import { addCalendarDays } from "@/lib/money/card-cycle";
import { dueOnForMonth, parseYearMonth, todayISO } from "@/lib/money/competence";
import { householdCashCents, type BalanceMovement } from "@/lib/money/account-balance";
import {
  eventDateForProjection,
  repairOrphanIncomeReceiptAccounts,
} from "@/lib/money/income-receipt";
import { projectCashflow, type CashflowEvent } from "@/lib/money/cashflow";
import { loadAccountMovements, loadUpcomingStatements } from "@/lib/data/ledger";
import type { AnnualEvent, BankAccount, BillInstance, IncomeInstance } from "@/lib/types";

function nextDueForMonth(eventMonth: number, dueDay: number, fromDate: string) {
  const from = parseYearMonth(fromDate.slice(0, 7));
  const year = eventMonth >= from.month ? from.year : from.year + 1;
  const lastDay = new Date(Date.UTC(year, eventMonth, 0)).getUTCDate();
  return dueOnForMonth(year, eventMonth, dueDay, lastDay);
}

function sumScheduled(events: CashflowEvent[], sign: "in" | "out") {
  return events
    .filter((event) => (sign === "in" ? event.cents > 0 : event.cents < 0))
    .reduce((sum, event) => sum + Math.abs(event.cents), 0);
}

export async function loadCashflowProjection(
  householdId: string,
  accounts: BankAccount[],
  extra?: { annualEvents?: AnnualEvent[] },
) {
  const supabase = await createClient();
  await repairOrphanIncomeReceiptAccounts(supabase, householdId);

  const today = todayISO();
  const horizon = addCalendarDays(today, 44);
  const movements = (await loadAccountMovements(householdId)) as BalanceMovement[];
  const startBalanceCents = householdCashCents(accounts, movements);
  const statements = await loadUpcomingStatements(householdId);

  const [{ data: bills }, { data: incomes }] = await Promise.all([
    supabase
      .from("bill_instances")
      .select("amount_cents, due_on, status, card_charge_id, recurring_bills(name)")
      .eq("household_id", householdId)
      .neq("status", "pago")
      .lte("due_on", horizon),
    supabase
      .from("income_instances")
      .select("amount_cents, expected_on, status, income_sources(name)")
      .eq("household_id", householdId)
      .neq("status", "recebido")
      .lte("expected_on", horizon),
  ]);

  const events: CashflowEvent[] = [];

  for (const bill of (bills ?? []) as Array<
    BillInstance & { recurring_bills: { name: string } | { name: string }[] | null }
  >) {
    if (bill.card_charge_id) continue;
    const joined = bill.recurring_bills;
    const name = (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? "Conta";
    const due = eventDateForProjection(bill.due_on, today);
    const suffix = bill.due_on < today ? " (atrasada)" : "";
    events.push({ date: due, label: `${name}${suffix}`, cents: -bill.amount_cents });
  }

  for (const income of (incomes ?? []) as Array<
    IncomeInstance & { income_sources: { name: string } | { name: string }[] | null }
  >) {
    const joined = income.income_sources;
    const name = (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? "Receita";
    const due = eventDateForProjection(income.expected_on, today);
    const suffix = income.expected_on < today ? " (atrasada)" : "";
    events.push({ date: due, label: `${name}${suffix}`, cents: income.amount_cents });
  }

  for (const statement of statements) {
    if (statement.displayStatus === "paga") continue;
    if (statement.due_on < today || statement.due_on > horizon) continue;
    const remaining = Math.max(0, statement.totalCents - (statement.paid_cents ?? 0));
    if (remaining <= 0) continue;
    events.push({ date: statement.due_on, label: "Fatura", cents: -remaining });
  }

  for (const event of extra?.annualEvents ?? []) {
    if (!event.active) continue;
    const due = nextDueForMonth(event.event_month, event.due_day, today);
    if (due < today || due > horizon) continue;
    const sign = event.kind === "receita" ? 1 : -1;
    events.push({ date: due, label: event.name, cents: sign * event.amount_cents });
  }

  const scheduledInCents = sumScheduled(events, "in");
  const scheduledOutCents = sumScheduled(events, "out");

  return {
    startBalanceCents,
    scheduledInCents,
    scheduledOutCents,
    projection: projectCashflow({
      startBalanceCents,
      startDate: today,
      dayCount: 45,
      events,
    }),
  };
}
