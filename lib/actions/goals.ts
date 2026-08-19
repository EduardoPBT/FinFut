"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/money/competence";

function revalidateGoalPaths() {
  revalidatePath("/");
  revalidatePath("/objetivos");
  revalidatePath("/analise");
  revalidatePath("/lancamentos");
}

export async function createGoal(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const target = parseBRLToCents(String(formData.get("target") ?? ""));
  const dueOn = String(formData.get("due_on") ?? "") || null;
  const accountId = String(formData.get("account_id") ?? "") || null;

  if (!name || !target) return { error: "Dê um nome e um valor-alvo." };

  const { error } = await supabase.from("goals").insert({
    household_id: household.id,
    name,
    target_cents: target,
    current_cents: 0,
    due_on: dueOn,
    account_id: accountId,
    priority: 1,
  });

  if (error) return { error: error.message };
  revalidateGoalPaths();
  return { ok: true };
}

export async function contributeGoal(formData: FormData) {
  const { household, bankAccounts, categories } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const fromAccountId = String(formData.get("account_id") ?? "") || null;
  const occurredOn = String(formData.get("occurred_on") ?? "") || todayISO();

  if (!id || !amount) return { error: "Informe o valor do aporte." };
  if (!fromAccountId) return { error: "Escolha a conta de onde sai o aporte." };

  const { data: goal } = await supabase
    .from("goals")
    .select("current_cents, account_id, name")
    .eq("id", id)
    .eq("household_id", household.id)
    .single();

  if (!goal) return { error: "Objetivo não encontrado." };

  const destId = goal.account_id;
  const from = bankAccounts.find((item) => item.id === fromAccountId);
  if (!from) return { error: "Conta de origem inválida." };

  const reserveCategory = categories.find((item) => item.name === "Reserva");

  if (destId && destId !== fromAccountId) {
    const { error } = await supabase.from("transactions").insert({
      household_id: household.id,
      amount_cents: amount,
      occurred_on: occurredOn,
      notes: `Aporte ${goal.name}`,
      origin: "app",
      account_id: fromAccountId,
      destination_account_id: destId,
      goal_id: id,
      movement_kind: "transferencia",
      category_id: reserveCategory?.id ?? null,
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("transactions").insert({
      household_id: household.id,
      amount_cents: amount,
      occurred_on: occurredOn,
      notes: `Aporte ${goal.name}`,
      origin: "app",
      account_id: fromAccountId,
      goal_id: id,
      movement_kind: "despesa",
      category_id: reserveCategory?.id ?? null,
    });
    if (error) return { error: error.message };
  }

  await supabase
    .from("goals")
    .update({ current_cents: Number(goal.current_cents ?? 0) + amount })
    .eq("id", id)
    .eq("household_id", household.id);

  revalidateGoalPaths();
  return { ok: true };
}

export async function deleteGoal(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("goals").delete().eq("id", id).eq("household_id", household.id);
  revalidateGoalPaths();
}
