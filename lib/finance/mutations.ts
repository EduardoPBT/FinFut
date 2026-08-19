import type { SupabaseClient } from "@supabase/supabase-js";
import { classifiedFromRegex } from "@/lib/ingest/classify";
import { postClassifiedEntry } from "@/lib/ingest/post-entry";
import { loadHouseholdContext } from "@/lib/finance/context";
import { defaultPaidOn } from "@/lib/money/bill-payment";
import { nowBrasiliaISO, todayISO } from "@/lib/money/competence";
import type { MovementKind, PaymentMethod } from "@/lib/types";

function movementFromKind(kind: string | undefined): MovementKind {
  return kind === "receita" ? "receita" : "despesa";
}

export async function deleteFinanceEntry(
  supabase: SupabaseClient,
  householdId: string,
  entry: { kind: "transaction" | "charge"; id: string },
) {
  if (entry.kind === "charge") {
    const { error } = await supabase
      .from("card_charges")
      .delete()
      .eq("id", entry.id)
      .eq("household_id", householdId);
    if (error) return { error: error.message };
    return { ok: true as const };
  }
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", entry.id)
    .eq("household_id", householdId);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateFinanceEntry(
  supabase: SupabaseClient,
  householdId: string,
  entry: { kind: "transaction" | "charge"; id: string },
  patch: { amountCents?: number; categoryId?: string | null; notes?: string | null; occurredOn?: string },
) {
  if (entry.kind === "charge") {
    const { error } = await supabase
      .from("card_charges")
      .update({
        ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      })
      .eq("id", entry.id)
      .eq("household_id", householdId);
    if (error) return { error: error.message };
    return { ok: true as const };
  }

  const ctx = await loadHouseholdContext(supabase, householdId);
  const category = ctx.categories.find((item) => item.id === patch.categoryId);
  const { data: existing } = await supabase
    .from("transactions")
    .select("movement_kind")
    .eq("id", entry.id)
    .eq("household_id", householdId)
    .single();
  const movementKind =
    existing?.movement_kind === "transferencia"
      ? "transferencia"
      : movementFromKind(category?.kind);

  const { error } = await supabase
    .from("transactions")
    .update({
      ...(patch.amountCents !== undefined ? { amount_cents: patch.amountCents } : {}),
      ...(patch.occurredOn !== undefined ? { occurred_on: patch.occurredOn } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.categoryId !== undefined
        ? { category_id: movementKind === "transferencia" ? null : patch.categoryId }
        : {}),
      movement_kind: movementKind,
    })
    .eq("id", entry.id)
    .eq("household_id", householdId);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function confirmInboundById(
  supabase: SupabaseClient,
  householdId: string,
  inboundId: string,
) {
  const ctx = await loadHouseholdContext(supabase, householdId);
  const { data: inbound } = await supabase
    .from("inbound_messages")
    .select("*")
    .eq("id", inboundId)
    .eq("household_id", householdId)
    .single();
  if (!inbound) return { error: "Mensagem não encontrada." };

  const fallback = classifiedFromRegex(inbound.raw_text, ctx.categories);
  const category = ctx.categories.find((item) => item.id === inbound.parsed_category_id);
  const paymentMethod = (inbound.parsed_payment_method as PaymentMethod | null) ?? fallback.paymentMethod;
  const posted = await postClassifiedEntry(supabase, {
    householdId,
    classified: {
      ...fallback,
      amountCents: inbound.parsed_amount_cents ?? fallback.amountCents,
      kind:
        inbound.parsed_kind === "receita" || inbound.parsed_kind === "despesa"
          ? inbound.parsed_kind
          : fallback.kind,
      paymentMethod,
      installments: inbound.parsed_installments ?? fallback.installments,
      categoryName: category?.name ?? fallback.categoryName,
      needsReview: false,
      confidence: 1,
    },
    categories: ctx.categories,
    accounts: ctx.accounts,
    cards: ctx.cards,
    members: ctx.members,
    origin: inbound.source === "telegram" ? "telegram" : "whatsapp",
  });
  if ("error" in posted && posted.error) return { error: posted.error };

  await supabase
    .from("inbound_messages")
    .update({ parse_status: "parsed", parsed_category_id: category?.id ?? null })
    .eq("id", inboundId);
  return { ok: true as const };
}

export async function dismissInboundById(
  supabase: SupabaseClient,
  householdId: string,
  inboundId: string,
) {
  const { error } = await supabase
    .from("inbound_messages")
    .update({ parse_status: "failed", error: "ignorada" })
    .eq("id", inboundId)
    .eq("household_id", householdId);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function payStatementById(
  supabase: SupabaseClient,
  householdId: string,
  statementId: string,
) {
  const ctx = await loadHouseholdContext(supabase, householdId);
  const { data: statement } = await supabase
    .from("card_statements")
    .select("*")
    .eq("id", statementId)
    .eq("household_id", householdId)
    .single();
  if (!statement) return { error: "Fatura não encontrada." };
  if (statement.status === "paga") return { error: "Essa fatura já foi paga." };
  if (todayISO() < statement.cycle_start) return { error: "Essa fatura ainda não abriu." };

  const card = ctx.cards.find((item) => item.id === statement.credit_card_id);
  if (!card?.payment_account_id) return { error: "Cadastre a conta que paga este cartão." };

  const { data: charges } = await supabase
    .from("card_charges")
    .select("amount_cents")
    .eq("card_statement_id", statementId);
  const total = (charges ?? []).reduce((sum, item) => sum + item.amount_cents, 0);
  const alreadyPaid = Number(statement.paid_cents ?? 0);
  const remaining = Math.max(0, total - alreadyPaid);
  if (remaining <= 0) return { error: "Fatura sem valor a pagar." };

  const paidOn = defaultPaidOn();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      household_id: householdId,
      account_id: card.payment_account_id,
      amount_cents: remaining,
      occurred_on: paidOn,
      notes: `Fatura ${card.name}`,
      origin: "telegram",
      movement_kind: "transferencia",
      statement_payment_id: statementId,
    })
    .select("id")
    .single();
  if (txError || !tx) return { error: txError?.message ?? "Não foi possível debitar a conta." };

  const { error } = await supabase
    .from("card_statements")
    .update({
      status: "paga",
      paid_on: paidOn,
      payment_transaction_id: tx.id,
      paid_cents: alreadyPaid + remaining,
    })
    .eq("id", statementId)
    .eq("household_id", householdId);
  if (error) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return { error: error.message };
  }
  return { ok: true as const };
}

export async function payBillById(
  supabase: SupabaseClient,
  householdId: string,
  instanceId: string,
) {
  const ctx = await loadHouseholdContext(supabase, householdId);
  const account = ctx.accounts[0];
  if (!account) return { error: "Cadastre uma conta para pagar." };

  const { data: instance } = await supabase
    .from("bill_instances")
    .select("*")
    .eq("id", instanceId)
    .eq("household_id", householdId)
    .single();
  if (!instance) return { error: "Conta não encontrada." };
  if (instance.status === "pago") return { error: "Essa conta já foi paga." };

  const { data: bill } = await supabase
    .from("recurring_bills")
    .select("name, category_id")
    .eq("id", instance.recurring_bill_id)
    .maybeSingle();

  const paidOn = defaultPaidOn();
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      household_id: householdId,
      category_id: bill?.category_id ?? null,
      amount_cents: instance.amount_cents,
      occurred_on: paidOn,
      notes: bill?.name ?? "Conta",
      origin: "telegram",
      bill_instance_id: instanceId,
      account_id: account.id,
      movement_kind: "despesa",
    })
    .select("id")
    .single();
  if (txError || !tx) return { error: txError?.message ?? "Não foi possível criar o lançamento." };

  const { error } = await supabase
    .from("bill_instances")
    .update({
      status: "pago",
      paid_at: nowBrasiliaISO(),
      paid_on: paidOn,
      payment_method: "pix",
      payment_account: account.name,
      transaction_id: tx.id,
      account_id: account.id,
    })
    .eq("id", instanceId)
    .eq("household_id", householdId);
  if (error) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return { error: error.message };
  }
  return { ok: true as const };
}
