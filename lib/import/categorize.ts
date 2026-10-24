import { inferLabelAndCategory, resolveCategory } from "@/lib/ingest/category-match";
import type { PreparedImportLine } from "@/lib/import/types";
import type { Category, MovementKind } from "@/lib/types";

function fallbackCategory(categories: Category[], movementKind: MovementKind) {
  if (movementKind === "receita") {
    return categories.find((item) => item.kind === "receita") ?? null;
  }
  return (
    categories.find((item) => item.name.toLowerCase() === "outros") ??
    categories.find((item) => item.kind !== "receita") ??
    null
  );
}

export function isWeakCategory(name: string | null | undefined) {
  return !name || name.toLowerCase() === "outros";
}

export function suggestCategory(
  description: string,
  categories: Category[],
  movementKind: MovementKind,
) {
  if (movementKind === "transferencia") {
    return { categoryId: null, categoryName: "Transferência", weak: false };
  }
  const inferred = inferLabelAndCategory(description, categories);
  const resolved =
    resolveCategory(categories, {
      categoryName: inferred.categoryName,
      label: inferred.label,
      rawText: description,
    }) ?? fallbackCategory(categories, movementKind);
  return {
    categoryId: resolved?.id ?? null,
    categoryName: resolved?.name ?? inferred.categoryName,
    weak: isWeakCategory(resolved?.name ?? inferred.categoryName),
  };
}

function buildImportPrompt(categories: Category[]) {
  const catalog = categories.map((item) => `- ${item.name} (${item.kind})`).join("\n");
  return (
    "Você classifica linhas de extrato bancário ou fatura de cartão de um casal brasileiro.\n" +
    "Devolva JSON: {\"items\":[{\"description\":\"texto original\",\"category_name\":\"Nome\"}]}\n" +
    "category_name deve ser EXATAMENTE um nome da lista.\n" +
    "Regras:\n" +
    "1. Use o estabelecimento ou o histórico para escolher a categoria macro de orçamento.\n" +
    "2. Mercado Livre, Amazon, Shopee, Magalu, Shein = Compras online — nunca Mercado.\n" +
    "3. Supermercado, padaria, feira, hortifruti = Mercado.\n" +
    "4. iFood, Rappi, Uber Eats = Delivery.\n" +
    "5. Uber, 99, transporte = Transporte.\n" +
    "6. Evite Outros quando outra categoria da lista couber.\n" +
    "7. PIX recebido, salário, transferência recebida = categoria de receita.\n\n" +
    "Categorias disponíveis:\n" +
    catalog
  );
}

async function classifyDescriptionsWithAi(descriptions: string[], categories: Category[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || descriptions.length === 0) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const mapped = new Map<string, string>();

  for (let index = 0; index < descriptions.length; index += 40) {
    const chunk = descriptions.slice(index, index + 40);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildImportPrompt(categories) },
            { role: "user", content: chunk.map((item, order) => `${order + 1}. ${item}`).join("\n") },
          ],
        }),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) continue;
      const parsed = JSON.parse(content) as { items?: Array<{ description?: string; category_name?: string }> };
      for (const item of parsed.items ?? []) {
        const description = String(item.description ?? "").trim();
        const categoryName = String(item.category_name ?? "").trim();
        if (description && categoryName) mapped.set(description.toLowerCase(), categoryName);
      }
    } catch {
      // Mantém a categoria local se a IA falhar neste lote.
    }
  }

  return mapped.size > 0 ? mapped : null;
}

export async function refineImportCategories(
  lines: PreparedImportLine[],
  categories: Category[],
): Promise<PreparedImportLine[]> {
  const weak = lines.filter(
    (line) =>
      line.decision === "import" &&
      line.movementKind !== "transferencia" &&
      isWeakCategory(line.categoryName),
  );
  const unique = [...new Set(weak.map((line) => line.description))];
  const mapped = await classifyDescriptionsWithAi(unique, categories);
  if (!mapped) return lines;

  return lines.map((line) => {
    if (line.decision !== "import" || line.movementKind === "transferencia") return line;
    if (!isWeakCategory(line.categoryName)) return line;
    const categoryName = mapped.get(line.description.toLowerCase());
    if (!categoryName) return line;
    const resolved = resolveCategory(categories, {
      categoryName,
      rawText: line.description,
    });
    if (!resolved) return line;
    return {
      ...line,
      categoryId: resolved.id,
      categoryName: resolved.name,
    };
  });
}
