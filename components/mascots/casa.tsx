"use client";

import { motion } from "framer-motion";
import type { Mood } from "@/lib/types";

export function CasaMascot({
  mood = "ok",
  size = 140,
}: {
  mood?: Mood;
  size?: number;
}) {
  const relaxed = mood === "good";
  return (
    <motion.svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      aria-hidden
      animate={{ y: relaxed ? [0, -4, 0] : [0, 2, 0] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <ellipse cx="70" cy="128" rx="34" ry="7" fill="rgba(15,118,110,0.16)" />
      <path d="M20 62 L70 18 L120 62 V118 H20 Z" fill="#ccfbf1" />
      <path d="M12 64 L70 12 L128 64" fill="none" stroke="#0f766e" strokeWidth="8" strokeLinejoin="round" />
      <rect x="58" y="82" width="24" height="36" rx="6" fill="#0f766e" />
      <motion.circle
        cx="48"
        cy="72"
        r="9"
        fill="#ecfeff"
        animate={{ scale: relaxed ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.circle
        cx="92"
        cy="72"
        r="9"
        fill="#ecfeff"
        animate={{ scale: relaxed ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
      />
      <circle cx="48" cy="72" r="3.4" fill="#0f172a" />
      <circle cx="92" cy="72" r="3.4" fill="#0f172a" />
      <path
        d={relaxed ? "M58 90c8 8 16 8 24 0" : "M62 94h16"}
        fill="none"
        stroke="#0f172a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M28 44c10-4 16 6 10 14" fill="none" stroke="#5eead4" strokeWidth="4" />
    </motion.svg>
  );
}
