"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { defaultPaidOn } from "@/lib/money/bill-payment";
import { recordIncomeReceipt } from "@/lib/money/income-receipt";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { dueOnForMonth, parseYearMonth } from "@/lib/money/competence";
import type { IncomeKind } from "@/lib/types";

function revalidateIncomePaths() {
  revalidatePath("/");
  revalidatePath("/recorrentes");
  revalidatePath("/lancamentos");
  revalidatePath("/analise");
  revalidatePath("/cartoes", "layout");
}

export async function createIncomeSource(formData: FormData) {
  const { household, members } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const payday = Number(formData.get("payday") ?? 1);
  const kind = String(formData.get("kind") ?? "fixo") as IncomeKind;
  const memberId = String(formData.get("member_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const accountId = String(formData.get("account_id") ?? "") || null;
  const mes = String(formData.get("mes") ?? "") || undefined;
  const competence = parseYearMonth(mes);

  if (!name || !amount || payday < 1 || payday > 31) {
    return { error: "Preencha nome, valor e dia previsto." };
  }
  if (memberId && !members.some((member) => member.id === memberId)) {
    return { error: "Membro inválido." };
  }

  const { data, error } = await supabase
    .from("income_sources")
    .insert({
      household_id: household.id,
      name,
      typical_amount_cents: amount,
      payday,
      kind: kind === "variavel" ? "variavel" : "fixo",
      member_id: memberId,
      category_id: categoryId,
      active: true,
      default_account_id: accountId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Não deu para salvar." };

  await supabase.from("income_instances").upsert(
    {
      household_id: household.id,
      income_source_id: data.id,
      competence: competence.start,
      amount_cents: amount,
      expected_on: dueOnForMonth(
        competence.year,
        competence.month,
        payday,
        competence.lastDay,
      ),
      status: "pendente",
      account_id: accountId,
    },
    { onConflict: "income_source_id,competence" },
  );

  revalidateIncomePaths();
  return { ok: true };
}

export async function updateIncomeSource(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const instanceId = String(formData.get("instance_id") ?? "");
  const mes = String(formData.get("mes") ?? "") || undefined;
  const competence = parseYearMonth(mes);
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const payday = Number(formData.get("payday") ?? 1);
  const kind = String(formData.get("kind") ?? "fixo") as IncomeKind;
  const memberId = String(formData.get("member_id") ?? "") || null;
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const accountId = String(formData.get("account_id") ?? "") || null;

  if (!id || !name || !amount || payday < 1 || payday > 31) {
    return { error: "Preencha nome, valor e dia previsto." };
  }

  const expectedOn = dueOnForMonth(
    competence.year,
    competence.month,
    payday,
    competence.lastDay,
  );

  await supabase
    .from("income_sources")
    .update({
      name,
      typical_amount_cents: amount,
      payday,
      kind: kind === "variavel" ? "variavel" : "fixo",
      member_id: memberId,
      category_id: categoryId,
      default_account_id: accountId,
    })
    .eq("id", id)
    .eq("household_id", household.id);

  if (instanceId) {
    await supabase
      .from("income_instances")
      .update({ amount_cents: amount, expected_on: expectedOn, account_id: accountId })
      .eq("id", instanceId)
      .eq("household_id", household.id);
  }

  revalidateIncomePaths();
  return { ok: true };
}

export async function markIncomeReceived(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const instanceId = String(formData.get("instance_id") ?? "");
  const sourceName = String(formData.get("source_name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const memberId = String(formData.get("member_id") ?? "") || null;
  const amountCents = Number(formData.get("amount_cents") ?? 0);
  const receivedOn = String(formData.get("received_on") ?? "") || defaultPaidOn();
  const accountId = String(formData.get("account_id") ?? "") || null;

  if (!instanceId || !amountCents) {
    return { error: "Não foi possível registrar o recebimento." };
  }

  const result = await recordIncomeReceipt(supabase, {
    householdId: household.id,
    instanceId,
    sourceName,
    categoryId,
    memberId,
    amountCents,
    receivedOn,
    accountId,
  });

  if ("error" in result) return { error: result.error };

  revalidateIncomePaths();
  return { ok: true };
}

export async function unmarkIncomeReceived(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const instanceId = String(formData.get("instance_id") ?? "");

  const { data: instance } = await supabase
    .from("income_instances")
    .select("transaction_id")
    .eq("id", instanceId)
    .eq("household_id", household.id)
    .single();

  if (instance?.transaction_id) {
    await supabase
      .from("transactions")
      .delete()
      .eq("id", instance.transaction_id)
      .eq("household_id", household.id);
  }

  await supabase
    .from("income_instances")
    .update({
      status: "pendente",
      received_at: null,
      received_on: null,
      transaction_id: null,
      suppress_auto_receive: true,
    })
    .eq("id", instanceId)
    .eq("household_id", household.id);

  revalidateIncomePaths();
}

export async function deleteIncomeSource(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase
    .from("income_sources")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  revalidateIncomePaths();
}
