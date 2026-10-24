import type { Category } from "@/lib/types";

/** Comidas e estabelecimentos alimentícios → categoria macro de orçamento. */
const FOOD_HINTS: Array<{
  pattern: RegExp;
  categoryName: string;
  label?: string;
}> = [
  { pattern: /\bbolo\b/i, categoryName: "Mercado", label: "Bolo" },
  { pattern: /\bbolos\b/i, categoryName: "Mercado", label: "Bolo" },
  { pattern: /\bpadaria\b/i, categoryName: "Mercado", label: "Padaria" },
  { pattern: /\bconfeitaria\b/i, categoryName: "Mercado", label: "Confeitaria" },
  { pattern: /\bdoceria\b/i, categoryName: "Mercado", label: "Doceria" },
  { pattern: /\bp[aã]o\b/i, categoryName: "Mercado", label: "Pão" },
  { pattern: /\bpaes\b|\bpães\b/i, categoryName: "Mercado", label: "Pão" },
  { pattern: /\bfeira\b/i, categoryName: "Mercado", label: "Feira" },
  { pattern: /\bhortifruti\b/i, categoryName: "Mercado", label: "Hortifruti" },
  { pattern: /\bsupermercado\b/i, categoryName: "Mercado", label: "Supermercado" },
  { pattern: /\bifood\b/i, categoryName: "Delivery", label: "iFood" },
  { pattern: /\brappi\b/i, categoryName: "Delivery", label: "Rappi" },
  { pattern: /\bdelivery\b/i, categoryName: "Delivery" },
];

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

/** Estabelecimentos comuns em OFX/planilha → categoria macro. */
const MERCHANT_HINTS: Array<{
  pattern: RegExp;
  label: string;
  categoryName: string;
}> = [
  { pattern: /\buber\s*eats\b/i, label: "Uber Eats", categoryName: "Delivery" },
  { pattern: /\buber\b/i, label: "Uber", categoryName: "Transporte" },
  { pattern: /\b99\s*(app|pop|pay|food|ride)\b|\bindrive\b|\bcabify\b/i, label: "Corrida", categoryName: "Transporte" },
  { pattern: /\bnetflix\b/i, label: "Netflix", categoryName: "Streaming" },
  { pattern: /\bspotify\b/i, label: "Spotify", categoryName: "Streaming" },
  { pattern: /\bdisney\+?|\bhbo\b|\bprime\s*video\b|\bgloboplay\b|\byoutube\s*premium\b/i, label: "Streaming", categoryName: "Streaming" },
  { pattern: /\bdrogasil\b|\bdrogaraia\b|\bpague\s*menos\b|\bultrafarma\b|\bfarm[aá]cia\b/i, label: "Farmácia", categoryName: "Farmácia" },
  { pattern: /\bsmart\s*fit\b|\bbluefit\b|\bgympass\b|\bselfit\b|\bacademia\b/i, label: "Academia", categoryName: "Academia" },
  { pattern: /\bunimed\b|\bamil\b|\bsulam[eé]rica\b/i, label: "Plano de saúde", categoryName: "Saúde" },
  { pattern: /\benel\b|\bcpfl\b|\blight\b|\bcemig\b|\bcopel\b/i, label: "Energia", categoryName: "Energia" },
  { pattern: /\bsabesp\b|\bcedae\b|\bcagece\b/i, label: "Água", categoryName: "Água" },
  { pattern: /\bvivo\b|\bclaro\b|\btim\b|\bvirtua\b/i, label: "Telefone", categoryName: "Celular" },
  { pattern: /\baluguel\b|\bcondom[ií]nio\b/i, label: "Moradia", categoryName: "Moradia" },
  { pattern: /\bcinemark\b|\buci\b|\bcinema\b/i, label: "Cinema", categoryName: "Lazer" },
  { pattern: /\brenner\b|\briachuelo\b|\bzara\b|\bc&a\b/i, label: "Roupa", categoryName: "Vestuário" },
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

function detectFoodHint(text: string) {
  return FOOD_HINTS.find((item) => item.pattern.test(text)) ?? null;
}

function detectMerchant(text: string) {
  return MERCHANT_HINTS.find((item) => item.pattern.test(text)) ?? null;
}

/** Extrai o alvo do gasto após "no/na/em" (ex.: "gastei 35 reais no bolo" → "Bolo"). */
export function extractExpenseTarget(raw: string): string | null {
  const match = raw.match(
    /\b(?:no|na|em|de)\s+([a-záàâãéêíóôõúç0-9][\wáàâãéêíóôõúç-]{0,30}?)(?:\s+(?:no|na|em|por|via|com|parcelado|pix|reais|real|r\$|\d)|$|[,.])/i,
  );
  if (!match?.[1]) return null;
  return normalizeLabel(match[1]);
}

export function inferFoodContext(raw: string): { categoryName: string; label: string | null } | null {
  const food = detectFoodHint(raw);
  if (!food) return null;
  return {
    categoryName: food.categoryName,
    label: food.label ?? extractExpenseTarget(raw),
  };
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

  const food = detectFoodHint(text);
  if (food) {
    const fromFood = findCategoryByName(categories, food.categoryName);
    if (fromFood) return fromFood;
  }

  const merchant = detectMerchant(text);
  if (merchant) {
    const fromMerchant = findCategoryByName(categories, merchant.categoryName);
    if (fromMerchant) return fromMerchant;
  }

  const fromAi = findCategoryByName(categories, hints.categoryName);
  const aiIsOutros = hints.categoryName?.toLowerCase().trim() === "outros";
  if (fromAi && !aiIsOutros) return fromAi;

  const fromWords = matchByWholeWords(text, categories);
  if (fromWords) return fromWords;

  return fromAi;
}

export function inferLabelAndCategory(
  raw: string,
  categories: Category[],
): { label: string | null; categoryName: string | null } {
  const marketplace = detectMarketplace(raw);
  if (marketplace) {
    return { label: marketplace.label, categoryName: marketplace.categoryName };
  }

  const food = inferFoodContext(raw);
  if (food) {
    return { label: food.label, categoryName: food.categoryName };
  }

  const merchant = detectMerchant(raw);
  if (merchant) {
    return { label: merchant.label, categoryName: merchant.categoryName };
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
