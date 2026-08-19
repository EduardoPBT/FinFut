import { assertTelegramReady, getTelegramConfig, webhookUrl } from "@/lib/telegram/config";

const TELEGRAM_API = "https://api.telegram.org";

async function telegramCall<T>(method: string, body: unknown): Promise<T> {
  const { botToken } = assertTelegramReady();
  const response = await fetch(`${TELEGRAM_API}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!payload.ok || payload.result === undefined) {
    throw new Error(payload.description ?? `Telegram ${method} falhou`);
  }
  return payload.result;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  threadId?: number,
) {
  return telegramCall("sendMessage", {
    chat_id: chatId,
    text,
    ...(threadId ? { message_thread_id: threadId } : {}),
  });
}

export async function downloadTelegramFile(fileId: string) {
  const { botToken } = assertTelegramReady();
  const file = await telegramCall<{ file_path: string }>("getFile", { file_id: fileId });
  const response = await fetch(`${TELEGRAM_API}/file/bot${botToken}/${file.file_path}`);
  if (!response.ok) throw new Error("Não consegui baixar o áudio do Telegram");
  const bytes = await response.arrayBuffer();
  const filename = file.file_path.split("/").pop() ?? "voice.ogg";
  return { bytes, filename };
}

export async function registerTelegramWebhook() {
  const { webhookSecret } = getTelegramConfig();
  if (!webhookSecret) {
    throw new Error("Defina TELEGRAM_WEBHOOK_SECRET no .env.local");
  }
  return telegramCall("setWebhook", {
    url: webhookUrl(),
    secret_token: webhookSecret,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: false,
  });
}

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; title?: string; type?: string };
  text?: string;
  caption?: string;
  voice?: { file_id: string };
  audio?: { file_id: string };
  message_thread_id?: number;
  is_topic_message?: boolean;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};
