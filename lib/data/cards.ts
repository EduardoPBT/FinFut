import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addCalendarDays,
  clampInstallments,
  installmentCycles,
  resolveCycle,
  splitInstallmentAmounts,
  statementDisplayStatus,
} from "@/lib/money/card-cycle";
import { todayISO } from "@/lib/money/competence";
import type {
  CardCharge,
  CardStatement,
  CardStatementView,
  CreditCard,
} from "@/lib/types";

export async function ensureCardStatement(
  supabase: SupabaseClient,
  params: {
    householdId: string;
    card: CreditCard;
    purchaseDate: string;
    today?: string;
  },
) {
  const cycle = resolveCycle(params.purchaseDate, params.card.closing_day, params.card.due_day);
  const today = params.today ?? todayISO();

  const { data: existing } = await supabase
    .from("card_statements")
    .select("*")
    .eq("credit_card_id", params.card.id)
    .eq("cycle_end", cycle.cycleEnd)
    .maybeSingle();

  if (existing) {
    return { statement: existing as CardStatement };
  }

  const status = today <= cycle.cycleEnd ? "aberta" : "fechada";
  const { data, error } = await supabase
    .from("card_statements")
    .insert({
      household_id: params.householdId,
      credit_card_id: params.card.id,
      cycle_start: cycle.cycleStart,
      cycle_end: cycle.cycleEnd,
      due_on: cycle.dueOn,
      status,
    })
    .select("*")
    .single();

  if (error || !data) {
    const { data: raced } = await supabase
      .from("card_statements")
      .select("*")
      .eq("credit_card_id", params.card.id)
      .eq("cycle_end", cycle.cycleEnd)
      .maybeSingle();
    if (raced) return { statement: raced as CardStatement };
    return { error: error?.message ?? "Não foi possível abrir a fatura." };
  }

  return { statement: data as CardStatement };
}

export async function createCardCharges(
  supabase: SupabaseClient,
  params: {
    householdId: string;
    card: CreditCard;
    categoryId: string | null;
    memberId: string | null;
    amountCents: number;
    purchaseDate: string;
    notes: string | null;
    installments: number;
    billInstanceId?: string | null;
  },
) {
  const count = clampInstallments(params.installments);
  const amounts = splitInstallmentAmounts(params.amountCents, count);
  const cycles = installmentCycles(
    params.purchaseDate,
    params.card.closing_day,
    params.card.due_day,
    count,
  );
  const groupId = count > 1 ? crypto.randomUUID() : null;
  const created: CardCharge[] = [];

  for (let index = 0; index < count; index += 1) {
    const ensured = await ensureCardStatement(supabase, {
      householdId: params.householdId,
      card: params.card,
      purchaseDate: cycles[index].cycleEnd,
    });
    if ("error" in ensured) return { error: ensured.error };

    const { data, error } = await supabase
      .from("card_charges")
      .insert({
        household_id: params.householdId,
        credit_card_id: params.card.id,
        card_statement_id: ensured.statement.id,
        category_id: params.categoryId,
        member_id: params.memberId,
        amount_cents: amounts[index],
        occurred_on: params.purchaseDate,
        notes: params.notes,
        installment_group_id: groupId,
        installment_number: index + 1,
        installment_total: count,
        bill_instance_id: params.billInstanceId ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return { error: error?.message ?? "Não foi possível lançar no cartão." };
    }
    created.push(data as CardCharge);
  }

  return { charges: created };
}

export async function ensureActiveCardCycles(
  supabase: SupabaseClient,
  householdId: string,
  card: CreditCard,
  today: string,
) {
  const open = await ensureCardStatement(supabase, {
    householdId,
    card,
    purchaseDate: today,
    today,
  });
  if ("error" in open) return open;

  const previousDay = addCalendarDays(
    resolveCycle(today, card.closing_day, card.due_day).cycleStart,
    -1,
  );
  await ensureCardStatement(supabase, {
    householdId,
    card,
    purchaseDate: previousDay,
    today,
  });

  return { statement: open.statement };
}

export function toStatementView(
  statement: CardStatement,
  charges: CardCharge[],
  today: string,
): CardStatementView {
  return {
    ...statement,
    displayStatus: statementDisplayStatus(
      statement.status,
      statement.cycle_start,
      statement.cycle_end,
      today,
    ),
    totalCents: charges.reduce((sum, item) => sum + item.amount_cents, 0),
    charges,
  };
}
