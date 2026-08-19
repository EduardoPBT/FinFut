import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Amount } from "@/components/ui/amount";
import { Chip } from "@/components/ui/chip";
import { CardChargeForm } from "@/components/forms/card-charge-form";
import { FluxMascot } from "@/components/mascots/flux";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadCreditCardDetail, loadUpcomingStatements } from "@/lib/data/ledger";
import { statementStatusLabel } from "@/lib/money/card-cycle";
import { cardUtilization } from "@/lib/money/cashflow";
import { formatDay } from "@/lib/money/competence";

export default async function CartoesPage() {
  const workspace = await loadWorkspace();
  const upcoming = await loadUpcomingStatements(workspace.household.id);

  const summaries = await Promise.all(
    workspace.creditCards.map(async (card) => {
      const detail = await loadCreditCardDetail(workspace.household.id, card.id);
      return {
        card,
        current: detail?.current ?? null,
        payable: detail?.payable[0] ?? null,
      };
    }),
  );

  return (
    <div>
      <PageHeader eyebrow="Plástico" title="Cartões" />
      {workspace.creditCards.length === 0 ? (
        <GlassPanel className="grid place-items-center p-10 text-center">
          <FluxMascot mood="empty" size={110} />
          <p className="mt-2 font-semibold text-slate-600">Cadastre um cartão em Configurações.</p>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <GlassPanel className="p-5">
            <p className="mb-3 text-sm font-semibold text-slate-700">Nova compra</p>
            <CardChargeForm
              cards={workspace.creditCards}
              categories={workspace.categories}
              members={workspace.members}
            />
          </GlassPanel>
          <div className="grid gap-3">
            {summaries.map(({ card, current, payable }) => {
              const usedCents = (current?.totalCents ?? 0) + (payable?.totalCents ?? 0);
              const utilization = cardUtilization(usedCents, card.credit_limit_cents ?? null);
              return (
              <Link key={card.id} href={`/cartoes/${card.id}`}>
                <GlassPanel className="p-4 transition hover:bg-white/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{card.name}</p>
                      <p className="text-xs text-slate-500">
                        fecha dia {card.closing_day} · vence dia {card.due_day}
                        {utilization === null
                          ? ""
                          : ` · ${Math.round(utilization * 100)}% do limite`}
                      </p>
                    </div>
                    {current ? (
                      <Chip>{statementStatusLabel(current.displayStatus)}</Chip>
                    ) : (
                      <Chip>sem fatura</Chip>
                    )}
                  </div>
                  {current ? (
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-xs text-slate-500">
                        Aberta · vence {formatDay(current.due_on)}
                      </p>
                      <Amount cents={current.totalCents} className="text-xl" />
                    </div>
                  ) : null}
                  {payable ? (
                    <div className="mt-2 flex items-end justify-between border-t border-white/70 pt-2">
                      <p className="text-xs text-rose-600">
                        Fechada · vence {formatDay(payable.due_on)}
                      </p>
                      <Amount cents={payable.totalCents} className="text-lg" />
                    </div>
                  ) : null}
                </GlassPanel>
              </Link>
              );
            })}
            {upcoming.length > 0 ? (
              <GlassPanel className="p-4">
                <p className="mb-2 text-sm font-bold text-slate-700">Próximas faturas</p>
                <ul className="grid gap-1 text-sm text-slate-600">
                  {upcoming.map((statement) => {
                    const card = workspace.creditCards.find(
                      (item) => item.id === statement.credit_card_id,
                    );
                    return (
                      <li key={statement.id} className="flex justify-between gap-3">
                        <span>
                          {card?.name} · {formatDay(statement.due_on)} ·{" "}
                          {statementStatusLabel(statement.displayStatus)}
                        </span>
                        <Amount cents={statement.totalCents} />
                      </li>
                    );
                  })}
                </ul>
              </GlassPanel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
