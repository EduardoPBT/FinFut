import type { Category, PaymentMethod } from "@/lib/types";
import {
  inferLabelAndCategory,
  normalizeLabel,
  resolveCategory,
} from "@/lib/ingest/category-match";
import { parseMessage } from "@/lib/ingest/parse-message";
import { todayISO } from "@/lib/money/competence";

export type ClassifiedEntry = {
  amountCents: number;
  /** Contexto completo extraído da mensagem (uso interno / Inbox). */
  description: string;
  /** Rótulo curto (2–3 palavras): estabelecimento ou contexto específico. */
  label: string | null;
  kind: "receita" | "despesa";
  paymentMethod: PaymentMethod;
  installments: number;
  categoryName: string | null;
  occurredOn: string;
  confidence: number;
  needsReview: boolean;
};

const METHODS = new Set<PaymentMethod>(["pix", "debito", "credito", "boleto", "outro"]);

export { matchCategoryByName, normalizeLabel, resolveCategory } from "@/lib/ingest/category-match";

export function classifiedFromRegex(raw: string, categories: Category[] = []): ClassifiedEntry {
  const parsed = parseMessage(raw);
  const paymentMethod: PaymentMethod = parsed.cardHint
    ? "credito"
    : /pix/i.test(raw)
      ? "pix"
      : /d[eé]bito/i.test(raw)
        ? "debito"
        : "pix";
  const inferred = inferLabelAndCategory(raw, categories);
  const matched = resolveCategory(categories, {
    categoryName: inferred.categoryName,
    label: inferred.label,
    rawText: raw,
    description: parsed.description,
  });
  return {
    amountCents: parsed.amountCents,
    description: parsed.description,
    label: inferred.label,
    kind: parsed.kindHint,
    paymentMethod,
    installments: parsed.installments,
    categoryName: matched?.name ?? inferred.categoryName,
    occurredOn: todayISO(),
    confidence: matched ? 0.72 : 0.55,
    needsReview: !matched,
  };
}

export function classifiedFromModel(payload: Record<string, unknown>): ClassifiedEntry {
  const amountBrl = Number(payload.amount_brl ?? payload.amountCents ?? 0);
  const amountCents =
    Number(payload.amount_cents) > 0
      ? Math.round(Number(payload.amount_cents))
      : Math.round(amountBrl * 100);
  const methodRaw = String(payload.payment_method ?? "pix");
  const paymentMethod = METHODS.has(methodRaw as PaymentMethod)
    ? (methodRaw as PaymentMethod)
    : "pix";
  const installments = Math.min(24, Math.max(1, Number(payload.installments ?? 1) || 1));
  const kind = payload.kind === "receita" ? "receita" : "despesa";
  const confidence = Math.min(1, Math.max(0, Number(payload.confidence ?? 0.5)));
  const occurredOn = String(payload.occurred_on ?? "") || todayISO();
  const label = normalizeLabel(
    payload.label ? String(payload.label) : String(payload.description ?? ""),
  );

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("A IA não encontrou um valor válido");
  }

  return {
    amountCents,
    description: String(payload.description ?? label ?? "lançamento").trim() || "lançamento",
    label,
    kind,
    paymentMethod: kind === "receita" ? "pix" : paymentMethod,
    installments: paymentMethod === "credito" ? installments : 1,
    categoryName: payload.category_name ? String(payload.category_name) : null,
    occurredOn,
    confidence,
    needsReview: Boolean(payload.needs_review) || confidence < 0.75,
  };
}

function whisperFilename(filename: string) {
  const base = filename.split("/").pop() ?? "voice.ogg";
  if (base.endsWith(".oga")) return base.replace(/\.oga$/, ".ogg");
  return base;
}

function whisperMimeType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".oga") || lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".mp3") || lower.endsWith(".mpeg")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "audio/ogg";
}

async function openAiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; code?: string };
    };
    const code = payload.error?.code;
    const message = payload.error?.message ?? "";
    if (response.status === 401 || code === "invalid_api_key") {
      return "Chave OpenAI inválida. Gere uma nova em platform.openai.com e atualize OPENAI_API_KEY no .env.local.";
    }
    if (message) return `${fallback}: ${message}`;
  } catch {
    // ignore parse errors
  }
  return fallback;
}

export async function transcribeAudio(bytes: ArrayBuffer, filename: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Defina OPENAI_API_KEY no .env.local");

  const normalizedName = whisperFilename(filename);
  const mimeType = whisperMimeType(normalizedName);

  const form = new FormData();
  form.append("model", "whisper-1");
  form.append("language", "pt");
  form.append(
    "file",
    new File([new Uint8Array(bytes)], normalizedName, { type: mimeType }),
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(await openAiErrorMessage(response, "Não consegui transcrever o áudio"));
  }
  const payload = (await response.json()) as { text?: string };
  const text = payload.text?.trim();
  if (!text) throw new Error("Áudio sem fala reconhecível");
  return text;
}

function buildClassifierPrompt(categories: Category[]) {
  const catalog = categories
    .map((item) => `- ${item.name} (${item.kind})`)
    .join("\n");

  return (
    "Você interpreta recados financeiros informais de um casal brasileiro (texto ou transcrição de áudio).\n" +
    "Devolva JSON com os campos:\n" +
    "- amount_brl (número)\n" +
    "- label (2 a 3 palavras: estabelecimento ou contexto ESPECÍFICO — ex.: Mercado Livre, iFood, Extra, Uber)\n" +
    "- description (frase curta com contexto completo)\n" +
    "- kind (receita|despesa)\n" +
    "- payment_method (pix|debito|credito|boleto|outro)\n" +
    "- installments (1-24; crédito parcelado usa installments>1)\n" +
    "- category_name (EXATAMENTE um nome da lista abaixo — macro para orçamento)\n" +
    "- occurred_on (YYYY-MM-DD ou vazio)\n" +
    "- confidence (0-1)\n" +
    "- needs_review (true se ambíguo ou incerto)\n\n" +
    "Regras importantes:\n" +
    "1. label ≠ category_name. label é micro (loja/app); category_name é macro (tipo de gasto).\n" +
    "2. Mercado Livre, Amazon, Shopee, Magalu, Shein = Compras online — NÃO use Mercado (supermercado).\n" +
    "3. Mercado, supermercado, feira, hortifruti, padaria = Mercado.\n" +
    "4. iFood, Rappi, delivery = Delivery.\n" +
    "5. Se não couber bem, use Outros e needs_review=true.\n" +
    "6. 'parcelado em N vezes' ou 'Nx' → payment_method=credito, installments=N.\n" +
    "7. Se não disser forma de pagamento em despesa, use pix.\n\n" +
    `Hoje: ${todayISO()}\n\n` +
    "Categorias disponíveis:\n" +
    catalog
  );
}

export async function classifyMessage(raw: string, categories: Category[]): Promise<ClassifiedEntry> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return classifiedFromRegex(raw, categories);

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
        { role: "system", content: buildClassifierPrompt(categories) },
        { role: "user", content: raw },
      ],
    }),
  });

  if (!response.ok) {
    return classifiedFromRegex(raw, categories);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return classifiedFromRegex(raw, categories);

  const classified = classifiedFromModel(JSON.parse(content) as Record<string, unknown>);
  const resolved = resolveCategory(categories, {
    categoryName: classified.categoryName,
    label: classified.label,
    rawText: raw,
    description: classified.description,
  });
  if (resolved) {
    classified.categoryName = resolved.name;
    if (detectAmbiguousMercado(raw, classified)) {
      classified.needsReview = true;
      classified.confidence = Math.min(classified.confidence, 0.7);
    }
  }
  return classified;
}

function detectAmbiguousMercado(raw: string, classified: ClassifiedEntry) {
  return (
    classified.categoryName === "Mercado" &&
    /mercado\s+livre|mercadolivre/i.test(raw) &&
    classified.label !== "Mercado Livre"
  );
}
