import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { BillForm } from "@/components/forms/bill-form";
import { IncomeForm } from "@/components/forms/income-form";
import { BillEditCard } from "@/components/dashboard/bill-edit-card";
import { IncomeEditCard } from "@/components/dashboard/income-edit-card";
import { RecorrentesTabs } from "@/components/nav/recorrentes-tabs";
import { CasaMascot } from "@/components/mascots/casa";
import { FluxMascot } from "@/components/mascots/flux";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadMonthData } from "@/lib/data/month";
import { parseYearMonth } from "@/lib/money/competence";

export default async function RecorrentesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; aba?: string }>;
}) {
  const { mes, aba } = await searchParams;
  const competence = parseYearMonth(mes);
  const workspace = await loadWorkspace();
  const month = await loadMonthData(workspace.household.id, competence);
  const isReceitas = aba === "receitas";

  const billById = new Map(month.recurringBills.map((bill) => [bill.id, bill]));
  const sourceById = new Map(month.incomeSources.map((source) => [source.id, source]));

  const billsPaid =
    month.billInstances.length > 0 &&
    month.billInstances.every((item) => item.status === "pago");
  const incomeReceived =
    month.incomeInstances.length > 0 &&
    month.incomeInstances.every((item) => item.status === "recebido");

  return (
    <div>
      <PageHeader
        eyebrow="Casa"
        title="Recorrentes"
        yearMonth={competence.yearMonth}
      />
      <Suspense fallback={null}>
        <RecorrentesTabs yearMonth={competence.yearMonth} />
      </Suspense>

      {!isReceitas ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <GlassPanel className="p-5">
            <div className="mb-4 flex justify-center">
              <CasaMascot mood={billsPaid ? "good" : "ok"} size={120} />
            </div>
            <p className="mb-3 text-sm font-semibold text-slate-700">Nova despesa fixa</p>
            <BillForm
              categories={workspace.categories}
              accounts={workspace.bankAccounts}
              cards={workspace.creditCards}
              yearMonth={competence.yearMonth}
            />
          </GlassPanel>
          <div className="grid gap-3">
            {month.billInstances.length === 0 ? (
              <GlassPanel className="grid place-items-center p-10 text-center">
                <CasaMascot mood="empty" size={110} />
                <p className="mt-2 font-semibold text-slate-600">
                  Nenhuma despesa fixa neste mês.
                </p>
              </GlassPanel>
            ) : (
              month.billInstances.map((instance) => {
                const bill = billById.get(instance.recurring_bill_id);
                if (!bill) return null;
                return (
                  <GlassPanel key={instance.id} className="p-2">
                    <BillEditCard
                      instance={instance}
                      bill={bill}
                      categories={workspace.categories}
                      accounts={workspace.bankAccounts}
                      cards={workspace.creditCards}
                      yearMonth={competence.yearMonth}
                    />
                  </GlassPanel>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <GlassPanel className="p-5">
            <div className="mb-4 flex justify-center">
              <FluxMascot mood={incomeReceived ? "good" : "ok"} size={120} />
            </div>
            <p className="mb-3 text-sm font-semibold text-slate-700">Nova receita recorrente</p>
            <IncomeForm
              categories={workspace.categories}
              members={workspace.members}
              accounts={workspace.bankAccounts}
              yearMonth={competence.yearMonth}
            />
          </GlassPanel>
          <div className="grid gap-3">
            {month.incomeInstances.length === 0 ? (
              <GlassPanel className="grid place-items-center p-10 text-center">
                <FluxMascot mood="empty" size={110} />
                <p className="mt-2 font-semibold text-slate-600">
                  Cadastre salários ou extras que entram todo mês.
                </p>
              </GlassPanel>
            ) : (
              month.incomeInstances.map((instance) => {
                const source = sourceById.get(instance.income_source_id);
                if (!source) return null;
                return (
                  <GlassPanel key={instance.id} className="p-2">
                    <IncomeEditCard
                      instance={instance}
                      source={source}
                      categories={workspace.categories}
                      members={workspace.members}
                      accounts={workspace.bankAccounts}
                      yearMonth={competence.yearMonth}
                    />
                  </GlassPanel>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
