import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { LedgerSummary } from "@/lib/ledger/month-summary";

export function LedgerSummaryPanel({ summary }: { summary: LedgerSummary }) {
  if (summary.entryCount === 0) return null;

  return (
    <GlassPanel className="mb-4 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
        resultado parcial do mês
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCell label="Entradas" cents={summary.incomeCents} tone="income" />
        <SummaryCell label="Saídas na conta" cents={summary.cashOutCents} tone="tight" />
        <SummaryCell
          label="Cartão (competência)"
          cents={summary.cardSpendCents}
          hint={
            summary.statementPayCents > 0
              ? `Fatura paga: ${formatHint(summary.statementPayCents)}`
              : "Compras na fatura do mês"
          }
        />
        <SummaryCell
          label="Parcial em caixa"
          cents={summary.partialCents}
          tone={summary.partialCents >= 0 ? "good" : "default"}
          hint="Entradas − saídas na conta"
        />
      </div>
    </GlassPanel>
  );
}

function SummaryCell({
  label,
  cents,
  tone = "default",
  hint,
}: {
  label: string;
  cents: number;
  tone?: "default" | "income" | "tight" | "good";
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/40 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <Amount cents={cents} className="mt-1 block text-xl" tone={tone} />
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function formatHint(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
