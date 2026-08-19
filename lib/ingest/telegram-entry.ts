import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMessage, resolveCategory, transcribeAudio, type ClassifiedEntry } from "@/lib/ingest/classify";
import { postClassifiedEntry } from "@/lib/ingest/post-entry";
import { formatBRL } from "@/lib/money/brl";
import type { TelegramMessage } from "@/lib/telegram/client";
import { downloadTelegramFile, sendTelegramMessage } from "@/lib/telegram/client";
import type { HouseholdContext } from "@/lib/finance/context";

function paymentLabel(method: ClassifiedEntry["paymentMethod"], installments: number) {
  if (method === "credito" && installments > 1) return `crédito ${installments}x`;
  return method;
}

export function successReply(classified: ClassifiedEntry, categoryName: string | null) {
  const category = categoryName ?? classified.categoryName ?? "Outros";
  const detail = classified.label ? `${classified.label} · ${category}` : category;
  return [
    "Lançamento registrado!",
    "",
    `${formatBRL(classified.amountCents)}`,
    `${detail} · ${paymentLabel(classified.paymentMethod, classified.installments)}`,
    "",
    "Confira em FinFut → Lançamentos.",
  ].join("\n");
}

export function pendingReply(classified: ClassifiedEntry, reason?: string) {
  const category = classified.categoryName ?? "Outros";
  const detail = classified.label ? `${classified.label} · ${category}` : category;
  const lines = [
    "Salvei na Inbox para revisão.",
    "",
    `${formatBRL(classified.amountCents)}`,
    `${detail}`,
  ];
  if (reason) lines.push("", `Motivo: ${reason}`);
  lines.push("", "Abra FinFut → Inbox para confirmar.");
  return lines.join("\n");
}

export async function extractMessageText(message: TelegramMessage, incomingText: string) {
  if (incomingText) return incomingText;
  if (message.voice || message.audio) {
    const fileId = message.voice?.file_id ?? message.audio?.file_id;
    if (!fileId) throw new Error("Áudio sem arquivo");
    const file = await downloadTelegramFile(fileId);
    return transcribeAudio(file.bytes, file.filename);
  }
  return "";
}

export async function postTelegramEntry(
  supabase: SupabaseClient,
  householdId: string,
  context: HouseholdContext,
  chatId: number | string,
  updateId: number,
  rawText: string,
  threadId?: number,
) {
  const classified = await classifyMessage(rawText, context.categories);
  const category = resolveCategory(context.categories, {
    categoryName: classified.categoryName,
    label: classified.label,
    rawText,
    description: classified.description,
  });
  const autoPost =
    classified.amountCents > 0 &&
    Boolean(category) &&
    !classified.needsReview &&
    classified.confidence >= 0.65;

  const { data: inbound, error: inboundError } = await supabase
    .from("inbound_messages")
    .insert({
      household_id: householdId,
      raw_text: rawText,
      parse_status: autoPost ? "parsed" : "pending",
      parsed_amount_cents: classified.amountCents,
      parsed_category_id: category?.id ?? null,
      parsed_installments: classified.installments,
      parsed_payment_method: classified.paymentMethod,
      parsed_kind: classified.kind,
      telegram_update_id: updateId,
      confidence: classified.confidence,
      source: "telegram",
    })
    .select("id")
    .single();
  if (inboundError) throw new Error(inboundError.message);

  if (autoPost) {
    const posted = await postClassifiedEntry(supabase, {
      householdId,
      classified,
      categories: context.categories,
      accounts: context.accounts,
      cards: context.cards,
      members: context.members,
      origin: "telegram",
      memberHint: null,
    });
    if ("error" in posted && posted.error) {
      await supabase
        .from("inbound_messages")
        .update({ parse_status: "pending", error: posted.error })
        .eq("id", inbound.id);
      await sendTelegramMessage(chatId, pendingReply(classified, posted.error), threadId);
      return { pending: true };
    }
    await sendTelegramMessage(chatId, successReply(classified, category?.name ?? null), threadId);
    return { posted: true };
  }

  await sendTelegramMessage(chatId, pendingReply(classified), threadId);
  return { pending: true };
}
