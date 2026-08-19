import type { SupabaseClient } from "@supabase/supabase-js";
import { nowBrasiliaISO } from "@/lib/money/competence";

export type IncomeReceiptInput = {
  householdId: string;
  instanceId: string;
  sourceName: string;
  categoryId: string | null;
  memberId: string | null;
  amountCents: number;
  receivedOn: string;
  accountId?: string | null;
  auto?: boolean;
};

export function pickIncomeReceiptAccountId(
  explicit: string | null | undefined,
  instanceAccountId: string | null | undefined,
  sourceDefaultAccountId: string | null | undefined,
  fallbackAccountId: string | null | undefined,
) {
  return explicit ?? instanceAccountId ?? sourceDefaultAccountId ?? fallbackAccountId ?? null;
}

async function firstActiveAccountId(supabase: SupabaseClient, householdId: string) {
  const { data } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("household_id", householdId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveReceiptAccountId(
  supabase: SupabaseClient,
  householdId: string,
  instanceId: string,
  explicitAccountId?: string | null,
) {
  const { data: instance } = await supabase
    .from("income_instances")
    .select("account_id, income_sources(default_account_id)")
    .eq("id", instanceId)
    .eq("household_id", householdId)
    .maybeSingle();

  const joined = instance?.income_sources;
  const source = (Array.isArray(joined) ? joined[0] : joined) as
    | { default_account_id: string | null }
    | null
    | undefined;

  const fallback = await firstActiveAccountId(supabase, householdId);
  return pickIncomeReceiptAccountId(
    explicitAccountId,
    instance?.account_id,
    source?.default_account_id,
    fallback,
  );
}

/** Corrige receitas já registradas que não debitaram/creditaram a conta bancária. */
export async function repairOrphanIncomeReceiptAccounts(
  supabase: SupabaseClient,
  householdId: string,
) {
  const fallback = await firstActiveAccountId(supabase, householdId);
  const { data: rows } = await supabase
    .from("income_instances")
    .select("id, account_id, transaction_id, income_sources(default_account_id)")
    .eq("household_id", householdId)
    .eq("status", "recebido")
    .not("transaction_id", "is", null);

  for (const row of rows ?? []) {
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, account_id")
      .eq("id", row.transaction_id!)
      .eq("household_id", householdId)
      .maybeSingle();
    if (!tx || tx.account_id) continue;

    const joined = row.income_sources;
    const source = (Array.isArray(joined) ? joined[0] : joined) as
      | { default_account_id: string | null }
      | null
      | undefined;
    const accountId = pickIncomeReceiptAccountId(
      null,
      row.account_id,
      source?.default_account_id,
      fallback,
    );
    if (!accountId) continue;

    await supabase
      .from("transactions")
      .update({ account_id: accountId })
      .eq("id", tx.id)
      .eq("household_id", householdId);

    if (!row.account_id) {
      await supabase
        .from("income_instances")
        .update({ account_id: accountId })
        .eq("id", row.id)
        .eq("household_id", householdId);
    }
  }
}

export async function recordIncomeReceipt(
  supabase: SupabaseClient,
  input: IncomeReceiptInput,
) {
  const { data: existing } = await supabase
    .from("income_instances")
    .select("status, transaction_id")
    .eq("id", input.instanceId)
    .eq("household_id", input.householdId)
    .maybeSingle();

  if (existing?.status === "recebido" && existing.transaction_id) {
    await repairOrphanIncomeReceiptAccounts(supabase, input.householdId);
    return { ok: true as const, transactionId: existing.transaction_id };
  }

  const accountId = await resolveReceiptAccountId(
    supabase,
    input.householdId,
    input.instanceId,
    input.accountId,
  );

  const notes = input.auto
    ? `${input.sourceName} · recebimento automático`
    : `${input.sourceName} · recebimento`;

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      household_id: input.householdId,
      category_id: input.categoryId,
      member_id: input.memberId,
      amount_cents: input.amountCents,
      occurred_on: input.receivedOn,
      notes,
      origin: "app",
      income_instance_id: input.instanceId,
      account_id: accountId,
      movement_kind: "receita",
    })
    .select("id")
    .single();

  if (txError || !tx) {
    if (txError?.code === "23505") {
      const { data: linked } = await supabase
        .from("income_instances")
        .select("transaction_id")
        .eq("id", input.instanceId)
        .eq("household_id", input.householdId)
        .maybeSingle();
      if (linked?.transaction_id) {
        return { ok: true as const, transactionId: linked.transaction_id };
      }
    }
    return { error: txError?.message ?? "Não foi possível criar o lançamento." };
  }

  const { data: updated, error } = await supabase
    .from("income_instances")
    .update({
      status: "recebido",
      received_at: nowBrasiliaISO(),
      received_on: input.receivedOn,
      transaction_id: tx.id,
      account_id: accountId,
    })
    .eq("id", input.instanceId)
    .eq("household_id", input.householdId)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();

  if (error) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return { error: error.message };
  }

  if (!updated) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    const { data: linked } = await supabase
      .from("income_instances")
      .select("transaction_id")
      .eq("id", input.instanceId)
      .eq("household_id", input.householdId)
      .maybeSingle();
    if (linked?.transaction_id) {
      return { ok: true as const, transactionId: linked.transaction_id };
    }
    return { error: "Recebimento já registrado por outra requisição." };
  }

  return { ok: true as const, transactionId: tx.id };
}

export function shouldAutoReceiveIncome(
  kind: "fixo" | "variavel",
  expectedOn: string,
  today: string,
) {
  return kind === "fixo" && expectedOn <= today;
}

export function eventDateForProjection(scheduledOn: string, today: string) {
  return scheduledOn < today ? today : scheduledOn;
}
