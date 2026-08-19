"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CasaMascot } from "@/components/mascots/casa";
import { FluxMascot } from "@/components/mascots/flux";
import { SementeMascot } from "@/components/mascots/semente";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { Mood } from "@/lib/types";
import { clampPercent } from "@/lib/money/brl";

export function MascotRow({
  mood,
  paidShare,
  goalShare,
}: {
  mood: Mood;
  paidShare: number;
  goalShare: number;
}) {
  const casaMood: Mood = paidShare >= 1 ? "good" : paidShare > 0.4 ? "ok" : "tight";

  return (
    <div className="grid grid-cols-3 gap-3">
      <MascotLink href="/recorrentes" label="Casa" hint="fixas">
        <CasaMascot mood={casaMood} size={110} />
        <motion.div
          className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/70"
          initial={false}
        >
          <motion.div
            className="h-full rounded-full bg-teal-500"
            animate={{ width: `${clampPercent(paidShare) * 100}%` }}
          />
        </motion.div>
      </MascotLink>
      <MascotLink href="/lancamentos" label="Flux" hint="caixa">
        <FluxMascot mood={mood} size={110} />
      </MascotLink>
      <MascotLink href="/objetivos" label="Semente" hint="metas">
        <SementeMascot progress={goalShare} size={110} />
      </MascotLink>
    </div>
  );
}

function MascotLink({
  href,
  label,
  hint,
  children,
}: {
  href: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <GlassPanel className="flex h-full flex-col items-center px-2 pb-4 pt-3 transition hover:-translate-y-1 hover:bg-white/60">
        {children}
        <p className="mt-1 text-sm font-bold text-slate-800">{label}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{hint}</p>
      </GlassPanel>
    </Link>
  );
}
