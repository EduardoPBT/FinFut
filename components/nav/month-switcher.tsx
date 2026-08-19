"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { monthLabel, shiftYearMonth } from "@/lib/money/competence";

export function MonthSwitcher({ yearMonth }: { yearMonth: string }) {
  const router = useRouter();

  function go(delta: number) {
    const next = shiftYearMonth(yearMonth, delta);
    const url = new URL(window.location.href);
    url.searchParams.set("mes", next);
    router.push(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(-1)}
        className="grid h-10 w-10 place-items-center rounded-full bg-white/60 text-lg text-teal-800 shadow-sm"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <Link
        href={`?mes=${yearMonth}`}
        className="min-w-[160px] rounded-full bg-white/55 px-4 py-2 text-center text-sm font-semibold capitalize text-slate-700"
      >
        {monthLabel(yearMonth)}
      </Link>
      <button
        type="button"
        onClick={() => go(1)}
        className="grid h-10 w-10 place-items-center rounded-full bg-white/60 text-lg text-teal-800 shadow-sm"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}
