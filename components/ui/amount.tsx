import { formatBRL } from "@/lib/money/brl";
import { cn } from "@/lib/cn";

type Props = {
  cents: number;
  className?: string;
  tone?: "default" | "good" | "income" | "tight" | "warn" | "muted";
};

export function Amount({ cents, className, tone = "default" }: Props) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums tracking-tight",
        tone === "good" && "text-teal-700",
        tone === "income" && "text-emerald-600",
        tone === "tight" && "text-rose-600",
        tone === "warn" && "text-amber-600",
        tone === "muted" && "text-slate-500",
        className,
      )}
    >
      {formatBRL(cents)}
    </span>
  );
}
