import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveBillDisplayStatus } from "@/lib/money/bill-status";
import { resolveIncomeDisplayStatus } from "@/lib/money/income-status";
import { recordIncomeReceipt, repairOrphanIncomeReceiptAccounts, shouldAutoReceiveIncome } from "@/lib/money/income-receipt";
import { dueOnForMonth, parseYearMonth, todayISO } from "@/lib/money/competence";
import type {
  AnnualEvent,
  BillInstance,
  BillInstanceView,
  CardCharge,
  CategoryBudget,
  Goal,
  IncomeInstance,
  IncomeInstanceView,
  IncomeSource,
  RecurringBill,
  Transaction,
} from "@/lib/types";

export type Competence = {
  yearMonth: string;
  start: string;
  end: string;
  year: number;
  month: number;
  lastDay: number;
};

export async function ensureBillInstances(
  householdId: string,
  competence: Competence,
) {
  const supabase = await createClient();
  const { data: bills } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true);

  const recurring = (bills ?? []) as RecurringBill[];
  if (recurring.length === 0) return;

  const rows = recurring.map((bill) => ({
    household_id: householdId,
    recurring_bill_id: bill.id,
    competence: competence.start,
    amount_cents: bill.amount_cents,
    due_on: dueOnForMonth(
      competence.year,
      competence.month,
      bill.due_day,
      competence.lastDay,
    ),
    status: "pendente" as const,
  }));

  await supabase.from("bill_instances").upsert(rows, {
    onConflict: "recurring_bill_id,competence",
    ignoreDuplicates: true,
  });
}

export async function ensureIncomeInstances(
  householdId: string,
  competence: Competence,
) {
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("income_sources")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true);

  const incomes = (sources ?? []) as IncomeSource[];
  if (incomes.length === 0) return;

  const rows = incomes
    .filter((source) => source.typical_amount_cents > 0 && source.payday)
    .map((source) => ({
      household_id: householdId,
      income_source_id: source.id,
      competence: competence.start,
      amount_cents: source.typical_amount_cents,
      expected_on: dueOnForMonth(
        competence.year,
        competence.month,
        source.payday!,
        competence.lastDay,
      ),
      account_id: source.default_account_id ?? null,
      status: "pendente" as const,
    }));

  if (rows.length === 0) return;

  await supabase.from("income_instances").upsert(rows, {
    onConflict: "income_source_id,competence",
    ignoreDuplicates: true,
  });
}

export async function syncAutoReceivedIncomeInstances(householdId: string, today: string) {
  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("income_instances")
    .select(
      "id, amount_cents, expected_on, account_id, income_sources!inner(name, kind, category_id, member_id, default_account_id)",
    )
    .eq("household_id", householdId)
    .eq("status", "pendente")
    .eq("suppress_auto_receive", false)
    .lte("expected_on", today);

  for (const row of pending ?? []) {
    const joined = row.income_sources;
    const source = (Array.isArray(joined) ? joined[0] : joined) as {
      name: string;
      kind: "fixo" | "variavel";
      category_id: string | null;
      member_id: string | null;
      default_account_id: string | null;
    } | null;

    if (!source) continue;

    if (!shouldAutoReceiveIncome(source.kind, row.expected_on, today)) continue;

    await recordIncomeReceipt(supabase, {
      householdId,
      instanceId: row.id,
      sourceName: source.name,
      categoryId: source.category_id,
      memberId: source.member_id,
      amountCents: row.amount_cents,
      receivedOn: row.expected_on,
      accountId: row.account_id ?? source.default_account_id,
      auto: true,
    });
  }
}

export async function fetchMonthData(
  supabase: SupabaseClient,
  householdId: string,
  competence: Competence,
  today = todayISO(),
) {
  const [
    { data: transactions },
    { data: instances },
    { data: bills },
    { data: goals },
    { data: incomeInstances },
    { data: incomeSources },
    { data: monthStatements },
    { data: annualRows },
    { data: budgetRows },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("household_id", householdId)
      .gte("occurred_on", competence.start)
      .lte("occurred_on", competence.end)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("bill_instances")
      .select("*")
      .eq("household_id", householdId)
      .eq("competence", competence.start)
      .order("due_on"),
    supabase
      .from("recurring_bills")
      .select("*")
      .eq("household_id", householdId)
      .order("due_day"),
    supabase
      .from("goals")
      .select("*")
      .eq("household_id", householdId)
      .order("priority"),
    supabase
      .from("income_instances")
      .select("*")
      .eq("household_id", householdId)
      .eq("competence", competence.start)
      .order("expected_on"),
    supabase
      .from("income_sources")
      .select("*")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("payday"),
    supabase
      .from("card_statements")
      .select("id")
      .eq("household_id", householdId)
      .gte("due_on", competence.start)
      .lte("due_on", competence.end),
    supabase
      .from("annual_events")
      .select("*")
      .eq("household_id", householdId)
      .eq("active", true)
      .eq("event_month", competence.month),
    supabase
      .from("category_budgets")
      .select("*")
      .eq("household_id", householdId),
  ]);

  const statementIds = ((monthStatements ?? []) as Array<{ id: string }>).map(
    (item) => item.id,
  );
  let cardCharges: CardCharge[] = [];
  if (statementIds.length > 0) {
    const { data } = await supabase
      .from("card_charges")
      .select("*")
      .eq("household_id", householdId)
      .in("card_statement_id", statementIds)
      .order("occurred_on", { ascending: false });
    cardCharges = (data ?? []) as CardCharge[];
  }

  const billInstances: BillInstanceView[] = ((instances ?? []) as BillInstance[]).map(
    (instance) => ({
      ...instance,
      status: resolveBillDisplayStatus(instance.status, instance.due_on, today),
    }),
  );

  const incomeInstancesView: IncomeInstanceView[] = (
    (incomeInstances ?? []) as IncomeInstance[]
  ).map((instance) => ({
    ...instance,
    status: resolveIncomeDisplayStatus(instance.status, instance.expected_on, today),
  }));

  return {
    transactions: (transactions ?? []) as Transaction[],
    billInstances,
    recurringBills: (bills ?? []) as RecurringBill[],
    goals: (goals ?? []) as Goal[],
    incomeInstances: incomeInstancesView,
    incomeSources: (incomeSources ?? []) as IncomeSource[],
    cardCharges,
    annualEvents: (annualRows ?? []) as AnnualEvent[],
    budgets: (budgetRows ?? []) as CategoryBudget[],
  };
}

export function isCurrentCompetence(competence: Competence) {
  return competence.yearMonth === parseYearMonth().yearMonth;
}

/** Escritas mensais (contas/receitas/auto-receive). Só rode no mês atual ou quando necessário. */
export async function syncMonthSideEffects(
  householdId: string,
  competence: Competence,
  options?: { repairOrphans?: boolean },
) {
  const supabase = await createClient();
  const today = todayISO();
  await ensureBillInstances(householdId, competence);
  await ensureIncomeInstances(householdId, competence);
  if (!isCurrentCompetence(competence)) return;

  await syncAutoReceivedIncomeInstances(householdId, today);
  if (options?.repairOrphans !== false) {
    await repairOrphanIncomeReceiptAccounts(supabase, householdId);
  }
}

export async function syncCurrentMonth(householdId: string) {
  await syncMonthSideEffects(householdId, parseYearMonth());
}

export async function loadMonthData(
  householdId: string,
  competence: Competence,
  options?: { sync?: boolean },
) {
  const supabase = await createClient();
  const today = todayISO();
  const shouldSync = options?.sync ?? true;
  if (shouldSync) {
    await syncMonthSideEffects(householdId, competence);
  }
  return fetchMonthData(supabase, householdId, competence, today);
}

/** Leitura pura — sem UPSERTs nem repair. Use em histórico/trend. */
export async function readMonthData(householdId: string, competence: Competence) {
  return loadMonthData(householdId, competence, { sync: false });
}
