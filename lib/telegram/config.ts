export function parseAllowedChatIds(raw: string) {
  return raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return { botToken, chatId, webhookSecret, appUrl };
}

export function assertTelegramReady() {
  const config = getTelegramConfig();
  if (!config.botToken || !config.chatId) {
    throw new Error("Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env.local");
  }
  return config;
}

export function isAllowedChat(
  incomingId: number | string,
  extraIds: Array<number | string> = [],
) {
  const incoming = String(incomingId);
  const allowed = [
    ...parseAllowedChatIds(process.env.TELEGRAM_CHAT_ID ?? ""),
    ...extraIds.map((item) => String(item)),
  ];
  return allowed.includes(incoming);
}

export function webhookUrl() {
  const { appUrl } = getTelegramConfig();
  if (!appUrl) throw new Error("Defina APP_URL com a URL pública do app");
  return `${appUrl}/api/telegram/webhook`;
}

