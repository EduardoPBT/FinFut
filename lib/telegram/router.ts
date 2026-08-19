export type TelegramIntent =
  | "command"
  | "question"
  | "edit"
  | "entry"
  | "agent"
  | "help";

const QUESTION =
  /\?|quanto(\s+eu)?\s+gastei|quanto\s+falta|or[cç]amento|como\s+est[aá]|qual\s+(o\s+)?saldo|resumo\s+do\s+m[eê]s|compare|vs\s+m[eê]s/i;

const EDIT =
  /\b(apaga|apag[ae]|exclui|delet[ae]|corrige|muda|altera|troca|confirma\s+inbox|lan[cç]a\s+o\s+pendente|descarta|paga\s+fatura|paga\s+conta)\b/i;

const ENTRY =
  /(gastei|comprei|paguei|recebi|lan[cç]a|r\$\s*\d|\d+[.,]?\d*\s*(reais|no|em))/i;

const HAS_MONEY = /(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:[,.]\d{1,2})?|\d+\s*reais/i;

export function routeTelegramText(raw: string): TelegramIntent {
  const text = raw.trim();
  if (!text) return "help";
  if (text.startsWith("/")) {
    const command = text.split(/\s+/)[0].toLowerCase();
    if (command === "/start" || command === "/help") return "help";
    return "command";
  }
  if (EDIT.test(text)) return "edit";
  if (QUESTION.test(text)) return "question";
  if (ENTRY.test(text) && HAS_MONEY.test(text)) return "entry";
  if (ENTRY.test(text)) return "entry";
  return "agent";
}
