"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { createCardCharges } from "@/lib/data/cards";
import { updateFinanceEntry, deleteFinanceEntry } from "@/lib/finance/mutations";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKind, MovementKind } from "@/lib/types";

function revalidateTxPaths() {
  revalidatePath("/");
  revalidatePath("/lancamentos");
  revalidatePath("/analise");
  revalidatePath("/cartoes", "layout");
  revalidatePath("/objetivos");
  revalidatePath("/entrada");
}

function movementFromCategory(kind: CategoryKind | undefined): MovementKind {
  return kind === "receita" ? "receita" : "despesa";
}

export async function createTransaction(formData: FormData) {
  const { household, categories, creditCards } = await loadWorkspace();
  const supabase = await createClient();
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const memberId = String(formData.get("member_id") ?? "") || null;
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const instrument = String(formData.get("instrument") ?? "conta");
  const accountId = String(formData.get("account_id") ?? "") || null;
  const destinationId = String(formData.get("destination_account_id") ?? "") || null;
  const creditCardId = String(formData.get("credit_card_id") ?? "") || null;
  const installments = Number(formData.get("installments") ?? 1);
  const category = categories.find((item) => item.id === categoryId);

  if (!amount || !occurredOn) {
    return { error: "Preencha valor e data." };
  }

  if (instrument === "transferencia") {
    if (!accountId || !destinationId || accountId === destinationId) {
      return { error: "Escolha duas contas diferentes." };
    }
    const { error } = await supabase.from("transactions").insert({
      household_id: household.id,
      amount_cents: amount,
      occurred_on: occurredOn,
      notes: notes ?? "Transferência",
      origin: "app",
      account_id: accountId,
      destination_account_id: destinationId,
      movement_kind: "transferencia",
    });
    if (error) return { error: error.message };
    revalidateTxPaths();
    return { ok: true };
  }

  if (!categoryId) return { error: "Preencha valor, categoria e data." };

  if (instrument === "cartao") {
    const card = creditCards.find((item) => item.id === creditCardId);
    if (!card) return { error: "Escolha o cartão." };
    if (category?.kind === "receita") {
      return { error: "Receita não entra no cartão de crédito." };
    }
    const result = await createCardCharges(supabase, {
      householdId: household.id,
      card,
      categoryId,
      memberId,
      amountCents: amount,
      purchaseDate: occurredOn,
      notes,
      installments,
    });
    if ("error" in result) return { error: result.error };
    revalidateTxPaths();
    return { ok: true };
  }

  const { error } = await supabase.from("transactions").insert({
    household_id: household.id,
    category_id: categoryId,
    member_id: memberId,
    amount_cents: amount,
    occurred_on: occurredOn,
    notes,
    origin: "app",
    account_id: accountId,
    movement_kind: movementFromCategory(category?.kind),
  });

  if (error) return { error: error.message };
  revalidateTxPaths();
  return { ok: true };
}

export async function updateTransaction(formData: FormData) {
  const { household, categories } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || !amount || !occurredOn) {
    return { error: "Preencha valor e data." };
  }

  const result = await updateFinanceEntry(supabase, household.id, { kind: "transaction", id }, {
    amountCents: amount,
    categoryId,
    occurredOn,
    notes,
  });
  if ("error" in result) return { error: result.error };
  revalidateTxPaths();
  return { ok: true };
}

export async function updateCardCharge(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  if (!id) return { error: "Compra não encontrada." };

  const result = await updateFinanceEntry(supabase, household.id, { kind: "charge", id }, {
    notes,
    categoryId,
  });
  if ("error" in result) return { error: result.error };
  revalidateTxPaths();
  return { ok: true };
}

export async function deleteTransaction(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await deleteFinanceEntry(supabase, household.id, { kind: "transaction", id });
  revalidateTxPaths();
}
