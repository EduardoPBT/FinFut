import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { LedgerSummaryPanel } from "@/components/dashboard/ledger-summary";
import { TransactionForm } from "@/components/forms/transaction-form";
import {
  CardChargeListItem,
  TransactionListItem,
} from "@/components/forms/transaction-edit";
import { deleteTransaction } from "@/lib/actions/transactions";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadMonthData } from "@/lib/data/month";
import {
  isCashOutTransaction,
  isIncomeTransaction,
  isStatementPayment,
  sortLedgerEntries,
  summarizeLedgerMonth,
  transactionLedgerLabel,
} from "@/lib/ledger/month-summary";
import { parseYearMonth, formatDay, todayISO } from "@/lib/money/competence";
import { FluxMascot } from "@/components/mascots/flux";
import { createClient } from "@/lib/supabase/server";

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const competence = parseYearMonth(mes);
  const workspace = await loadWorkspace();
  const month = await loadMonthData(workspace.household.id, competence);
  const categoryById = new Map(workspace.categories.map((item) => [item.id, item]));
  const memberById = new Map(workspace.members.map((item) => [item.id, item]));
  const accountById = new Map(workspace.bankAccounts.map((item) => [item.id, item.name]));

  const statementIds = [
    ...new Set(
      month.transactions
        .map((item) => item.statement_payment_id)
        .filter((item): item is string => Boolean(item)),
    ),
  ];
  const statementCardById = new Map<string, string>();
  if (statementIds.length > 0) {
    const supabase = await createClient();
    const { data: statements } = await supabase
      .from("card_statements")
      .select("id, credit_card_id")
      .in("id", statementIds);
    for (const statement of statements ?? []) {
      const card = workspace.creditCards.find((item) => item.id === statement.credit_card_id);
      if (card) statementCardById.set(statement.id, card.name);
    }
  }

  const summary = summarizeLedgerMonth(month.transactions, month.cardCharges);
  const entries = sortLedgerEntries(month.transactions, month.cardCharges);

  return (
    <div>
      <PageHeader eyebrow="Fluxo" title="Lançamentos" yearMonth={competence.yearMonth} />
      <LedgerSummaryPanel summary={summary} />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <GlassPanel className="p-5">
          <TransactionForm
            categories={workspace.categories}
            members={workspace.members}
            accounts={workspace.bankAccounts}
            cards={workspace.creditCards}
            defaultDate={todayISO()}
          />
        </GlassPanel>
        <GlassPanel className="p-4">
          {entries.length === 0 ? (
            <div className="grid place-items-center py-10 text-center">
              <FluxMascot mood="empty" size={120} />
              <p className="mt-2 font-semibold text-slate-600">
                O rio ainda está quieto neste mês.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {entries.map((entry) => {
                if (entry.kind === "card_charge") {
                  const item = entry.charge;
                  const category = categoryById.get(item.category_id ?? "");
                  const card = workspace.creditCards.find(
                    (cardItem) => cardItem.id === item.credit_card_id,
                  );
                  const meta = [
                    formatDay(item.occurred_on),
                    card?.name ?? "cartão",
                    item.installment_total > 1
                      ? `${item.installment_number}/${item.installment_total}`
                      : null,
                    item.notes,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <CardChargeListItem
                      key={`charge-${item.id}`}
                      charge={item}
                      categories={workspace.categories}
                      categoryName={category?.name ?? "Compra no cartão"}
                      categoryColor={category?.color ?? "#67e8f9"}
                      meta={meta}
                    />
                  );
                }

                const item = entry.transaction;
                const category = categoryById.get(item.category_id ?? "");
                const member = memberById.get(item.member_id ?? "");
                const income = isIncomeTransaction(item, category);
                const transfer = item.movement_kind === "transferencia";
                const statementPayment = isStatementPayment(item);
                const cashOut = isCashOutTransaction(item);
                const categoryName = transactionLedgerLabel(
                  item,
                  category,
                  item.statement_payment_id
                    ? statementCardById.get(item.statement_payment_id)
                    : null,
                );
                const accountLabel = item.account_id
                  ? accountById.get(item.account_id)
                  : null;
                const metaExtra = [
                  item.notes && !statementPayment ? ` · ${item.notes}` : "",
                  accountLabel ? ` · ${accountLabel}` : "",
                  transfer && item.destination_account_id ? " · entre contas" : "",
                  transfer && item.goal_id ? " · aporte" : "",
                  statementPayment ? " · saiu da conta" : "",
                ].join("");

                return (
                  <TransactionListItem
                    key={`tx-${item.id}`}
                    transaction={item}
                    categories={workspace.categories}
                    categoryName={categoryName}
                    categoryColor={
                      statementPayment
                        ? "#fda4af"
                        : transfer
                          ? "#99f6e4"
                          : category?.color ?? "#67e8f9"
                    }
                    memberLabel={`${formatDay(item.occurred_on)} · ${member?.display_name ?? "casal"}`}
                    metaExtra={metaExtra}
                    income={income}
                    transfer={transfer && !statementPayment}
                    cashOut={cashOut}
                    deleteAction={deleteTransaction}
                  />
                );
              })}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
