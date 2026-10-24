import { createClient } from "@/lib/supabase/server";
import type { StatementImport, StatementImportView } from "@/lib/types";

export async function loadRecentImports(
  householdId: string,
  accounts: { id: string; name: string }[],
  cards: { id: string; name: string }[],
): Promise<StatementImportView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(20);

  const accountName = new Map(accounts.map((item) => [item.id, item.name]));
  const cardName = new Map(cards.map((item) => [item.id, item.name]));

  return ((data ?? []) as StatementImport[]).map((item) => ({
    ...item,
    targetName:
      item.kind === "extrato"
        ? (accountName.get(item.bank_account_id ?? "") ?? "Conta")
        : (cardName.get(item.credit_card_id ?? "") ?? "Cartão"),
  }));
}
