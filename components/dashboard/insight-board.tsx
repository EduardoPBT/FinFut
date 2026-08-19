"use client";

import { motion } from "framer-motion";
import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import { FluxMascot } from "@/components/mascots/flux";
import type { CoupleInsights } from "@/lib/insights/compute";
import { clampPercent } from "@/lib/money/brl";

export function InsightBoard({ insights }: { insights: CoupleInsights }) {
  return (
    <div className="grid gap-4">
      <GlassPanel glow className="flex items-center gap-4 p-5">
        <FluxMascot mood={insights.mood} size={130} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
            olhar do casal
          </p>
          <div className="mt-3 grid gap-2">
            {insights.headlines.map((line) => (
              <p key={line} className="text-lg font-semibold leading-snug text-slate-700">
                {line}
              </p>
            ))}
          </div>
        </div>
      </GlassPanel>
      <div className="grid gap-3 md:grid-cols-2">
        <ShareOrb
          label="Fixas na renda"
          value={insights.fixedShare}
          color="#0f766e"
        />
        <ShareOrb
          label="Variáveis na renda"
          value={insights.variableShare}
          color="#38bdf8"
        />
      </div>
      {insights.leak ? (
        <GlassPanel className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            vazamento
          </p>
          <p className="mt-2 text-2xl font-black text-slate-800">{insights.leak.name}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/80">
            <motion.div
              className="h-full rounded-full bg-sky-400"
              initial={{ width: 0 }}
              animate={{ width: `${insights.leak.share * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            <Amount cents={insights.leak.cents} /> neste envelope
          </p>
        </GlassPanel>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <SuggestCard label="para objetivos" cents={insights.suggestedReserveCents} />
        <SuggestCard label="para aportar" cents={insights.suggestedInvestCents} />
      </div>
    </div>
  );
}

function ShareOrb({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const percent = Math.round(clampPercent(value) * 100);
  return (
    <GlassPanel className="grid place-items-center p-6">
      <motion.div
        className="grid h-28 w-28 place-items-center rounded-full text-white shadow-lg"
        style={{ background: color }}
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <span className="text-3xl font-black">{percent}%</span>
      </motion.div>
      <p className="mt-3 text-sm font-semibold text-slate-600">{label}</p>
    </GlassPanel>
  );
}

function SuggestCard({ label, cents }: { label: string; cents: number }) {
  return (
    <GlassPanel className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
        este mês dá
      </p>
      <Amount cents={cents} className="mt-2 block text-3xl" tone="good" />
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </GlassPanel>
  );
}
