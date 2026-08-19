"use client";

import { motion } from "framer-motion";
import { formatCompactBRL } from "@/lib/money/brl";

type Slice = { label: string; cents: number; color: string };

export function MonthRing({
  slices,
  remainingCents,
}: {
  slices: Slice[];
  remainingCents: number;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.cents, 0) || 1;
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative grid place-items-center">
      <svg viewBox="0 0 140 140" className="h-48 w-48 -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="14" />
        {slices.map((slice) => {
          const length = (slice.cents / total) * circ;
          const dash = `${length} ${circ - length}`;
          const current = offset;
          offset += length;
          return (
            <motion.circle
              key={slice.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={-current}
              initial={{ strokeDasharray: `0 ${circ}` }}
              animate={{ strokeDasharray: dash }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      <div className="absolute text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          sobra
        </p>
        <p className="text-xl font-bold text-slate-800">
          {formatCompactBRL(remainingCents)}
        </p>
      </div>
    </div>
  );
}
