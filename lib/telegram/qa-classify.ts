import { todayISO } from "@/lib/money/competence";

export type QaIntent =
  | "month_summary"
  | "spending_by_category"
  | "card_statement"
  | "pending_bills"
  | "budget_status"
  | "compare_periods"
  | "inbox_count"
  | "unknown";

export type QaClassification = {
  intent: QaIntent;
  category: string | null;
  period: "current_month" | "previous_month";
  confidence: number;
};

const INTENTS = new Set<QaIntent>([
  "month_summary",
  "spending_by_category",
  "card_statement",
  "pending_bills",
  "budget_status",
  "compare_periods",
  "inbox_count",
  "unknown",
]);

export function parseQaClassification(payload: Record<string, unknown>): QaClassification {
  const intentRaw = String(payload.intent ?? "unknown");
  const intent = INTENTS.has(intentRaw as QaIntent) ? (intentRaw as QaIntent) : "unknown";
  return {
    intent,
    category: payload.category ? String(payload.category) : null,
    period: payload.period === "previous_month" ? "previous_month" : "current_month",
    confidence: Math.min(1, Math.max(0, Number(payload.confidence ?? 0))),
  };
}

export function heuristicQa(text: string): QaClassification | null {
  const raw = text.toLowerCase();
  if (/inbox|pendente para revisar/.test(raw)) {
    return { intent: "inbox_count", category: null, period: "current_month", confidence: 0.85 };
  }
  if (/fatura|cart[aã]o/.test(raw)) {
    return { intent: "card_statement", category: null, period: "current_month", confidence: 0.85 };
  }
  if (/conta(s)?\s+(a\s+)?pag|pendente/.test(raw)) {
    return { intent: "pending_bills", category: null, period: "current_month", confidence: 0.8 };
  }
  if (/or[cç]amento|envelope/.test(raw)) {
    return { intent: "budget_status", category: null, period: "current_month", confidence: 0.8 };
  }
  if (/m[eê]s passado|compar/.test(raw)) {
    return { intent: "compare_periods", category: null, period: "current_month", confidence: 0.8 };
  }
  const categoryMatch = raw.match(/gastei\s+(?:em|no|na)\s+([a-záéíóúãõç\s]+)/i);
  if (categoryMatch) {
    return {
      intent: "spending_by_category",
      category: categoryMatch[1].replace(/\?$/, "").trim(),
      period: "current_month",
      confidence: 0.75,
    };
  }
  if (/resumo|quanto (entrou|saiu)|sobra/.test(raw)) {
    return { intent: "month_summary", category: null, period: "current_month", confidence: 0.8 };
  }
  return null;
}

export async function classifyQuestion(raw: string, categoryNames: string[]): Promise<QaClassification> {
  const fallback = heuristicQa(raw) ?? {
    intent: "unknown" as const,
    category: null,
    period: "current_month" as const,
    confidence: 0.3,
  };
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
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
        {
          role: "system",
          content:
            "Classifique perguntas financeiras de um casal brasileiro. JSON: " +
            "intent (month_summary|spending_by_category|card_statement|pending_bills|budget_status|compare_periods|inbox_count|unknown), " +
            "category (nome da lista ou null), period (current_month|previous_month), confidence (0-1). " +
            `Hoje: ${todayISO()}. Categorias: ${categoryNames.join(", ")}.`,
        },
        { role: "user", content: raw },
      ],
    }),
  });
  if (!response.ok) return fallback;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return fallback;
  return parseQaClassification(JSON.parse(content) as Record<string, unknown>);
}
