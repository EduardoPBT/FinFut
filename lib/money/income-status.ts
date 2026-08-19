import { todayISO, formatDay } from "@/lib/money/competence";
import type { IncomeDisplayStatus, IncomeInstanceStatus } from "@/lib/types";

export function resolveIncomeDisplayStatus(
  stored: IncomeInstanceStatus,
  expectedOn: string,
  today: string = todayISO(),
): IncomeDisplayStatus {
  if (stored === "recebido") return "recebido";
  if (expectedOn > today) return "pendente";
  if (expectedOn === today) return "vence_hoje";
  return "atrasado";
}

export function incomeDueLabel(expectedOn: string, today: string = todayISO()) {
  if (expectedOn === today) return "previsto para hoje";
  if (expectedOn < today) return `previsto ${formatDay(expectedOn)}`;
  return `entra ${formatDay(expectedOn)}`;
}

export function incomeReceivedLabel(receivedOn: string) {
  return `recebido ${formatDay(receivedOn)}`;
}

export function incomeAmountTone(
  status: IncomeDisplayStatus,
): "default" | "good" | "income" | "tight" | "warn" | "muted" {
  switch (status) {
    case "recebido":
      return "income";
    case "vence_hoje":
      return "warn";
    case "atrasado":
      return "warn";
    default:
      return "default";
  }
}

export function incomeStatusLabel(status: IncomeDisplayStatus) {
  switch (status) {
    case "recebido":
      return "Recebida";
    case "vence_hoje":
      return "Hoje";
    case "atrasado":
      return "Aguardando";
    default:
      return "Pendente";
  }
}
