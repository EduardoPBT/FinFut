"use client";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  deleteCardCharge,
  deleteInstallmentGroup,
  payCardStatement,
  unpayCardStatement,
} from "@/lib/actions/credit-cards";
import { statementStatusLabel } from "@/lib/money/card-cycle";
import { formatDay } from "@/lib/money/competence";
import { defaultPaidOn } from "@/lib/money/bill-payment";
import { formatBRLInput } from "@/lib/money/brl";
import type { CardStatementView, Category } from "@/lib/types";

export function CardStatementPanel({
  statement,
  categories,
  payAccountName,
}: {
  statement: CardStatementView;
  categories: Category[];
  payAccountName: string | null;
}) {
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const remaining = Math.max(0, statement.totalCents - (statement.paid_cents ?? 0));
  const canPay = statement.displayStatus !== "paga" && statement.displayStatus !== "futura" && remaining > 0;
  const payLabel = statement.displayStatus === "aberta" ? "Pagar antecipado" : "Pagar fatura";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
            vence {formatDay(statement.due_on)}
          </p>
          <Amount cents={statement.totalCents} className="text-2xl" />
        </div>
        <Chip active={statement.displayStatus === "paga"}>
          {statementStatusLabel(statement.displayStatus)}
        </Chip>
      </div>
      <p className="text-xs text-slate-500">
        Compras de {formatDay(statement.cycle_start)} até {formatDay(statement.cycle_end)}
        {payAccountName ? ` · paga com ${payAccountName}` : ""}
      </p>
      <ul className="grid gap-2">
        {statement.charges.length === 0 ? (
          <li className="rounded-2xl bg-white/50 px-3 py-3 text-sm text-slate-500">
            Nenhum lançamento nesta fatura.
          </li>
        ) : (
          statement.charges.map((charge) => (
            <li key={charge.id} className="flex items-center gap-3 rounded-2xl bg-white/55 px-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-800">
                  {categoryById.get(charge.category_id ?? "")?.name ?? "Compra"}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDay(charge.occurred_on)}
                  {charge.installment_total > 1
                    ? ` · ${charge.installment_number}/${charge.installment_total}`
                    : ""}
                  {charge.notes ? ` · ${charge.notes}` : ""}
                </span>
              </span>
              <Amount cents={charge.amount_cents} />
              <div className="flex flex-col items-end gap-1">
                <form action={deleteCardCharge}>
                  <input type="hidden" name="id" value={charge.id} />
                  <button className="text-xs text-slate-400" type="submit">x</button>
                </form>
                {charge.installment_group_id &&
                charge.installment_total > 1 &&
                charge.installment_number === 1 ? (
                  <form action={deleteInstallmentGroup}>
                    <input type="hidden" name="group_id" value={charge.installment_group_id} />
                    <button className="text-[10px] text-slate-400" type="submit">
                      excluir parcelas
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
      {canPay ? (
        <form
          action={payCardStatement as unknown as (formData: FormData) => Promise<void>}
          className="grid gap-2"
        >
          <input type="hidden" name="statement_id" value={statement.id} />
          <input type="hidden" name="paid_on" value={defaultPaidOn()} />
          <p className="text-xs text-amber-700">Pague o total. O mínimo vira juros de rotativo.</p>
          <input
            name="amount"
            defaultValue={formatBRLInput(remaining)}
            className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
          />
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" name="confirm_partial" />
            confirmar pagamento menor que o total
          </label>
          <Button type="submit" className="w-full">
            {payLabel}
          </Button>
        </form>
      ) : null}
      {statement.displayStatus === "paga" ? (
        <form action={unpayCardStatement}>
          <input type="hidden" name="statement_id" value={statement.id} />
          <button type="submit" className="text-xs text-slate-400">
            desfazer pagamento
          </button>
        </form>
      ) : null}
    </div>
  );
}
