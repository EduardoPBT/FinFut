import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  BankAccount,
  Category,
  CreditCard,
  Household,
  IncomeSource,
  Member,
  Workspace,
} from "@/lib/types";

export async function loadWorkspace(): Promise<Workspace & { userId: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: householdId, error: ensureError } = await supabase.rpc(
    "ensure_my_household",
  );

  if (ensureError || !householdId) {
    throw new Error(ensureError?.message ?? "Não foi possível abrir a casa.");
  }

  const [
    { data: household },
    { data: members },
    { data: categories },
    { data: incomeSources },
    { data: bankAccounts },
    { data: creditCards },
  ] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase.from("members").select("*").eq("household_id", householdId),
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order"),
    supabase.from("income_sources").select("*").eq("household_id", householdId),
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("credit_cards")
      .select("*")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("name"),
  ]);

  if (!household) {
    throw new Error("Casa não encontrada.");
  }

  return {
    userId,
    household: household as Household,
    members: (members ?? []) as Member[],
    categories: (categories ?? []) as Category[],
    incomeSources: (incomeSources ?? []) as IncomeSource[],
    bankAccounts: (bankAccounts ?? []) as BankAccount[],
    creditCards: (creditCards ?? []) as CreditCard[],
  };
}

export async function getAuthedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return supabase;
}
