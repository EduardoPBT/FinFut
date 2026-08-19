"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import type { BankAccountKind } from "@/lib/types";

const KINDS = new Set<BankAccountKind>(["corrente", "poupanca", "dinheiro"]);

function revalidateAccountPaths() {
  revalidatePath("/");
  revalidatePath("/configuracoes");
  revalidatePath("/recorrentes");
  revalidatePath("/lancamentos");
  revalidatePath("/cartoes", "layout");
  revalidatePath("/analise");
}

export async function createBankAccount(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "corrente") as BankAccountKind;
  const initial = parseBRLToCents(String(formData.get("initial_balance") ?? "0")) ?? 0;

  if (!name || !KINDS.has(kind)) {
    return { error: "Informe o nome da conta." };
  }

  const { error } = await supabase.from("bank_accounts").insert({
    household_id: household.id,
    name,
    kind,
    initial_balance_cents: initial,
    active: true,
  });

  if (error) return { error: error.message };
  revalidateAccountPaths();
  return { ok: true };
}

export async function updateBankAccount(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "corrente") as BankAccountKind;
  const initial = parseBRLToCents(String(formData.get("initial_balance") ?? "0")) ?? 0;

  if (!id || !name || !KINDS.has(kind)) {
    return { error: "Informe o nome da conta." };
  }

  const { error } = await supabase
    .from("bank_accounts")
    .update({ name, kind, initial_balance_cents: initial })
    .eq("id", id)
    .eq("household_id", household.id);

  if (error) return { error: error.message };
  revalidateAccountPaths();
  return { ok: true };
}

export async function deleteBankAccount(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase
    .from("bank_accounts")
    .update({ active: false })
    .eq("id", id)
    .eq("household_id", household.id);
  revalidateAccountPaths();
}
