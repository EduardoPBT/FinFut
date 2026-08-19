import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import {
  updateCategory,
  updateHousehold,
  updateIncomeSource,
  updateMember,
} from "@/lib/actions/settings";
import { AccountManager } from "@/components/forms/account-form";
import { CreditCardManager } from "@/components/forms/credit-card-form";
import { PlanningSettings } from "@/components/forms/planning-settings";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadAccountMovements } from "@/lib/data/ledger";
import { loadPlanningExtras } from "@/lib/data/planning";
import { balancesByAccount } from "@/lib/money/account-balance";
import { formatBRL, formatBRLInput } from "@/lib/money/brl";

export default async function ConfiguracoesPage() {
  const workspace = await loadWorkspace();
  const [movements, extras] = await Promise.all([
    loadAccountMovements(workspace.household.id),
    loadPlanningExtras(workspace.household.id),
  ]);
  const balances = new Map(
    balancesByAccount(workspace.bankAccounts, movements).map((item) => [
      item.account.id,
      item.balanceCents,
    ]),
  );

  return (
    <div>
      <PageHeader eyebrow="Casa" title="Configurações" />
      <div className="grid gap-4">
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Nome da caixa</p>
          <form action={updateHousehold} className="flex gap-2">
            <input
              name="name"
              defaultValue={workspace.household.name}
              className="flex-1 rounded-full bg-white/80 px-4 py-3 outline-none"
            />
            <Button type="submit">salvar</Button>
          </form>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Vocês dois</p>
          <div className="grid gap-3">
            {workspace.members.map((member) => (
              <form key={member.id} action={updateMember} className="flex gap-2">
                <input type="hidden" name="id" value={member.id} />
                <input
                  name="display_name"
                  defaultValue={member.display_name}
                  className="flex-1 rounded-full bg-white/80 px-4 py-3 outline-none"
                />
                <Button type="submit" variant="soft">
                  ok
                </Button>
              </form>
            ))}
          </div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Contas</p>
          <AccountManager accounts={workspace.bankAccounts} balances={balances} />
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Cartões</p>
          <CreditCardManager cards={workspace.creditCards} accounts={workspace.bankAccounts} />
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Rendas</p>
          <div className="grid gap-4">
            {workspace.incomeSources.map((source) => (
              <form key={source.id} action={updateIncomeSource} className="grid gap-2 md:grid-cols-[1fr_140px_90px_auto] md:items-end">
                <input type="hidden" name="id" value={source.id} />
                <p className="font-semibold text-slate-700">
                  {source.name}
                  <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                    {source.kind}
                  </span>
                </p>
                <label className="text-xs text-slate-500">
                  valor típico (R$)
                  <input
                    name="typical_amount"
                    inputMode="decimal"
                    defaultValue={formatBRLInput(source.typical_amount_cents)}
                    className="mt-1 w-full rounded-full bg-white/80 px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  dia
                  <input
                    name="payday"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={source.payday ?? ""}
                    className="mt-1 w-full rounded-full bg-white/80 px-3 py-2 outline-none"
                  />
                </label>
                <Button type="submit" variant="soft">
                  salvar
                </Button>
              </form>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Valores atuais:{" "}
            {workspace.incomeSources
              .map((source) => `${source.name} ${formatBRL(source.typical_amount_cents)}`)
              .join(" · ")}
          </p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Casa, envelopes e ano</p>
          <PlanningSettings
            inviteCode={workspace.household.invite_code ?? "—"}
            reminderDays={workspace.household.reminder_days ?? 3}
            categories={workspace.categories}
            budgets={extras.budgets}
            annualEvents={extras.annualEvents}
          />
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-bold text-slate-700">Categorias</p>
          <div className="grid gap-2">
            {workspace.categories.map((category) => (
              <form key={category.id} action={updateCategory} className="flex items-center gap-2">
                <input type="hidden" name="id" value={category.id} />
                <span
                  className="h-8 w-8 rounded-xl"
                  style={{ background: category.color }}
                />
                <input
                  name="name"
                  defaultValue={category.name}
                  className="flex-1 rounded-full bg-white/80 px-3 py-2 outline-none"
                />
                <span className="w-16 text-xs uppercase text-slate-400">{category.kind}</span>
                <Button type="submit" variant="ghost" className="px-3 py-2">
                  ok
                </Button>
              </form>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
