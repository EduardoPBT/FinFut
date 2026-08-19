import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatConfirmPrompt,
  formatEntryList,
} from "@/lib/finance/format-telegram";
import {
  confirmInboundById,
  deleteFinanceEntry,
  dismissInboundById,
  payBillById,
  payStatementById,
  updateFinanceEntry,
} from "@/lib/finance/mutations";
import {
  listCardStatements,
  listInbox,
  listPendingBills,
  searchFinanceEntries,
} from "@/lib/finance/queries";
import { loadHouseholdContext } from "@/lib/finance/context";
import { parseEditRequest } from "@/lib/telegram/parse-edit";
import {
  clearSession,
  getActiveSession,
  isCancelText,
  isConfirmText,
  parsePickIndex,
  saveSession,
  type TelegramSession,
  type TelegramSessionAction,
  type TelegramSessionPayload,
} from "@/lib/telegram/sessions";

type Candidate = NonNullable<TelegramSessionPayload["candidates"]>[number];

function asEntry(candidate: Candidate) {
  return {
    amountCents: candidate.amountCents,
    occurredOn: candidate.occurredOn,
    title: candidate.title,
    notes: candidate.notes,
  };
}

async function executeAction(
  supabase: SupabaseClient,
  householdId: string,
  action: TelegramSessionAction,
  selected: Candidate,
  patch?: TelegramSessionPayload["patch"],
) {
  if (action === "delete" && (selected.kind === "transaction" || selected.kind === "charge")) {
    return deleteFinanceEntry(supabase, householdId, { kind: selected.kind, id: selected.id });
  }
  if (action === "update" && (selected.kind === "transaction" || selected.kind === "charge")) {
    return updateFinanceEntry(supabase, householdId, { kind: selected.kind, id: selected.id }, patch ?? {});
  }
  if (action === "confirm_inbox" && selected.kind === "inbox") {
    return confirmInboundById(supabase, householdId, selected.id);
  }
  if (action === "dismiss_inbox" && selected.kind === "inbox") {
    return dismissInboundById(supabase, householdId, selected.id);
  }
  if (action === "pay_statement" && selected.kind === "statement") {
    return payStatementById(supabase, householdId, selected.id);
  }
  if (action === "pay_bill" && selected.kind === "bill") {
    return payBillById(supabase, householdId, selected.id);
  }
  return { error: "Ação inválida para este item." };
}

async function startPickOrConfirm(
  supabase: SupabaseClient,
  householdId: string,
  chatId: string,
  action: TelegramSessionAction,
  candidates: Candidate[],
  patch?: TelegramSessionPayload["patch"],
) {
  if (candidates.length === 0) {
    return { reply: "Não achei nenhum item correspondente." };
  }
  if (candidates.length === 1) {
    await saveSession(supabase, {
      householdId,
      chatId,
      step: "confirm",
      action,
      payload: { candidates, selected: candidates[0], patch },
    });
    return { reply: formatConfirmPrompt("Confirmar", asEntry(candidates[0])) };
  }
  await saveSession(supabase, {
    householdId,
    chatId,
    step: "pick",
    action,
    payload: { candidates, patch },
  });
  return {
    reply: [
      "Encontrei:",
      formatEntryList(candidates.map(asEntry)),
      "",
      "Responda o número ou cancela.",
    ].join("\n"),
  };
}

export async function continueSession(
  supabase: SupabaseClient,
  householdId: string,
  chatId: string,
  text: string,
  session: TelegramSession,
) {
  if (isCancelText(text)) {
    await clearSession(supabase, chatId);
    return { reply: "Cancelado." };
  }

  if (session.step === "pick") {
    const index = parsePickIndex(text, session.payload.candidates?.length ?? 0);
    if (index === null) return { reply: "Responda o número da lista ou cancela." };
    const selected = session.payload.candidates?.[index];
    if (!selected) return { reply: "Número inválido." };
    await saveSession(supabase, {
      householdId,
      chatId,
      step: "confirm",
      action: session.action,
      payload: { ...session.payload, selected },
    });
    return { reply: formatConfirmPrompt("Confirmar", asEntry(selected)) };
  }

  if (!isConfirmText(text)) {
    return { reply: "Responda sim para confirmar ou cancela." };
  }
  const selected = session.payload.selected;
  if (!selected) {
    await clearSession(supabase, chatId);
    return { reply: "Sessão sem item selecionado. Cancelei." };
  }
  const result = await executeAction(
    supabase,
    householdId,
    session.action,
    selected,
    session.payload.patch,
  );
  await clearSession(supabase, chatId);
  if ("error" in result && result.error) return { reply: `Não consegui: ${result.error}` };
  return { reply: "Pronto. Alteração feita." };
}

export async function startEditFlow(
  supabase: SupabaseClient,
  householdId: string,
  chatId: string,
  text: string,
) {
  const parsed = parseEditRequest(text);
  if (!parsed) return { handled: false as const, reply: "" };

  if (parsed.action === "confirm_inbox" || parsed.action === "dismiss_inbox") {
    const inbox = await listInbox(supabase, householdId);
    const candidates: Candidate[] = inbox.map((item) => ({
      kind: "inbox",
      id: item.id,
      amountCents: item.parsed_amount_cents ?? 0,
      occurredOn: item.created_at.slice(0, 10),
      title: "Inbox",
      notes: item.raw_text,
    }));
    const started = await startPickOrConfirm(supabase, householdId, chatId, parsed.action, candidates);
    return { handled: true as const, ...started };
  }

  if (parsed.action === "pay_statement") {
    const statements = await listCardStatements(supabase, householdId);
    const candidates: Candidate[] = statements
      .filter((item) => item.remainingCents > 0)
      .map((item) => ({
        kind: "statement",
        id: item.id,
        amountCents: item.remainingCents,
        occurredOn: item.dueOn,
        title: item.cardName,
        notes: item.status,
      }));
    const started = await startPickOrConfirm(supabase, householdId, chatId, "pay_statement", candidates);
    return { handled: true as const, ...started };
  }

  if (parsed.action === "pay_bill") {
    const bills = await listPendingBills(supabase, householdId);
    const needle = parsed.query.toLowerCase();
    const filtered = needle
      ? bills.filter((item) => item.name.toLowerCase().includes(needle))
      : bills;
    const candidates: Candidate[] = filtered.map((item) => ({
      kind: "bill",
      id: item.id,
      amountCents: item.amountCents,
      occurredOn: item.dueOn,
      title: item.name,
    }));
    const started = await startPickOrConfirm(supabase, householdId, chatId, "pay_bill", candidates);
    return { handled: true as const, ...started };
  }

  const entries = await searchFinanceEntries(supabase, householdId, {
    amountCents: parsed.amountCents ?? undefined,
    category: parsed.action === "delete" ? parsed.query : undefined,
    notes: parsed.action === "update" ? parsed.query : undefined,
    limit: 5,
  });
  const candidates: Candidate[] = entries.map((item) => ({
    kind: item.kind,
    id: item.id,
    amountCents: item.amountCents,
    occurredOn: item.occurredOn,
    title: item.categoryName,
    notes: item.notes,
  }));

  let patch: TelegramSessionPayload["patch"];
  if (parsed.action === "update") {
    const ctx = await loadHouseholdContext(supabase, householdId);
    const category = parsed.categoryName
      ? ctx.categories.find((item) => item.name.toLowerCase() === parsed.categoryName?.toLowerCase())
      : undefined;
    patch = {
      categoryId: category?.id,
      amountCents: parsed.newAmountCents,
    };
  }

  const started = await startPickOrConfirm(
    supabase,
    householdId,
    chatId,
    parsed.action,
    candidates,
    patch,
  );
  return { handled: true as const, ...started };
}

export async function handleSessionOrEdit(
  supabase: SupabaseClient,
  householdId: string,
  chatId: string,
  text: string,
) {
  const session = await getActiveSession(supabase, String(chatId));
  if (session) {
    return { handled: true as const, ...(await continueSession(supabase, householdId, String(chatId), text, session)) };
  }
  return startEditFlow(supabase, householdId, String(chatId), text);
}
