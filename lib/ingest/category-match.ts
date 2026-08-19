import type { Category } from "@/lib/types";

/** Marcas/marketplaces que contêm palavras ambíguas (ex.: "mercado" em Mercado Livre). */
const MARKETPLACE_HINTS: Array<{
  pattern: RegExp;
  label: string;
  categoryName: string;
}> = [
  { pattern: /mercado\s+livre|mercadolivre/i, label: "Mercado Livre", categoryName: "Compras online" },
  { pattern: /mercado\s+pago|mercadopago/i, label: "Mercado Pago", categoryName: "Compras online" },
  { pattern: /\bamazon\b/i, label: "Amazon", categoryName: "Compras online" },
  { pattern: /\bshopee\b/i, label: "Shopee", categoryName: "Compras online" },
  { pattern: /\bshein\b/i, label: "Shein", categoryName: "Compras online" },
  { pattern: /\baliexpress\b/i, label: "AliExpress", categoryName: "Compras online" },
  { pattern: /\bmagalu|magazine\s+luiza\b/i, label: "Magalu", categoryName: "Compras online" },
  { pattern: /\bamericanas\b/i, label: "Americanas", categoryName: "Compras online" },
];

export function normalizeLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const words = label.trim().split(/\s+/).filter(Boolean).slice(0, 3);
  return words.length > 0 ? words.join(" ") : null;
}

function findCategoryByName(categories: Category[], name: string | null | undefined) {
  if (!name) return null;
  const needle = name.toLowerCase().trim();
  return categories.find((item) => item.name.toLowerCase() === needle) ?? null;
}

function hasWholeWord(text: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,.-])${escaped}(?:$|[\\s,.-])`, "i").test(text);
}

function matchByWholeWords(text: string, categories: Category[]) {
  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length);
  for (const category of sorted) {
    if (hasWholeWord(text, category.name.toLowerCase())) return category;
  }
  return null;
}

function detectMarketplace(text: string) {
  return MARKETPLACE_HINTS.find((item) => item.pattern.test(text)) ?? null;
}

export function resolveCategory(
  categories: Category[],
  hints: {
    categoryName?: string | null;
    label?: string | null;
    rawText?: string;
    description?: string;
  },
): Category | null {
  const text = `${hints.rawText ?? ""} ${hints.description ?? ""} ${hints.label ?? ""}`.trim();

  const marketplace = detectMarketplace(text);
  if (marketplace) {
    return (
      findCategoryByName(categories, marketplace.categoryName) ??
      findCategoryByName(categories, "Outros")
    );
  }

  const fromAi = findCategoryByName(categories, hints.categoryName);
  if (fromAi) return fromAi;

  return matchByWholeWords(text, categories);
}

export function inferLabelAndCategory(
  raw: string,
  categories: Category[],
): { label: string | null; categoryName: string | null } {
  const marketplace = detectMarketplace(raw);
  if (marketplace) {
    return { label: marketplace.label, categoryName: marketplace.categoryName };
  }

  const matched = matchByWholeWords(raw, categories);
  if (matched) {
    return { label: null, categoryName: matched.name };
  }

  return { label: null, categoryName: null };
}

/** @deprecated Prefer resolveCategory — mantido para testes legados. */
export function matchCategoryByName(name: string | null, categories: Category[]) {
  if (!name) return null;
  return resolveCategory(categories, { categoryName: name, rawText: name });
}
