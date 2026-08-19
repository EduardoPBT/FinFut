import { cn } from "@/lib/cn";

type Props = {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
};

export function GlassPanel({ children, className, glow = false }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/60 bg-white/45 shadow-[0_18px_50px_-28px_rgba(14,116,144,0.55)] backdrop-blur-xl",
        glow && "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_58%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
