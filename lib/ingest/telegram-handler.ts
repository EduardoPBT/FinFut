import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram/client";
import { syncCurrentMonth } from "@/lib/data/month";
import { loadHouseholdContext, resolveHousehold } from "@/lib/finance/context";
import { formatHelp } from "@/lib/finance/format-telegram";
import { routeTelegramText } from "@/lib/telegram/router";
import { runTelegramCommand } from "@/lib/telegram/commands";
import { handleQuestion } from "@/lib/telegram/qa-handler";
import { handleSessionOrEdit } from "@/lib/telegram/edit-handler";
import { handleAgent } from "@/lib/telegram/agent-handler";
import { extractMessageText, postTelegramEntry } from "@/lib/ingest/telegram-entry";
import { getActiveSession } from "@/lib/telegram/sessions";
import { authorizeTelegramChat } from "@/lib/telegram/authorize-chat";

export async function handleTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramUpdate,
) {
  const message = update.message ?? update.edited_message;
  if (!message) return { ignored: true };

  const auth = await authorizeTelegramChat(supabase, message);
  const reply = (text: string) => sendTelegramMessage(auth.chatId, text, auth.threadId);

  if (!auth.ok) {
    await reply(
      [
        "Este chat não está autorizado no FinFut.",
        "",
        `ID deste chat: ${auth.chatId}`,
        `ID esperado: ${process.env.TELEGRAM_CHAT_ID ?? "?"}`,
      ].join("\n"),
    );
    return { ignored: true, reason: "chat_not_allowed" };
  }

  if ("migrated" in auth && auth.migrated) {
    await reply("Atualizei o grupo do FinFut. Pode mandar os lançamentos daqui.");
    return { migrated: true };
  }

  const incomingText = message.text?.trim() || message.caption?.trim() || "";
  const { data: existing } = await supabase
    .from("inbound_messages")
    .select("id")
    .eq("telegram_update_id", update.update_id)
    .maybeSingle();
  if (existing && !incomingText.startsWith("/")) return { duplicate: true };

  const household = await resolveHousehold(supabase, auth.chatId);
  const context = await loadHouseholdContext(supabase, household.id);
  await syncCurrentMonth(household.id);

  try {
    const rawText = await extractMessageText(message, incomingText);
    if (!rawText) {
      await reply("Manda um texto ou um áudio. Use /help para ver o que eu faço.");
      return { ignored: true };
    }

    const session = await getActiveSession(supabase, auth.chatId);
    if (session) {
      const result = await handleSessionOrEdit(supabase, household.id, auth.chatId, rawText);
      await reply(result.reply);
      return { session: true };
    }

    const intent = routeTelegramText(rawText);
    if (intent === "help") {
      await reply(formatHelp());
      return { help: true };
    }
    if (intent === "command") {
      await reply(await runTelegramCommand(supabase, household.id, rawText));
      return { command: true };
    }
    if (intent === "question") {
      const answered = await handleQuestion(supabase, household.id, rawText, context);
      if (answered.handled) {
        await reply(answered.reply);
        return { question: true };
      }
      await reply(await handleAgent(supabase, household.id, Number(auth.chatId), rawText, context));
      return { agent: true };
    }
    if (intent === "edit") {
      const edited = await handleSessionOrEdit(supabase, household.id, auth.chatId, rawText);
      if (edited.handled) {
        await reply(edited.reply);
        return { edit: true };
      }
    }
    if (intent === "entry") {
      return postTelegramEntry(
        supabase,
        household.id,
        context,
        auth.chatId,
        update.update_id,
        rawText,
        auth.threadId,
      );
    }

    await reply(await handleAgent(supabase, household.id, Number(auth.chatId), rawText, context));
    return { agent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Falha ao ler";
    await reply(`Não consegui: ${reason}`);
    return { failed: true };
  }
}
