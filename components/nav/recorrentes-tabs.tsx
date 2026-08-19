"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export function RecorrentesTabs({ yearMonth }: { yearMonth: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const aba = searchParams.get("aba") === "receitas" ? "receitas" : "despesas";

  function href(tab: "despesas" | "receitas") {
    const params = new URLSearchParams();
    params.set("mes", yearMonth);
    if (tab === "receitas") params.set("aba", "receitas");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="mb-5 flex gap-2">
      <Link
        href={href("despesas")}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          aba === "despesas"
            ? "bg-teal-600 text-white shadow-md shadow-teal-700/20"
            : "bg-white/55 text-slate-600 hover:bg-white/80",
        )}
      >
        Despesas
      </Link>
      <Link
        href={href("receitas")}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          aba === "receitas"
            ? "bg-sky-600 text-white shadow-md shadow-sky-700/20"
            : "bg-white/55 text-slate-600 hover:bg-white/80",
        )}
      >
        Receitas
      </Link>
    </div>
  );
}
