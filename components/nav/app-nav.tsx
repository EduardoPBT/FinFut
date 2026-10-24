"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", label: "Casa", icon: "◉" },
  { href: "/lancamentos", label: "Fluxo", icon: "✧" },
  { href: "/recorrentes", label: "Recorrentes", icon: "⌂" },
  { href: "/cartoes", label: "Cartões", icon: "▣" },
  { href: "/objetivos", label: "Metas", icon: "❀" },
  { href: "/analise", label: "Olhar", icon: "◎" },
  { href: "/importacoes", label: "Importar", icon: "⇩" },
  { href: "/entrada", label: "Inbox", icon: "✉" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col border-r border-white/60 bg-white/55 py-5 shadow-[4px_0_24px_-12px_rgba(14,116,144,0.18)] backdrop-blur-xl sm:w-[88px]">
      <Link
        href="/"
        className="mb-6 px-2 text-center text-[10px] font-black tracking-[0.18em] text-teal-800 sm:text-xs"
      >
        FF
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1 px-2">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex w-full flex-col items-center rounded-2xl px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-white/50 sm:text-[11px]",
                active && "text-teal-800",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-teal-100/90"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="relative text-lg leading-none sm:text-xl">{item.icon}</span>
              <span className="relative mt-1 hidden sm:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Link
        href="/configuracoes"
        title="Configurações"
        className={cn(
          "relative mx-2 mt-auto flex flex-col items-center rounded-2xl px-1 py-2.5 text-[10px] font-semibold text-slate-500 transition hover:bg-white/50 sm:text-[11px]",
          pathname.startsWith("/configuracoes") && "text-teal-800",
        )}
      >
        {pathname.startsWith("/configuracoes") ? (
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-0 rounded-2xl bg-teal-100/90"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        ) : null}
        <span className="relative text-lg leading-none sm:text-xl">⚙</span>
        <span className="relative mt-1 hidden sm:block">Ajustes</span>
      </Link>
    </aside>
  );
}
