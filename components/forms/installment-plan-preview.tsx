import { formatBRL } from "@/lib/money/brl";
import {
  INSTALLMENT_PRESETS,
  installmentCycles,
  splitInstallmentAmounts,
} from "@/lib/money/card-cycle";
import { formatDay } from "@/lib/money/competence";
import type { CreditCard } from "@/lib/types";

export const INSTALLMENT_OPTIONS = INSTALLMENT_PRESETS.map((value) => ({
  value: String(value),
  label: value === 1 ? "À vista" : `${value}x`,
}));

export function InstallmentPlanPreview({
  card,
  purchaseDate,
  amountCents,
  installments,
}: {
  card: CreditCard | undefined;
  purchaseDate: string;
  amountCents: number;
  installments: number;
}) {
  if (!card || !purchaseDate) return null;

  const count = Math.max(1, installments);
  const cycles = installmentCycles(purchaseDate, card.closing_day, card.due_day, count);
  const first = cycles[0];
  const last = cycles[cycles.length - 1];
  if (!first || !last) return null;

  const amounts = splitInstallmentAmounts(Math.max(0, amountCents), count);
  const firstAmount = amounts[0];
  const lastAmount = amounts[amounts.length - 1];
  const amountLabel =
    amountCents <= 0
      ? null
      : count === 1
        ? formatBRL(amountCents)
        : firstAmount === lastAmount
          ? `${count}x de ${formatBRL(firstAmount)}`
          : `${count}x de ${formatBRL(firstAmount)} · última ${formatBRL(lastAmount)}`;

  return (
    <div className="rounded-2xl bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
      <p className="font-semibold">
        {amountLabel ?? (count === 1 ? "À vista" : `${count}x`)}
      </p>
      <p>
        {count === 1
          ? `1ª fatura ${formatDay(first.dueOn)}`
          : `${formatDay(first.dueOn)} → ${formatDay(last.dueOn)}`}
      </p>
    </div>
  );
}
