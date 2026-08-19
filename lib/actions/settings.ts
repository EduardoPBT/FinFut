"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";

export async function updateHousehold(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await supabase.from("households").update({ name }).eq("id", household.id);
  revalidatePath("/");
  revalidatePath("/configuracoes");
}

export async function updateMember(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!id || !displayName) return;
  await supabase
    .from("members")
    .update({ display_name: displayName })
    .eq("id", id)
    .eq("household_id", household.id);
  revalidatePath("/configuracoes");
  revalidatePath("/lancamentos");
}

export async function updateIncomeSource(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const typical = parseBRLToCents(String(formData.get("typical_amount") ?? "0"));
  const paydayRaw = String(formData.get("payday") ?? "");
  const payday = paydayRaw ? Number(paydayRaw) : null;

  await supabase
    .from("income_sources")
    .update({
      typical_amount_cents: typical,
      payday: payday && payday >= 1 && payday <= 31 ? payday : null,
    })
    .eq("id", id)
    .eq("household_id", household.id);

  revalidatePath("/");
  revalidatePath("/configuracoes");
  revalidatePath("/analise");
}

export async function updateCategory(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await supabase
    .from("categories")
    .update({ name })
    .eq("id", id)
    .eq("household_id", household.id);
  revalidatePath("/configuracoes");
  revalidatePath("/lancamentos");
}
