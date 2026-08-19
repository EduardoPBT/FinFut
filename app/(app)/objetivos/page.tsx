import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { GoalForm } from "@/components/forms/goal-form";
import { GoalCard } from "@/components/dashboard/goal-card";
import { SementeMascot } from "@/components/mascots/semente";
import { deleteGoal } from "@/lib/actions/goals";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadMonthData } from "@/lib/data/month";
import { parseYearMonth } from "@/lib/money/competence";

export default async function ObjetivosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const competence = parseYearMonth(mes);
  const workspace = await loadWorkspace();
  const month = await loadMonthData(workspace.household.id, competence);

  return (
    <div>
      <PageHeader eyebrow="Semente" title="Objetivos" yearMonth={competence.yearMonth} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <GlassPanel className="p-5">
          <div className="mb-3 flex justify-center">
            <SementeMascot progress={0.35} size={120} />
          </div>
          <GoalForm accounts={workspace.bankAccounts} />
        </GlassPanel>
        <div className="grid gap-3">
          {month.goals.length === 0 ? (
            <GlassPanel className="grid place-items-center p-10 text-center">
              <SementeMascot progress={0} size={120} />
              <p className="mt-2 font-semibold text-slate-600">
                Plante o primeiro objetivo do casal.
              </p>
            </GlassPanel>
          ) : (
            month.goals.map((goal) => (
              <GlassPanel key={goal.id} className="p-2">
                <GoalCard goal={goal} accounts={workspace.bankAccounts} />
                <form action={deleteGoal} className="px-3 pb-2 text-right">
                  <input type="hidden" name="id" value={goal.id} />
                  <button className="text-xs text-slate-400" type="submit">
                    remover
                  </button>
                </form>
              </GlassPanel>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
