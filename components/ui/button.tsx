import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98]",
        variant === "primary" &&
          "bg-teal-600 text-white shadow-lg shadow-teal-700/20 hover:bg-teal-500",
        variant === "ghost" && "bg-white/40 text-slate-700 hover:bg-white/70",
        variant === "soft" && "bg-sky-100/80 text-sky-900 hover:bg-sky-100",
        className,
      )}
      {...props}
    />
  );
}
