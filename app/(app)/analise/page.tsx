import { PageHeader } from "@/components/shell/page-header";
import { InsightBoard } from "@/components/dashboard/insight-board";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Amount } from "@/components/ui/amount";
import { CashflowPanel } from "@/components/dashboard/cashflow-panel";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadMonthData } from "@/lib/data/month";
import { insightsFromMonth } from "@/lib/data/insights";
import { loadSixMonthTrend } from "@/lib/data/history";
import { loadCashflowProjection } from "@/lib/data/projections";
import { loadAccountMovements, loadUpcomingStatements } from "@/lib/data/ledger";
import { loadPlanningExtras } from "@/lib/data/planning";
import { committedCardCents, emergencyMonths } from "@/lib/money/cashflow";
import { monthLabel, parseYearMonth } from "@/lib/money/competence";

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const competence = parseYearMonth(mes);
  const workspace = await loadWorkspace();
  const extras = await loadPlanningExtras(workspace.household.id);
  const [month, trend, movements, statements] = await Promise.all([
    loadMonthData(workspace.household.id, competence),
    loadSixMonthTrend(workspace.household.id, workspace.categories, competence.yearMonth),
    loadAccountMovements(workspace.household.id),
    loadUpcomingStatements(workspace.household.id),
  ]);
  const cashflow = await loadCashflowProjection(workspace.household.id, workspace.bankAccounts, {
    annualEvents: extras.annualEvents,
    movements,
    statements,
  });
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

  return (
    <div>
      <PageHeader eyebrow="Olhar" title="Análise do casal" yearMonth={competence.yearMonth} />
      <div className="mb-4">
        <CashflowPanel
          startBalanceCents={cashflow.startBalanceCents}
          scheduledInCents={cashflow.scheduledInCents}
          scheduledOutCents={cashflow.scheduledOutCents}
          projection={cashflow.projection}
          committedCents={committedCardCents(statements)}
          emergencyMonthsValue={emergencyMonths(
            month.goals.reduce((sum, goal) => sum + goal.current_cents, 0),
            insights.fixedCents,
          )}
        />
      </div>
      <InsightBoard insights={insights} />
      {insights.envelopes.length > 0 ? (
        <GlassPanel className="mt-4 p-4">
          <p className="mb-2 text-sm font-bold text-slate-700">Envelopes variáveis</p>
          <ul className="grid gap-1 text-sm">
            {insights.envelopes.map((item) => (
              <li key={item.name} className="flex justify-between">
                <span>{item.name}</span>
                <span className={item.spentCents > item.limitCents ? "text-rose-600" : ""}>
                  <Amount cents={item.spentCents} /> / <Amount cents={item.limitCents} />
                </span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : null}
      {insights.spentByMember.length > 0 ? (
        <GlassPanel className="mt-4 p-4">
          <p className="mb-2 text-sm font-bold text-slate-700">Quem gastou (caixa única)</p>
          <ul className="grid gap-1 text-sm text-slate-600">
            {insights.spentByMember.map((item) => (
              <li key={item.name} className="flex justify-between">
                <span>{item.name}</span>
                <Amount cents={item.cents} />
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : null}
      <GlassPanel className="mt-4 p-4">
        <p className="mb-2 text-sm font-bold text-slate-700">Últimos 6 meses</p>
        <ul className="grid gap-1 text-sm text-slate-600">
          {trend.map((item) => (
            <li key={item.yearMonth} className="flex justify-between gap-2">
              <span>{monthLabel(item.yearMonth)}</span>
              <span>
                sobra <Amount cents={item.remainingCents} /> · fixas{" "}
                {Math.round(item.fixedShare * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
