import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { CardChargeForm } from "@/components/forms/card-charge-form";
import { CardStatementPanel } from "@/components/dashboard/card-statement-panel";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadCreditCardDetail } from "@/lib/data/ledger";
import { formatDay } from "@/lib/money/competence";
import type { CardStatementView, Category } from "@/lib/types";

function StatementBlock({
  title,
  statements,
  categories,
  payAccountName,
}: {
  title: string;
  statements: CardStatementView[];
  categories: Category[];
  payAccountName: string | null;
}) {
  if (statements.length === 0) return null;
  return (
    <div className="grid gap-3">
      {statements.map((statement) => (
        <GlassPanel key={statement.id} className="p-4">
          <p className="mb-3 text-sm font-bold text-slate-700">{title}</p>
          <CardStatementPanel
            statement={statement}
            categories={categories}
            payAccountName={payAccountName}
          />
        </GlassPanel>
      ))}
    </div>
  );
}

export default async function CartaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await loadWorkspace();
  const detail = await loadCreditCardDetail(workspace.household.id, id);
  if (!detail) notFound();

  const payAccount = workspace.bankAccounts.find(
    (item) => item.id === detail.card.payment_account_id,
  );

  return (
    <div>
      <PageHeader eyebrow="Cartão" title={detail.card.name} />
      <p className="mb-4 text-sm text-slate-500">
        Fecha dia {detail.card.closing_day} · vence dia {detail.card.due_day}
        {payAccount ? ` · paga com ${payAccount.name}` : ""}
        {detail.card.credit_limit_cents
          ? ` · limite ${Math.round(((detail.current?.totalCents ?? 0) / detail.card.credit_limit_cents) * 100)}% usado`
          : ""}
      </p>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <GlassPanel className="p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Nova compra</p>
          <CardChargeForm
            card={detail.card}
            cards={workspace.creditCards}
            categories={workspace.categories}
            members={workspace.members}
          />
          <Link href="/cartoes" className="mt-4 block text-center text-xs font-semibold text-teal-700">
            todos os cartões
          </Link>
        </GlassPanel>
        <div className="grid gap-3">
          {detail.current ? (
            <GlassPanel className="p-4">
              <p className="mb-3 text-sm font-bold text-slate-700">Fatura aberta</p>
              <p className="mb-3 text-xs text-slate-500">
                Compras de hoje entram aqui até {formatDay(detail.current.cycle_end)}.
              </p>
              <CardStatementPanel
                statement={detail.current}
                categories={workspace.categories}
                payAccountName={payAccount?.name ?? null}
              />
            </GlassPanel>
          ) : null}
          <StatementBlock
            title="A pagar"
            statements={detail.payable}
            categories={workspace.categories}
            payAccountName={payAccount?.name ?? null}
          />
          <StatementBlock
            title="Próximas parcelas"
            statements={detail.upcoming}
            categories={workspace.categories}
            payAccountName={payAccount?.name ?? null}
          />
          <StatementBlock
            title="Pagas"
            statements={detail.paid}
            categories={workspace.categories}
            payAccountName={payAccount?.name ?? null}
          />
        </div>
      </div>
    </div>
  );
}
