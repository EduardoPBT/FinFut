import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankAccount, Category, CreditCard, Household, Member } from "@/lib/types";

export type HouseholdContext = {
  household: Household;
  categories: Category[];
  accounts: BankAccount[];
  cards: CreditCard[];
  members: Member[];
};

export async function persistHouseholdChatId(
  supabase: SupabaseClient,
  householdId: string,
  chatId: string,
) {
  await supabase.from("households").update({ telegram_chat_id: chatId }).eq("id", householdId);
}

export async function resolveHousehold(supabase: SupabaseClient, chatId: string) {
  const { data: linked } = await supabase
    .from("households")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (linked) return linked as Household;

  const { data: houses } = await supabase.from("households").select("*").limit(2);
  const list = (houses ?? []) as Household[];
  if (list.length !== 1) {
    throw new Error("Não achei a casa ligada a este chat do Telegram");
  }
  await persistHouseholdChatId(supabase, list[0].id, chatId);
  return { ...list[0], telegram_chat_id: chatId };
}

export async function loadHouseholdContext(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdContext> {
  const [household, categories, accounts, cards, members] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase.from("categories").select("*").eq("household_id", householdId),
    supabase.from("bank_accounts").select("*").eq("household_id", householdId).eq("active", true),
    supabase.from("credit_cards").select("*").eq("household_id", householdId).eq("active", true),
    supabase.from("members").select("*").eq("household_id", householdId),
  ]);
  if (!household.data) throw new Error("Casa não encontrada");
  return {
    household: household.data as Household,
    categories: (categories.data ?? []) as Category[],
    accounts: (accounts.data ?? []) as BankAccount[],
    cards: (cards.data ?? []) as CreditCard[],
    members: (members.data ?? []) as Member[],
  };
}
