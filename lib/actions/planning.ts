"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import type { CategoryKind } from "@/lib/types";

function revalidatePlanning() {
  revalidatePath("/");
  revalidatePath("/analise");
  revalidatePath("/configuracoes");
  revalidatePath("/recorrentes");
}

export async function upsertCategoryBudget(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const categoryId = String(formData.get("category_id") ?? "");
  const limit = parseBRLToCents(String(formData.get("limit") ?? ""));
  if (!categoryId || !limit) return { error: "Informe categoria e teto." };

  const { error } = await supabase.from("category_budgets").upsert(
    {
      household_id: household.id,
      category_id: categoryId,
      monthly_limit_cents: limit,
    },
    { onConflict: "household_id,category_id" },
  );
  if (error) return { error: error.message };
  revalidatePlanning();
  return { ok: true };
}

export async function deleteCategoryBudget(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("category_budgets").delete().eq("id", id).eq("household_id", household.id);
  revalidatePlanning();
}

export async function createAnnualEvent(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const eventMonth = Number(formData.get("event_month") ?? 0);
  const dueDay = Number(formData.get("due_day") ?? 20);
  const kind = String(formData.get("kind") ?? "fixa") as CategoryKind;
  const categoryId = String(formData.get("category_id") ?? "") || null;

  if (!name || !amount || eventMonth < 1 || eventMonth > 12) {
    return { error: "Informe nome, valor e mês." };
  }

  const { error } = await supabase.from("annual_events").insert({
    household_id: household.id,
    name,
    amount_cents: amount,
    event_month: eventMonth,
    due_day: dueDay,
    kind: kind === "receita" ? "receita" : "fixa",
    category_id: categoryId,
    active: true,
  });
  if (error) return { error: error.message };
  revalidatePlanning();
  return { ok: true };
}

export async function deleteAnnualEvent(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("annual_events").delete().eq("id", id).eq("household_id", household.id);
  revalidatePlanning();
}

export async function joinHousehold(formData: FormData) {
  const supabase = await createClient();
  const code = String(formData.get("invite_code") ?? "").trim();
  if (!code) return { error: "Informe o código da casa." };
  const { error } = await supabase.rpc("join_household_by_code", { p_code: code });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateReminderDays(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const days = Number(formData.get("reminder_days") ?? 3);
  if (days < 1 || days > 14) return { error: "Use de 1 a 14 dias." };
  await supabase.from("households").update({ reminder_days: days }).eq("id", household.id);
  revalidatePath("/");
  revalidatePath("/configuracoes");
  return { ok: true };
}
