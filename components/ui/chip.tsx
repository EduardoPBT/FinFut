import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
};

export function Chip({ children, active, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        active
          ? "bg-teal-600 text-white"
          : "bg-white/55 text-slate-600 ring-1 ring-white/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
