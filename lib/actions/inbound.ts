"use server";

import { revalidatePath } from "next/cache";
import { classifyMessage, classifiedFromRegex, resolveCategory } from "@/lib/ingest/classify";
import { postClassifiedEntry } from "@/lib/ingest/post-entry";
import { dismissInboundById } from "@/lib/finance/mutations";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/lib/types";

function revalidateInbox() {
  revalidatePath("/");
  revalidatePath("/entrada");
  revalidatePath("/lancamentos");
  revalidatePath("/analise");
  revalidatePath("/cartoes", "layout");
}

export async function ingestInboundMessage(formData: FormData) {
  const { household, categories } = await loadWorkspace();
  const supabase = await createClient();
  const raw = String(formData.get("raw_text") ?? "").trim();
  if (!raw) return { error: "Cole a mensagem." };

  try {
    const classified = await classifyMessage(raw, categories);
    const category = resolveCategory(categories, {
      categoryName: classified.categoryName,
      label: classified.label,
      rawText: raw,
      description: classified.description,
    });
    const { error } = await supabase.from("inbound_messages").insert({
      household_id: household.id,
      raw_text: raw,
      parse_status: "pending",
      parsed_amount_cents: classified.amountCents,
      parsed_category_id: category?.id ?? null,
      parsed_installments: classified.installments,
      parsed_payment_method: classified.paymentMethod,
      parsed_kind: classified.kind,
      confidence: classified.confidence,
      source: "app",
    });
    if (error) return { error: error.message };
  } catch (error) {
    await supabase.from("inbound_messages").insert({
      household_id: household.id,
      raw_text: raw,
      parse_status: "failed",
      error: error instanceof Error ? error.message : "Falha ao ler",
      source: "app",
    });
    return { error: error instanceof Error ? error.message : "Falha ao ler" };
  }

  revalidateInbox();
  return { ok: true };
}

export async function confirmInbound(formData: FormData) {
  const workspace = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const instrument = String(formData.get("instrument") ?? "conta");
  const memberId = String(formData.get("member_id") ?? "") || null;

  const { data: inbound } = await supabase
    .from("inbound_messages")
    .select("*")
    .eq("id", id)
    .eq("household_id", workspace.household.id)
    .single();

  if (!inbound) return { error: "Mensagem não encontrada." };

  const fallback = classifiedFromRegex(inbound.raw_text, workspace.categories);
  const category = workspace.categories.find(
    (item) => item.id === (categoryId ?? inbound.parsed_category_id),
  );
  const paymentMethod: PaymentMethod =
    instrument === "cartao"
      ? "credito"
      : (inbound.parsed_payment_method as PaymentMethod | null) ?? fallback.paymentMethod;
  const classified = {
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
  };

  const posted = await postClassifiedEntry(supabase, {
    householdId: workspace.household.id,
    classified,
    categories: workspace.categories,
    accounts: workspace.bankAccounts,
    cards: workspace.creditCards,
    members: workspace.members,
    origin: inbound.source === "telegram" ? "telegram" : "whatsapp",
    memberHint: workspace.members.find((item) => item.id === memberId)?.display_name,
  });
  if ("error" in posted && posted.error) return { error: posted.error };

  await supabase
    .from("inbound_messages")
    .update({ parse_status: "parsed", parsed_category_id: category?.id ?? null })
    .eq("id", id);

  revalidateInbox();
  return { ok: true };
}

export async function dismissInbound(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await dismissInboundById(supabase, household.id, id);
  revalidateInbox();
}
