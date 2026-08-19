import { createClient } from "@/lib/supabase/server";
import type { AnnualEvent, CategoryBudget, InboundMessage } from "@/lib/types";

export async function loadPlanningExtras(householdId: string) {
  const supabase = await createClient();
  const [{ data: annualEvents }, { data: budgets }, { data: inbound }] = await Promise.all([
    supabase.from("annual_events").select("*").eq("household_id", householdId).eq("active", true),
    supabase.from("category_budgets").select("*").eq("household_id", householdId),
    supabase
      .from("inbound_messages")
      .select("*")
      .eq("household_id", householdId)
      .eq("parse_status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return {
    annualEvents: (annualEvents ?? []) as AnnualEvent[],
    budgets: (budgets ?? []) as CategoryBudget[],
    inbound: (inbound ?? []) as InboundMessage[],
  };
}
