import type { SupabaseClient } from "@supabase/supabase-js";

export const SESSION_TTL_MS = 10 * 60 * 1000;

export type TelegramSessionStep = "pick" | "confirm";
export type TelegramSessionAction =
  | "delete"
  | "update"
  | "confirm_inbox"
  | "dismiss_inbox"
  | "pay_statement"
  | "pay_bill";

export type SessionCandidate = {
  kind: "transaction" | "charge" | "inbox" | "statement" | "bill";
  id: string;
  amountCents: number;
  occurredOn: string;
  title: string;
  notes?: string | null;
};

export type TelegramSessionPayload = {
  candidates?: SessionCandidate[];
  selected?: SessionCandidate;
  patch?: { categoryId?: string | null; amountCents?: number; notes?: string | null };
};

export type TelegramSession = {
  id: string;
  household_id: string;
  chat_id: string;
  step: TelegramSessionStep;
  action: TelegramSessionAction;
  payload: TelegramSessionPayload;
  expires_at: string;
};

export async function getActiveSession(supabase: SupabaseClient, chatId: string) {
  const { data } = await supabase
    .from("telegram_sessions")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!data) return null;
  const session = data as TelegramSession;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await clearSession(supabase, chatId);
    return null;
  }
  return session;
}

export async function saveSession(
  supabase: SupabaseClient,
  input: {
    householdId: string;
    chatId: string;
    step: TelegramSessionStep;
    action: TelegramSessionAction;
    payload: TelegramSessionPayload;
  },
) {
  await supabase.from("telegram_sessions").delete().eq("chat_id", input.chatId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("telegram_sessions")
    .insert({
      household_id: input.householdId,
      chat_id: input.chatId,
      step: input.step,
      action: input.action,
      payload: input.payload,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível salvar a sessão");
  return data as TelegramSession;
}

export async function clearSession(supabase: SupabaseClient, chatId: string) {
  await supabase.from("telegram_sessions").delete().eq("chat_id", chatId);
}

export function isCancelText(text: string) {
  return /^(cancela|cancelar|não|nao)$/i.test(text.trim());
}

export function isConfirmText(text: string) {
  return /^(sim|ok|confirmar|confirma)$/i.test(text.trim());
}

export function parsePickIndex(text: string, max: number) {
  const match = text.trim().match(/^(\d+)$/);
  if (!match) return null;
  const index = Number(match[1]);
  if (index < 1 || index > max) return null;
  return index - 1;
}
