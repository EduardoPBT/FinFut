import { Chip } from "@/components/ui/chip";
import type { BillDisplayStatus } from "@/lib/types";
import { billStatusLabel } from "@/lib/money/bill-status";
import { cn } from "@/lib/cn";

export function BillStatusChip({ status }: { status: BillDisplayStatus }) {
  return (
    <Chip
      active={status === "pago"}
      className={cn(
        status === "atrasado" && "bg-rose-100 text-rose-700 ring-rose-200",
        status === "vence_hoje" && "bg-amber-100 text-amber-800 ring-amber-200",
        status === "pendente" && "bg-sky-50 text-sky-800 ring-sky-100",
        status === "pago" && "bg-teal-600 text-white",
      )}
    >
      {billStatusLabel(status)}
    </Chip>
  );
}
