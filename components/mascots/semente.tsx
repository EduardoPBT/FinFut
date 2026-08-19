"use client";

import { motion } from "framer-motion";

export function SementeMascot({
  progress = 0,
  size = 140,
}: {
  progress?: number;
  size?: number;
}) {
  const grow = 0.55 + Math.min(1, Math.max(0, progress)) * 0.55;
  return (
    <motion.svg viewBox="0 0 140 150" width={size} height={size} aria-hidden>
      <ellipse cx="70" cy="136" rx="32" ry="6" fill="rgba(14,116,144,0.16)" />
      <path d="M38 108h64l-8 24H46Z" fill="#0f766e" />
      <path d="M44 108h52v-10c0-8-10-14-26-14s-26 6-26 14Z" fill="#5eead4" />
      <motion.g
        style={{ originX: "70px", originY: "98px" }}
        animate={{ scale: grow }}
        transition={{ type: "spring", stiffness: 80, damping: 14 }}
      >
        <path d="M70 98 V42" stroke="#0d9488" strokeWidth="6" strokeLinecap="round" />
        <path d="M70 70 C48 62 40 44 52 30 C70 46 70 60 70 70Z" fill="#5eead4" />
        <path d="M70 62 C90 52 104 40 96 24 C78 36 74 52 70 62Z" fill="#67e8f9" />
        <circle cx="70" cy="40" r="5" fill="#fef9c3" />
      </motion.g>
      <circle cx="56" cy="112" r="3" fill="#ecfeff" />
      <circle cx="84" cy="112" r="3" fill="#ecfeff" />
      <path d="M60 122h20" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" />
    </motion.svg>
  );
}
