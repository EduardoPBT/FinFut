import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedChat } from "@/lib/telegram/config";
import type { TelegramMessage } from "@/lib/telegram/client";
import { persistHouseholdChatId, resolveHousehold } from "@/lib/finance/context";

export function successorChatId(message: TelegramMessage) {
  if (message.migrate_to_chat_id && isAllowedChat(message.chat.id)) {
    return String(message.migrate_to_chat_id);
  }
  if (message.migrate_from_chat_id && isAllowedChat(message.migrate_from_chat_id)) {
    return String(message.chat.id);
  }
  return null;
}

export async function authorizeTelegramChat(
  supabase: SupabaseClient,
  message: TelegramMessage,
) {
  const incoming = String(message.chat.id);
  const { data: houses } = await supabase
    .from("households")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);
  const linkedIds = (houses ?? [])
    .map((item) => item.telegram_chat_id)
    .filter((item): item is string => Boolean(item));

  const migrated = successorChatId(message);
  if (migrated) {
    const household = await resolveHousehold(supabase, incoming);
    await persistHouseholdChatId(supabase, household.id, migrated);
    return { ok: true as const, chatId: migrated, threadId: message.message_thread_id, migrated: true };
  }

  if (isAllowedChat(incoming, linkedIds)) {
    return { ok: true as const, chatId: incoming, threadId: message.message_thread_id };
  }

  return { ok: false as const, chatId: incoming, threadId: message.message_thread_id };
}
