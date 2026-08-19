import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMonthSummary, formatSpendingByCategory } from "@/lib/finance/format-telegram";
import {
  listCardStatements,
  listInbox,
  listPendingBills,
  listRecentEntries,
  loadMonthSnapshot,
  searchFinanceEntries,
  spendingByCategory,
} from "@/lib/finance/queries";
import { startEditFlow } from "@/lib/telegram/edit-handler";
import { handleQuestion } from "@/lib/telegram/qa-handler";
import { postTelegramEntry } from "@/lib/ingest/telegram-entry";
import { loadHouseholdContext } from "@/lib/finance/context";

type ToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

const WRITE_TOOLS = new Set(["delete_entry", "update_entry", "confirm_inbox"]);

function tools() {
  return [
    {
      type: "function",
      function: {
        name: "get_month_summary",
        description: "Resumo do mês atual: receitas, despesas e sobra",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_spending_by_category",
        description: "Gasto de uma categoria no mês",
        parameters: {
          type: "object",
          properties: { category: { type: "string" } },
          required: ["category"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_recent_entries",
        description: "Últimos lançamentos",
        parameters: { type: "object", properties: { limit: { type: "number" } } },
      },
    },
    {
      type: "function",
      function: {
        name: "get_card_statement",
        description: "Faturas de cartão abertas ou a pagar",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_pending_bills",
        description: "Contas pendentes do mês",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_inbox",
        description: "Mensagens pendentes na Inbox",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "search_entries",
        description: "Busca lançamentos por valor ou categoria",
        parameters: {
          type: "object",
          properties: { amount_cents: { type: "number" }, category: { type: "string" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_entry",
        description: "Apaga um lançamento. Só execute com confirmed=true depois que o usuário confirmar.",
        parameters: {
          type: "object",
          properties: {
            confirmed: { type: "boolean" },
            kind: { type: "string", enum: ["transaction", "charge"] },
            id: { type: "string" },
          },
          required: ["confirmed"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_entry",
        description: "Edita um lançamento. Só execute com confirmed=true.",
        parameters: {
          type: "object",
          properties: { confirmed: { type: "boolean" } },
          required: ["confirmed"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "confirm_inbox",
        description: "Confirma item da Inbox. Só execute com confirmed=true.",
        parameters: {
          type: "object",
          properties: { confirmed: { type: "boolean" } },
          required: ["confirmed"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_entry",
        description: "Lança um gasto ou receita a partir do texto original.",
        parameters: {
          type: "object",
          properties: { raw_text: { type: "string" }, confirmed: { type: "boolean" } },
          required: ["raw_text"],
        },
      },
    },
  ];
}

async function runTool(
  supabase: SupabaseClient,
  householdId: string,
  chatId: number,
  name: string,
  args: Record<string, unknown>,
) {
  if (WRITE_TOOLS.has(name) && args.confirmed !== true) {
    const started = await startEditFlow(supabase, householdId, String(chatId), String(args.raw_text ?? ""));
    return JSON.stringify({
      needs_confirmation: true,
      message: started.reply || "Peça confirmação ao usuário antes de alterar.",
    });
  }

  switch (name) {
    case "get_month_summary": {
      const snapshot = await loadMonthSnapshot(supabase, householdId);
      return formatMonthSummary({
        yearMonth: snapshot.competence.yearMonth,
        incomeCents: snapshot.incomeCents,
        expenseCents: snapshot.expenseCents,
        remainingCents: snapshot.remainingCents,
      });
    }
    case "get_spending_by_category":
      return formatSpendingByCategory(
        await spendingByCategory(supabase, householdId, String(args.category ?? "")),
      );
    case "list_recent_entries": {
      const entries = await listRecentEntries(supabase, householdId, Number(args.limit ?? 5));
      return JSON.stringify(entries);
    }
    case "get_card_statement":
      return JSON.stringify(await listCardStatements(supabase, householdId));
    case "get_pending_bills":
      return JSON.stringify(await listPendingBills(supabase, householdId));
    case "get_inbox":
      return JSON.stringify(await listInbox(supabase, householdId));
    case "search_entries":
      return JSON.stringify(
        await searchFinanceEntries(supabase, householdId, {
          amountCents: args.amount_cents ? Number(args.amount_cents) : undefined,
          category: args.category ? String(args.category) : undefined,
        }),
      );
    case "create_entry": {
      const ctx = await loadHouseholdContext(supabase, householdId);
      const result = await postTelegramEntry(
        supabase,
        householdId,
        ctx,
        chatId,
        Number(args.update_id ?? Date.now()),
        String(args.raw_text ?? ""),
      );
      return JSON.stringify(result);
    }
    default:
      return JSON.stringify({ error: "tool não executada sem confirmação" });
  }
}

export async function handleAgent(
  supabase: SupabaseClient,
  householdId: string,
  chatId: number,
  text: string,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const fallback = await handleQuestion(supabase, householdId, text);
    return fallback.reply;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const messages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content:
        "Você é o assistente financeiro do casal no Telegram. Use as tools para ler dados reais. " +
        "Nunca invente valores. Mutações só com confirmed=true. Responda curto em português.",
    },
    { role: "user", content: text },
  ];

  for (let round = 0; round < 4; round += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages,
        tools: tools(),
      }),
    });
    if (!response.ok) {
      const fallback = await handleQuestion(supabase, householdId, text);
      return fallback.reply;
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }>;
    };
    const message = payload.choices?.[0]?.message;
    if (!message) break;
    if (message.tool_calls?.length) {
      messages.push(message);
      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const result = await runTool(supabase, householdId, chatId, call.function.name, args);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      continue;
    }
    if (message.content?.trim()) return message.content.trim();
    break;
  }

  const fallback = await handleQuestion(supabase, householdId, text);
  if (fallback.handled) return fallback.reply;
  return "Não encontrei dados para isso. Tente /help.";
}
