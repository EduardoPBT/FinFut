import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import { formatDay } from "@/lib/money/competence";
import type { CashflowProjection } from "@/lib/money/cashflow";

export function CashflowPanel({
  startBalanceCents,
  scheduledInCents,
  scheduledOutCents,
  projection,
  committedCents,
  emergencyMonthsValue,
}: {
  startBalanceCents: number;
  scheduledInCents: number;
  scheduledOutCents: number;
  projection: CashflowProjection;
  committedCents: number;
  emergencyMonthsValue: number;
}) {
  const squeeze = projection.days.filter((day) => day.events.length > 0).slice(0, 5);

  return (
    <GlassPanel className="p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
        projeção · próximos 45 dias
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Saldo real nas contas + entradas e saídas ainda não liquidadas
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">saldo em conta agora</p>
          <Amount cents={startBalanceCents} className="text-2xl" />
        </div>
        <div className="text-right">
          {projection.firstNegativeOn ? (
            <p className="text-sm font-semibold text-rose-600">
              Vermelho em {formatDay(projection.firstNegativeOn)}
            </p>
          ) : (
            <p className="text-sm font-semibold text-teal-700">Caixa passa o horizonte</p>
          )}
          <p className="text-xs text-slate-500">
            {projection.runwayDays} dias de fôlego · reserva {emergencyMonthsValue} mês(es)
          </p>
        </div>
      </div>
      {(scheduledInCents > 0 || scheduledOutCents > 0) && (
        <p className="mt-2 text-[11px] text-slate-400">
          {scheduledInCents > 0 ? (
            <>
              +{" "}
              <Amount cents={scheduledInCents} tone="income" className="text-[11px] font-normal" />{" "}
              a receber no período
            </>
          ) : null}
          {scheduledInCents > 0 && scheduledOutCents > 0 ? " · " : null}
          {scheduledOutCents > 0 ? (
            <>
              −{" "}
              <Amount cents={scheduledOutCents} tone="tight" className="text-[11px] font-normal" />{" "}
              a pagar no período
            </>
          ) : null}
        </p>
      )}
      {projection.nextOutflow ? (
        <p className="mt-2 text-xs text-slate-500">
          Próxima saída: {projection.nextOutflow.label} em{" "}
          {formatDay(projection.nextOutflow.date)} ·{" "}
          <Amount cents={Math.abs(projection.nextOutflow.cents)} />
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Cartão já comprometido (aberta + parcelas): <Amount cents={committedCents} />
      </p>
      {squeeze.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm text-slate-600">
          {squeeze.map((day) => (
            <li key={day.date} className="flex justify-between gap-2">
              <span>
                {formatDay(day.date)} · {day.events.map((item) => item.label).join(", ")}
              </span>
              <Amount
                cents={day.projectedCents}
                tone={day.projectedCents < 0 ? "tight" : "muted"}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </GlassPanel>
  );
}
