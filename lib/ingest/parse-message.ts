export type ParsedInbound = {
  amountCents: number;
  description: string;
  kindHint: "receita" | "despesa";
  installments: number;
  cardHint: boolean;
};

const MONEY =
  /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?/i;

export function parseMessage(raw: string): ParsedInbound {
  const text = raw.trim();
  if (!text) {
    throw new Error("Mensagem vazia");
  }

  const match = text.match(MONEY);
  if (!match || match.index === undefined) {
    throw new Error("Não achei um valor na mensagem");
  }

  const whole = match[1].replace(/\./g, "");
  const fraction = (match[2] ?? "00").padEnd(2, "0").slice(0, 2);
  const amountCents = Number(whole) * 100 + Number(fraction);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Valor inválido");
  }

  const description =
    `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
      .replace(/[-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "gasto";

  const kindHint = /sal[aá]rio|renda|extra|receb|pix recebido/i.test(text)
    ? "receita"
    : "despesa";
  const installmentsMatch = text.match(/(\d+)\s*x\b/i);
  const installments = Math.min(24, Math.max(1, Number(installmentsMatch?.[1] ?? 1)));
  const cardHint = /visa|mastercard|nubank|cart[aã]o|cr[eé]dito/i.test(text);

  return { amountCents, description, kindHint, installments, cardHint };
}

import type { Category } from "@/lib/types";
import { resolveCategory } from "@/lib/ingest/category-match";

export function matchCategoryName(
  description: string,
  categories: { id: string; name: string }[],
) {
  return resolveCategory(categories as Category[], {
    rawText: description,
    description,
  });
}
