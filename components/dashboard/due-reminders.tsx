import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import { addCalendarDays } from "@/lib/money/card-cycle";
import { formatDay, todayISO } from "@/lib/money/competence";
import type { BillInstanceView, CardStatementView } from "@/lib/types";

export function DueReminders({
  bills,
  statements,
  reminderDays,
  billNames,
  cardNames,
}: {
  bills: BillInstanceView[];
  statements: CardStatementView[];
  reminderDays: number;
  billNames: Map<string, string>;
  cardNames: Map<string, string>;
}) {
  const today = todayISO();
  const until = addCalendarDays(today, reminderDays);
  const dueBills = bills.filter(
    (item) => item.status !== "pago" && item.due_on >= today && item.due_on <= until,
  );
  const dueCards = statements.filter(
    (item) =>
      item.displayStatus !== "paga" &&
      item.totalCents > 0 &&
      item.due_on >= today &&
      item.due_on <= until,
  );

  if (dueBills.length === 0 && dueCards.length === 0) return null;

  return (
    <GlassPanel className="p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
        vencem em {reminderDays} dias
      </p>
      <ul className="grid gap-1 text-sm text-slate-600">
        {dueBills.map((item) => (
          <li key={item.id} className="flex justify-between">
            <span>
              {billNames.get(item.recurring_bill_id) ?? "Conta"} · {formatDay(item.due_on)}
            </span>
            <Amount cents={item.amount_cents} />
          </li>
        ))}
        {dueCards.map((item) => (
          <li key={item.id} className="flex justify-between">
            <span>
              {cardNames.get(item.credit_card_id) ?? "Fatura"} · {formatDay(item.due_on)}
            </span>
            <Amount cents={item.totalCents} />
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
