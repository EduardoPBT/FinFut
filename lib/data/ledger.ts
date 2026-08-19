import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureActiveCardCycles, toStatementView } from "@/lib/data/cards";
import { todayISO } from "@/lib/money/competence";
import type { CardCharge, CardStatement, CreditCard } from "@/lib/types";

async function clientOrServer(supabase?: SupabaseClient) {
  return supabase ?? (await createClient());
}

export async function loadAccountMovements(householdId: string, supabase?: SupabaseClient) {
  const client = await clientOrServer(supabase);
  const { data } = await client
    .from("transactions")
    .select("account_id, destination_account_id, amount_cents, movement_kind")
    .eq("household_id", householdId)
    .not("account_id", "is", null);
  return data ?? [];
}

export async function loadUpcomingStatements(householdId: string, supabase?: SupabaseClient) {
  const client = await clientOrServer(supabase);
  const today = todayISO();
  const { data } = await client
    .from("card_statements")
    .select("*")
    .eq("household_id", householdId)
    .neq("status", "paga")
    .order("due_on");

  const typed = (data ?? []) as CardStatement[];
  if (typed.length === 0) return [];

  const { data: charges } = await client
    .from("card_charges")
    .select("*")
    .eq("household_id", householdId)
    .in(
      "card_statement_id",
      typed.map((item) => item.id),
    );

  const chargesByStatement = new Map<string, CardCharge[]>();
  for (const charge of (charges ?? []) as CardCharge[]) {
    const list = chargesByStatement.get(charge.card_statement_id) ?? [];
    list.push(charge);
    chargesByStatement.set(charge.card_statement_id, list);
  }

  return typed
    .map((statement) =>
      toStatementView(statement, chargesByStatement.get(statement.id) ?? [], today),
    )
    .filter((item) => item.displayStatus !== "futura" || item.totalCents > 0)
    .slice(0, 6);
}

export async function loadCreditCardDetail(householdId: string, cardId: string) {
  const supabase = await createClient();
  const today = todayISO();
  const { data: card } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("id", cardId)
    .eq("household_id", householdId)
    .eq("active", true)
    .single();

  if (!card) return null;
  const typedCard = card as CreditCard;
  await ensureActiveCardCycles(supabase, householdId, typedCard, today);

  const [{ data: statements }, { data: charges }] = await Promise.all([
    supabase
      .from("card_statements")
      .select("*")
      .eq("household_id", householdId)
      .eq("credit_card_id", cardId)
      .order("due_on", { ascending: false }),
    supabase
      .from("card_charges")
      .select("*")
      .eq("household_id", householdId)
      .eq("credit_card_id", cardId)
      .order("occurred_on", { ascending: false }),
  ]);

  const typedStatements = (statements ?? []) as CardStatement[];
  const typedCharges = (charges ?? []) as CardCharge[];
  const chargesByStatement = new Map<string, CardCharge[]>();
  for (const charge of typedCharges) {
    const list = chargesByStatement.get(charge.card_statement_id) ?? [];
    list.push(charge);
    chargesByStatement.set(charge.card_statement_id, list);
  }

  const views = typedStatements.map((statement) =>
    toStatementView(statement, chargesByStatement.get(statement.id) ?? [], today),
  );
  const current = views.find((item) => item.displayStatus === "aberta") ?? null;
  const payable = views
    .filter((item) => item.displayStatus === "fechada" && item.totalCents > 0)
    .sort((left, right) => left.due_on.localeCompare(right.due_on));
  const upcoming = views
    .filter((item) => item.displayStatus === "futura" && item.totalCents > 0)
    .sort((left, right) => left.due_on.localeCompare(right.due_on));
  const paid = views
    .filter((item) => item.displayStatus === "paga")
    .sort((left, right) => right.due_on.localeCompare(left.due_on))
    .slice(0, 6);

  return { card: typedCard, statements: views, current, payable, upcoming, paid };
}
