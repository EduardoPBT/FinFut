import { todayISO } from "@/lib/money/competence";
import type { BillDisplayStatus, BillStatus } from "@/lib/types";
import { formatDay } from "@/lib/money/competence";
import { paymentMethodLabel } from "@/lib/money/bill-payment";
import type { BillInstanceView } from "@/lib/types";

/** Compara datas ISO (AAAA-MM-DD) no calendário de Brasília. */
export function compareISODate(a: string, b: string) {
  return a.localeCompare(b);
}

export function resolveBillDisplayStatus(
  storedStatus: BillStatus,
  dueOn: string,
  today: string = todayISO(),
): BillDisplayStatus {
  if (storedStatus === "pago") return "pago";
  if (compareISODate(dueOn, today) > 0) return "pendente";
  if (dueOn === today) return "vence_hoje";
  return "atrasado";
}

export function billDueLabel(dueOn: string, today: string = todayISO()) {
  if (dueOn === today) return "vence hoje";
  if (compareISODate(dueOn, today) < 0) return `venceu ${formatDay(dueOn)}`;
  return `vence ${formatDay(dueOn)}`;
}

export function billAmountTone(
  status: BillDisplayStatus,
): "default" | "good" | "tight" | "warn" | "muted" {
  switch (status) {
    case "pago":
      return "muted";
    case "vence_hoje":
      return "warn";
    case "atrasado":
      return "tight";
    default:
      return "default";
  }
}

export function billStatusLabel(status: BillDisplayStatus) {
  switch (status) {
    case "pago":
      return "Paga";
    case "vence_hoje":
      return "Vence hoje";
    case "atrasado":
      return "Atrasada";
    default:
      return "Pendente";
  }
}

export function paymentSummary(instance: BillInstanceView) {
  if (!instance.payment_method) return "";
  const method = paymentMethodLabel(instance.payment_method);
  const account = instance.payment_account?.trim();
  const paidDay = instance.paid_on ? formatDay(instance.paid_on) : "";
  const creditNote =
    instance.payment_method === "credito" ? "na fatura" : "";
  return [method, account, paidDay ? `pago ${paidDay}` : "", creditNote]
    .filter(Boolean)
    .join(" · ")
    .replace(" ·  · ", " · ");
}
