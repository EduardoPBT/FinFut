"use client";

import { motion } from "framer-motion";
import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import { FluxMascot } from "@/components/mascots/flux";
import type { FixedBreakdown } from "@/lib/data/insights";
import type { CoupleInsights } from "@/lib/insights/compute";
import {
  fixedExpenseHint,
  monthBalanceRows,
  monthBalanceRowTone,
  monthBalanceSharePercent,
} from "@/lib/insights/month-balance";
import { clampPercent } from "@/lib/money/brl";

type Props = {
  insights: CoupleInsights;
  fixedBreakdown: FixedBreakdown;
  incomeFixedPendingCents: number;
  incomeVariablePendingCents: number;
};

export function MonthBalancePanel({
  insights,
  fixedBreakdown,
  incomeFixedPendingCents,
  incomeVariablePendingCents,
}: Props) {
  const rows = monthBalanceRows(insights);
  const expenseCents = insights.fixedCents + insights.variableCents;
  const toReceiveCents = incomeFixedPendingCents + incomeVariablePendingCents;
  const toPayCents = fixedBreakdown.billsUnpaidCents;

  const barTotal = insights.totalIncomeCents || 1;
  const fixedWidth = clampPercent(insights.fixedCents / barTotal) * 100;
  const variableWidth = clampPercent(insights.variableCents / barTotal) * 100;
  const remainingWidth = clampPercent(Math.max(0, insights.remainingCents) / barTotal) * 100;

  return (
    <GlassPanel glow className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
            balanço do mês
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Receitas fixas e variáveis menos despesas do mês
          </p>
        </div>
        <FluxMascot mood={insights.mood} size={88} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Receitas fixas"
          cents={insights.fixedIncomeCents}
          tone="income"
          hint={incomeFixedHint(insights, incomeFixedPendingCents)}
        />
        <MetricCard
          label="Receitas variáveis"
          cents={insights.variableIncomeCents}
          tone="income"
          hint={incomeVariableHint(insights, incomeVariablePendingCents)}
        />
        <MetricCard
          label="Despesas fixas"
          cents={insights.fixedCents}
          tone="tight"
          hint={fixedExpenseHint(fixedBreakdown)}
        />
        <MetricCard
          label="Despesas variáveis"
          cents={insights.variableCents}
          tone="tight"
          hint={`${monthBalanceSharePercent(insights.variableCents, insights.totalIncomeCents)}% da renda`}
        />
      </div>

      {(toPayCents > 0 || toReceiveCents > 0) && (
        <p className="mt-2 text-[11px] text-slate-400">
          {toPayCents > 0 ? (
            <>
              a pagar{" "}
              <Amount cents={toPayCents} tone="tight" className="text-[11px] font-normal" />
            </>
          ) : null}
          {toPayCents > 0 && toReceiveCents > 0 ? " · " : null}
          {toReceiveCents > 0 ? (
            <>
              a receber{" "}
              <Amount cents={toReceiveCents} tone="income" className="text-[11px] font-normal" />
            </>
          ) : null}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-white/60 bg-white/40 px-4 py-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-slate-600">
            Total receitas{" "}
            <Amount cents={insights.totalIncomeCents} tone="income" className="text-base" />
          </span>
          <span className="text-slate-600">
            Total despesas{" "}
            <Amount cents={expenseCents} tone="tight" className="text-base" />
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-700">
          {insights.remainingCents >= 0 ? "Sobra" : "Falta"}{" "}
          <Amount
            cents={insights.remainingCents}
            tone={insights.remainingCents >= 0 ? "good" : "default"}
            className="text-lg"
          />
        </span>
      </div>

      {insights.totalIncomeCents > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Para onde vai a renda
          </p>
          <div className="flex h-4 overflow-hidden rounded-full bg-white/70 shadow-inner">
            <motion.div
              className="h-full bg-rose-500"
              initial={{ width: 0 }}
              animate={{ width: `${fixedWidth}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              title={`Despesas fixas ${Math.round(fixedWidth)}%`}
            />
            <motion.div
              className="h-full bg-rose-300"
              initial={{ width: 0 }}
              animate={{ width: `${variableWidth}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              title={`Despesas variáveis ${Math.round(variableWidth)}%`}
            />
            {remainingWidth > 0 ? (
              <motion.div
                className="h-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${remainingWidth}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                title={`Sobra ${Math.round(remainingWidth)}%`}
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <LegendDot color="#f43f5e" label={`Desp. fixas ${Math.round(fixedWidth)}%`} />
            <LegendDot color="#fda4af" label={`Desp. variáveis ${Math.round(variableWidth)}%`} />
            {remainingWidth > 0 ? (
              <LegendDot color="#34d399" label={`Sobra ${Math.round(remainingWidth)}%`} />
            ) : (
              <LegendDot color="#94a3b8" label="Sem sobra" />
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-white/70 bg-white/35 p-4">
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{row.label}</span>
              <Amount
                cents={row.kind === "result" ? insights.remainingCents : row.cents}
                tone={monthBalanceRowTone(row, insights.remainingCents)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {fixedBreakdown.otherSpentCents > 0 ? (
          <ParamChip>
            Fixas já lançadas:{" "}
            <Amount cents={fixedBreakdown.otherSpentCents} className="text-xs font-normal" />
          </ParamChip>
        ) : null}
        {insights.leak ? (
          <ParamChip>
            Maior variável: {insights.leak.name} (
            {monthBalanceSharePercent(insights.leak.cents, insights.variableCents)}%)
          </ParamChip>
        ) : null}
      </div>

      {insights.headlines[0] ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{insights.headlines[0]}</p>
      ) : null}
    </GlassPanel>
  );
}

function MetricCard({
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
    <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <Amount cents={cents} className="mt-1 block text-2xl" tone={tone} />
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ParamChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs text-slate-600">
      {children}
    </span>
  );
}

function incomeFixedHint(insights: CoupleInsights, incomeFixedPendingCents: number) {
  const parts: string[] = [];
  if (insights.fixedIncomeCents > 0) {
    parts.push(
      `${monthBalanceSharePercent(insights.fixedIncomeCents, insights.totalIncomeCents)}% da renda`,
    );
  }
  if (incomeFixedPendingCents > 0) {
    parts.push(`${formatPendingAmount(incomeFixedPendingCents)} a receber`);
  }
  if (parts.length === 0) return "Salários e rendas recorrentes";
  return parts.join(" · ");
}

function incomeVariableHint(insights: CoupleInsights, incomeVariablePendingCents: number) {
  const parts: string[] = [];
  if (insights.variableIncomeCents > 0) {
    parts.push(
      `${monthBalanceSharePercent(insights.variableIncomeCents, insights.totalIncomeCents)}% da renda`,
    );
  }
  if (incomeVariablePendingCents > 0) {
    parts.push(`${formatPendingAmount(incomeVariablePendingCents)} a receber`);
  }
  if (parts.length === 0) return "Freelas, bônus e extras";
  return parts.join(" · ");
}

function formatPendingAmount(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
