import assert from "node:assert/strict";
import { test } from "node:test";
import { routeTelegramText } from "./router.ts";
import { parseSlashCommand } from "./commands.ts";
import { heuristicQa, parseQaClassification } from "./qa-classify.ts";
import { parseEditRequest } from "./parse-edit.ts";
import { isCancelText, isConfirmText, parsePickIndex } from "./sessions.ts";
import { isAllowedChat, parseAllowedChatIds } from "./config.ts";
import { successorChatId } from "./authorize-chat.ts";

test("router classifica comando, pergunta, edição e lançamento", () => {
  assert.equal(routeTelegramText("/mes"), "command");
  assert.equal(routeTelegramText("/help"), "help");
  assert.equal(routeTelegramText("quanto gastei em mercado?"), "question");
  assert.equal(routeTelegramText("apaga os 45 do mercado"), "edit");
  assert.equal(routeTelegramText("gastei 45 no mercado no pix"), "entry");
  assert.equal(routeTelegramText("oi tudo bem"), "agent");
});

test("parseSlashCommand lê /ultimos 8", () => {
  assert.deepEqual(parseSlashCommand("/ultimos 8"), { name: "/ultimos", arg: "8" });
});

test("heuristicQa lê gasto por categoria e fatura", () => {
  const spent = heuristicQa("quanto gastei em mercado?");
  assert.equal(spent?.intent, "spending_by_category");
  assert.equal(spent?.category, "mercado");
  assert.equal(heuristicQa("quanto falta na fatura?")?.intent, "card_statement");
});

test("parseQaClassification rejeita intent inválido", () => {
  const parsed = parseQaClassification({ intent: "foo", confidence: 2 });
  assert.equal(parsed.intent, "unknown");
  assert.equal(parsed.confidence, 1);
});

test("parseEditRequest extrai exclusão e inbox", () => {
  const del = parseEditRequest("apaga os 45 do mercado");
  assert.equal(del?.action, "delete");
  if (del?.action === "delete") assert.equal(del.amountCents, 4500);
  assert.equal(parseEditRequest("confirma inbox")?.action, "confirm_inbox");
  assert.equal(parseEditRequest("paga fatura")?.action, "pay_statement");
});

test("sessão confirma, cancela e escolhe índice", () => {
  assert.equal(isConfirmText("sim"), true);
  assert.equal(isCancelText("cancela"), true);
  assert.equal(parsePickIndex("2", 3), 1);
  assert.equal(parsePickIndex("9", 2), null);
});

test("aceita chat ids antigos e novos separados por vírgula", () => {
  const previous = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_CHAT_ID = "-1004417275590,-5083397589";
  assert.deepEqual(parseAllowedChatIds(process.env.TELEGRAM_CHAT_ID), [
    "-1004417275590",
    "-5083397589",
  ]);
  assert.equal(isAllowedChat("-1004417275590"), true);
  assert.equal(isAllowedChat("-5083397589"), true);
  assert.equal(isAllowedChat("0"), false);
  process.env.TELEGRAM_CHAT_ID = previous;
});

test("detecta migração de grupo para supergrupo", () => {
  const previous = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_CHAT_ID = "-5083397589";
  assert.equal(
    successorChatId({
      message_id: 1,
      chat: { id: -5083397589 },
      migrate_to_chat_id: -1004417275590,
    }),
    "-1004417275590",
  );
  process.env.TELEGRAM_CHAT_ID = previous;
});

