"use client";

import { motion } from "framer-motion";
import type { Mood } from "@/lib/types";

const faces: Record<Mood, { eye: string; mouth: string }> = {
  good: { eye: "M18 28c3 4 9 4 12 0", mouth: "M34 46c6 8 18 8 24 0" },
  ok: { eye: "M18 30h12", mouth: "M36 50h20" },
  tight: { eye: "M20 32c2-4 8-4 10 0", mouth: "M38 54c6-7 16-7 22 0" },
  empty: { eye: "M20 30h10", mouth: "M40 50c4 2 12 2 16 0" },
};

export function FluxMascot({ mood = "ok", size = 140 }: { mood?: Mood; size?: number }) {
  const face = faces[mood];
  return (
    <motion.svg
      viewBox="0 0 120 140"
      width={size}
      height={size}
      aria-hidden
      animate={{ y: mood === "tight" ? [0, 3, 0] : [0, -8, 0], rotate: mood === "good" ? [-2, 2, -2] : 0 }}
      transition={{ duration: mood === "tight" ? 1.4 : 3.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <defs>
        <linearGradient id="fluxBody" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <motion.ellipse
        cx="60"
        cy="128"
        rx="28"
        ry="6"
        fill="rgba(14,116,144,0.18)"
        animate={{ scaleX: [1, 1.12, 1] }}
        transition={{ duration: 3.4, repeat: Infinity }}
      />
      <path
        d="M60 12c28 0 46 26 46 52 0 30-18 58-46 70C32 122 14 94 14 64 14 38 32 12 60 12Z"
        fill="url(#fluxBody)"
      />
      <path d="M42 18c8 14 4 28-8 36 18-4 30-20 26-40Z" fill="rgba(255,255,255,0.35)" />
      <circle cx="44" cy="58" r="7" fill="#0f172a" />
      <circle cx="76" cy="58" r="7" fill="#0f172a" />
      <circle cx="46" cy="56" r="2.2" fill="white" />
      <circle cx="78" cy="56" r="2.2" fill="white" />
      <path d={face.eye} fill="none" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" transform="translate(0 -6)" />
      <path d={face.mouth} fill="none" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="88" cy="72" r="6" fill="#fb7185" opacity="0.7" />
    </motion.svg>
  );
}
