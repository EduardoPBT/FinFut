"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDay, maskDateBR, parseDateBR } from "@/lib/money/competence";

type DateFieldProps = {
  name: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onValueChange?: (isoDate: string) => void;
  className?: string;
};

export function DateField({
  name,
  value,
  defaultValue = "",
  required,
  onValueChange,
  className,
}: DateFieldProps) {
  const isoValue = value ?? defaultValue;
  const [iso, setIso] = useState(isoValue);
  const [text, setText] = useState(isoValue ? formatDay(isoValue) : "");

  useEffect(() => {
    if (value === undefined) return;
    setIso(value);
    setText(value ? formatDay(value) : "");
  }, [value]);

  function commitIso(next: string) {
    setIso(next);
    setText(next ? formatDay(next) : "");
    onValueChange?.(next);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={iso} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="18/08/2026"
        value={text}
        required={required}
        onChange={(event) => {
          const masked = maskDateBR(event.target.value);
          setText(masked);
          const parsed = parseDateBR(masked);
          if (!parsed) return;
          setIso(parsed);
          onValueChange?.(parsed);
        }}
        onBlur={() => {
          if (!text.trim()) {
            if (required) {
              setText(iso ? formatDay(iso) : "");
              return;
            }
            commitIso("");
            return;
          }
          const parsed = parseDateBR(text);
          if (parsed) {
            commitIso(parsed);
            return;
          }
          setText(iso ? formatDay(iso) : "");
        }}
        className={cn(
          "w-full rounded-2xl bg-white/80 py-3 pl-4 pr-11 outline-none",
          className,
        )}
      />
      <input
        type="date"
        tabIndex={-1}
        value={iso || ""}
        onChange={(event) => commitIso(event.target.value)}
        className="absolute inset-y-2 right-2 w-8 cursor-pointer opacity-0"
        aria-label="Abrir calendário"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-slate-400"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
          <path d="M3.5 8h13M7 3v3M13 3v3" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}
