export type EditRequest =
  | { action: "delete"; amountCents: number | null; query: string }
  | { action: "update"; amountCents: number | null; query: string; categoryName?: string; newAmountCents?: number }
  | { action: "confirm_inbox" }
  | { action: "dismiss_inbox" }
  | { action: "pay_statement" }
  | { action: "pay_bill"; query: string };

function extractAmount(text: string) {
  const match = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?/i);
  if (!match) return null;
  const whole = match[1].replace(/\./g, "");
  const fraction = (match[2] ?? "00").padEnd(2, "0").slice(0, 2);
  const cents = Number(whole) * 100 + Number(fraction);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

export function parseEditRequest(raw: string): EditRequest | null {
  const text = raw.trim();
  if (/confirma\s+inbox|lan[cç]a\s+o\s+pendente/i.test(text)) return { action: "confirm_inbox" };
  if (/descarta(\s+inbox)?/i.test(text)) return { action: "dismiss_inbox" };
  if (/paga\s+fatura/i.test(text)) return { action: "pay_statement" };
  if (/paga\s+conta/i.test(text)) {
    return { action: "pay_bill", query: text.replace(/paga\s+conta/i, "").trim() };
  }

  const amountCents = extractAmount(text);
  if (/\b(apaga|apag[ae]|exclui|delet[ae])\b/i.test(text)) {
    return {
      action: "delete",
      amountCents,
      query: text.replace(/\b(apaga|apag[ae]|exclui|delet[ae]|o lançamento|os|as|de|do|da)\b/gi, " ").trim(),
    };
  }
  if (/\b(muda|altera|troca|corrige)\b/i.test(text)) {
    const toMatch = text.match(/para\s+(.+)$/i);
    const newAmount = toMatch ? extractAmount(toMatch[1]) : null;
    const categoryName = toMatch && !newAmount ? toMatch[1].trim() : undefined;
    return {
      action: "update",
      amountCents,
      query: text,
      categoryName,
      newAmountCents: newAmount ?? undefined,
    };
  }
  return null;
}
