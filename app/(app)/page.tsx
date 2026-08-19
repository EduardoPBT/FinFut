import { CashflowPanel } from "@/components/dashboard/cashflow-panel";
import { DueReminders } from "@/components/dashboard/due-reminders";
import { AccountBalancesCard } from "@/components/dashboard/account-balances";
import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import { MascotRow } from "@/components/dashboard/mascot-row";
import { MonthBalancePanel } from "@/components/dashboard/month-balance-panel";
import { MonthRing } from "@/components/dashboard/month-ring";
import { QuickAdd } from "@/components/dashboard/quick-add";
import { BillToggle } from "@/components/dashboard/bill-toggle";
import { GoalCard } from "@/components/dashboard/goal-card";
import { PageHeader } from "@/components/shell/page-header";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadMonthData } from "@/lib/data/month";
import { insightsFromMonth } from "@/lib/data/insights";
import { loadAccountMovements, loadUpcomingStatements } from "@/lib/data/ledger";
import { loadCashflowProjection } from "@/lib/data/projections";
import { loadPlanningExtras } from "@/lib/data/planning";
import { committedCardCents, emergencyMonths } from "@/lib/money/cashflow";
import { balancesByAccount } from "@/lib/money/account-balance";
import { parseYearMonth, todayISO, formatDay } from "@/lib/money/competence";
import { statementStatusLabel } from "@/lib/money/card-cycle";
import { clampPercent } from "@/lib/money/brl";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const competence = parseYearMonth(mes);
  const workspace = await loadWorkspace();
  const month = await loadMonthData(workspace.household.id, competence);
  const [movements, upcomingStatements, extras] = await Promise.all([
    loadAccountMovements(workspace.household.id),
    loadUpcomingStatements(workspace.household.id),
    loadPlanningExtras(workspace.household.id),
  ]);
  const accountBalances = balancesByAccount(workspace.bankAccounts, movements);
  const { startBalanceCents, scheduledInCents, scheduledOutCents, projection } =
    await loadCashflowProjection(
    workspace.household.id,
    workspace.bankAccounts,
    { annualEvents: extras.annualEvents },
  );
  const insights = insightsFromMonth({
    incomeSources: month.incomeSources,
    incomeInstances: month.incomeInstances,
    categories: workspace.categories,
    transactions: month.transactions,
    billInstances: month.billInstances,
    cardCharges: month.cardCharges,
    goals: month.goals,
    annualEvents: month.annualEvents,
    budgets: month.budgets,
    members: workspace.members,
  });
  const committedCents = committedCardCents(upcomingStatements);
  const reserveCents = month.goals.reduce((sum, goal) => sum + goal.current_cents, 0);
  const monthsOfReserve = emergencyMonths(reserveCents, insights.fixedCents);

  const paidShare =
    month.billInstances.length === 0
      ? 0
      : month.billInstances.filter((item) => item.status === "pago").length /
        month.billInstances.length;
  const goalShare =
    month.goals.length === 0
      ? 0
      : month.goals.reduce(
          (sum, goal) =>
            sum + clampPercent(goal.current_cents / goal.target_cents),
          0,
        ) / month.goals.length;

  const upcoming = month.billInstances.filter((item) => item.status !== "pago").slice(0, 4);
  const billById = new Map(month.recurringBills.map((bill) => [bill.id, bill]));
  const incomeSourceById = new Map(month.incomeSources.map((item) => [item.id, item]));
  const incomeFixedPendingCents = month.incomeInstances
    .filter(
      (item) =>
        item.status !== "recebido" &&
        incomeSourceById.get(item.income_source_id)?.kind === "fixo",
    )
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const incomeVariablePendingCents = month.incomeInstances
    .filter(
      (item) =>
        item.status !== "recebido" &&
        incomeSourceById.get(item.income_source_id)?.kind === "variavel",
    )
    .reduce((sum, item) => sum + item.amount_cents, 0);

  return (
    <div>
      <PageHeader
        eyebrow={workspace.household.name}
        title="O mês em movimento"
        yearMonth={competence.yearMonth}
      />
      <div className="mb-5">
        <MonthBalancePanel
          insights={insights}
          fixedBreakdown={insights.fixedBreakdown}
          incomeFixedPendingCents={incomeFixedPendingCents}
          incomeVariablePendingCents={incomeVariablePendingCents}
        />
      </div>
      <MascotRow mood={insights.mood} paidShare={paidShare} goalShare={goalShare} />
      <div className="mt-4 grid gap-3">
        <CashflowPanel
          startBalanceCents={startBalanceCents}
          scheduledInCents={scheduledInCents}
          scheduledOutCents={scheduledOutCents}
          projection={projection}
          committedCents={committedCents}
          emergencyMonthsValue={monthsOfReserve}
        />
        <DueReminders
          bills={month.billInstances}
          statements={upcomingStatements}
          reminderDays={workspace.household.reminder_days ?? 3}
          billNames={new Map(month.recurringBills.map((item) => [item.id, item.name]))}
          cardNames={new Map(workspace.creditCards.map((item) => [item.id, item.name]))}
        />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[200px_1fr]">
        <GlassPanel className="grid place-items-center p-4">
          <MonthRing
            remainingCents={insights.remainingCents}
            slices={[
              { label: "Fixas", cents: insights.fixedCents, color: "#0f766e" },
              { label: "Variáveis", cents: insights.variableCents, color: "#38bdf8" },
            ]}
          />
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="mb-3 text-sm font-bold text-slate-700">Contas da casa</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Nada pendente neste mês.</p>
          ) : (
            <div className="grid gap-2">
              {upcoming.map((instance) => (
                <BillToggle
                  key={instance.id}
                  instance={instance}
                  bill={billById.get(instance.recurring_bill_id)}
                  accounts={workspace.bankAccounts}
                  cards={workspace.creditCards}
                />
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <AccountBalancesCard items={accountBalances} />
        <GlassPanel className="p-4">
          <p className="mb-3 text-sm font-bold text-slate-700">Faturas</p>
          {upcomingStatements.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma fatura aberta.</p>
          ) : (
            <ul className="grid gap-2">
              {upcomingStatements.slice(0, 4).map((statement) => {
                const card = workspace.creditCards.find((item) => item.id === statement.credit_card_id);
                return (
                  <li key={statement.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600">
                      {card?.name ?? "Cartão"} · {formatDay(statement.due_on)} ·{" "}
                      {statementStatusLabel(statement.displayStatus)}
                    </span>
                    <Amount cents={statement.totalCents} />
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>
      </div>
      <div className="mt-4 grid gap-3">
        {month.goals.slice(0, 2).map((goal) => (
          <GlassPanel key={goal.id} className="p-2">
            <GoalCard goal={goal} accounts={workspace.bankAccounts} />
          </GlassPanel>
        ))}
      </div>
      <QuickAdd
        categories={workspace.categories}
        members={workspace.members}
        accounts={workspace.bankAccounts}
        cards={workspace.creditCards}
        defaultDate={todayISO()}
      />
    </div>
  );
}
