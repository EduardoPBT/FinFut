import { parseYearMonth, shiftYearMonth, todayISO } from "@/lib/money/competence";
import type { PaymentMethod } from "@/lib/types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "pix", label: "Pix", hint: "Saída imediata da conta" },
  { value: "debito", label: "Débito", hint: "Saída imediata da conta" },
  { value: "credito", label: "Crédito", hint: "Entra na fatura do cartão" },
  { value: "boleto", label: "Boleto", hint: "Saída na data do pagamento" },
  { value: "outro", label: "Outro", hint: "Lançamento na data informada" },
];

export function paymentMethodLabel(method: PaymentMethod | null | undefined) {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label ?? "";
}

/** Data do lançamento conforme forma de pagamento e competência da conta. */
export function bookingDateForPayment(
  method: PaymentMethod,
  paidOn: string,
  competenceStart: string,
) {
  if (method === "credito") {
    const yearMonth = competenceStart.slice(0, 7);
    return `${shiftYearMonth(yearMonth, 1)}-01`;
  }
  return paidOn;
}

export function buildPaymentNotes(
  billName: string,
  method: PaymentMethod,
  account?: string | null,
) {
  const label = paymentMethodLabel(method);
  const parts = [billName, label];
  if (account?.trim()) parts.push(account.trim());
  return parts.join(" · ");
}

export function defaultPaidOn() {
  return todayISO();
}

export function competenceFromInstance(competence: string) {
  return parseYearMonth(competence.slice(0, 7));
}
