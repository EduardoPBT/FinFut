"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import { createCardCharges } from "@/lib/data/cards";
import { deleteFinanceEntry } from "@/lib/finance/mutations";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { defaultPaidOn } from "@/lib/money/bill-payment";
import { todayISO } from "@/lib/money/competence";
import type { CreditCard } from "@/lib/types";

function revalidateCardPaths() {
  revalidatePath("/");
  revalidatePath("/cartoes", "layout");
  revalidatePath("/configuracoes");
  revalidatePath("/lancamentos");
  revalidatePath("/recorrentes");
  revalidatePath("/analise");
}

export async function createCreditCard(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const closingDay = Number(formData.get("closing_day") ?? 0);
  const dueDay = Number(formData.get("due_day") ?? 0);
  const paymentAccountId = String(formData.get("payment_account_id") ?? "") || null;
  const creditLimit = parseBRLToCents(String(formData.get("credit_limit") ?? "")) || null;

  if (!name || closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
    return { error: "Informe nome, fechamento e vencimento." };
  }

  const { error } = await supabase.from("credit_cards").insert({
    household_id: household.id,
    name,
    closing_day: closingDay,
    due_day: dueDay,
    payment_account_id: paymentAccountId,
    credit_limit_cents: creditLimit,
    active: true,
  });

  if (error) return { error: error.message };
  revalidateCardPaths();
  return { ok: true };
}

export async function updateCreditCard(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const closingDay = Number(formData.get("closing_day") ?? 0);
  const dueDay = Number(formData.get("due_day") ?? 0);
  const paymentAccountId = String(formData.get("payment_account_id") ?? "") || null;
  const creditLimit = parseBRLToCents(String(formData.get("credit_limit") ?? "")) || null;

  if (!id || !name || closingDay < 1 || dueDay < 1) {
    return { error: "Informe nome, fechamento e vencimento." };
  }

  const { error } = await supabase
    .from("credit_cards")
    .update({
      name,
      closing_day: closingDay,
      due_day: dueDay,
      payment_account_id: paymentAccountId,
      credit_limit_cents: creditLimit,
    })
    .eq("id", id)
    .eq("household_id", household.id);

  if (error) return { error: error.message };
  revalidateCardPaths();
  return { ok: true };
}

export async function deleteCreditCard(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase
    .from("credit_cards")
    .update({ active: false })
    .eq("id", id)
    .eq("household_id", household.id);
  revalidateCardPaths();
}

export async function createCardPurchase(formData: FormData) {
  const { household, creditCards } = await loadWorkspace();
  const supabase = await createClient();
  const cardId = String(formData.get("credit_card_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const memberId = String(formData.get("member_id") ?? "") || null;
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const occurredOn = String(formData.get("occurred_on") ?? "") || defaultPaidOn();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const installments = Number(formData.get("installments") ?? 1);
  const card = creditCards.find((item) => item.id === cardId);

  if (!card || !amount || !occurredOn) {
    return { error: "Informe cartão, valor e data." };
  }

  const result = await createCardCharges(supabase, {
    householdId: household.id,
    card,
    categoryId,
    memberId,
    amountCents: amount,
    purchaseDate: occurredOn,
    notes,
    installments,
  });

  if ("error" in result) return { error: result.error };
  revalidateCardPaths();
  return { ok: true };
}

export async function payCardStatement(formData: FormData) {
  const { household, creditCards } = await loadWorkspace();
  const supabase = await createClient();
  const statementId = String(formData.get("statement_id") ?? "");
  const paidOn = String(formData.get("paid_on") ?? "") || defaultPaidOn();

  const { data: statement } = await supabase
    .from("card_statements")
    .select("*")
    .eq("id", statementId)
    .eq("household_id", household.id)
    .single();

  if (!statement) return { error: "Fatura não encontrada." };
  if (statement.status === "paga") return { error: "Essa fatura já foi paga." };
  if (todayISO() < statement.cycle_start) {
    return { error: "Essa fatura ainda não abriu." };
  }

  const card = creditCards.find((item) => item.id === statement.credit_card_id) as CreditCard | undefined;
  if (!card?.payment_account_id) {
    return { error: "Cadastre a conta que paga este cartão." };
  }

  const { data: charges } = await supabase
    .from("card_charges")
    .select("amount_cents")
    .eq("card_statement_id", statementId);

  const total = (charges ?? []).reduce((sum, item) => sum + item.amount_cents, 0);
  if (total <= 0) return { error: "Fatura sem lançamentos." };

  const alreadyPaid = Number(statement.paid_cents ?? 0);
  const remaining = Math.max(0, total - alreadyPaid);
  const requested = parseBRLToCents(String(formData.get("amount") ?? "")) || remaining;
  const payAmount = Math.min(requested, remaining);
  const confirmPartial = String(formData.get("confirm_partial") ?? "") === "on";

  if (payAmount < remaining && !confirmPartial) {
    return {
      error: `Não pague só o mínimo — o rotativo é caro. Pague o total de ${(remaining / 100).toFixed(2)} ou confirme pagamento parcial.`,
    };
  }

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      household_id: household.id,
      account_id: card.payment_account_id,
      amount_cents: payAmount,
      occurred_on: paidOn,
      notes: `Fatura ${card.name}`,
      origin: "app",
      movement_kind: "transferencia",
      statement_payment_id: statementId,
    })
    .select("id")
    .single();

  if (txError || !tx) {
    return { error: txError?.message ?? "Não foi possível debitar a conta." };
  }

  const { error } = await supabase
    .from("card_statements")
    .update({
      status: alreadyPaid + payAmount >= total ? "paga" : statement.status,
      paid_on: alreadyPaid + payAmount >= total ? paidOn : statement.paid_on,
      payment_transaction_id: tx.id,
      paid_cents: alreadyPaid + payAmount,
    })
    .eq("id", statementId)
    .eq("household_id", household.id);

  if (error) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return { error: error.message };
  }

  revalidateCardPaths();
  return { ok: true };
}

export async function unpayCardStatement(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const statementId = String(formData.get("statement_id") ?? "");

  const { data: statement } = await supabase
    .from("card_statements")
    .select("payment_transaction_id, cycle_end")
    .eq("id", statementId)
    .eq("household_id", household.id)
    .single();

  await supabase
    .from("transactions")
    .delete()
    .eq("household_id", household.id)
    .eq("statement_payment_id", statementId);

  await supabase
    .from("card_statements")
    .update({
      status: todayISO() <= (statement?.cycle_end ?? "") ? "aberta" : "fechada",
      paid_on: null,
      payment_transaction_id: null,
      paid_cents: 0,
    })
    .eq("id", statementId)
    .eq("household_id", household.id);

  revalidateCardPaths();
}

export async function deleteCardCharge(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: charge } = await supabase
    .from("card_charges")
    .select("id, bill_instance_id, installment_group_id")
    .eq("id", id)
    .eq("household_id", household.id)
    .single();

  if (charge?.bill_instance_id) {
    await supabase
      .from("bill_instances")
      .update({
        status: "pendente",
        paid_at: null,
        paid_on: null,
        payment_method: null,
        payment_account: null,
        transaction_id: null,
        account_id: null,
        credit_card_id: null,
        card_charge_id: null,
      })
      .eq("id", charge.bill_instance_id)
      .eq("household_id", household.id);
  }

  await deleteFinanceEntry(supabase, household.id, { kind: "charge", id });
  revalidateCardPaths();
}

export async function deleteInstallmentGroup(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const groupId = String(formData.get("group_id") ?? "");
  if (!groupId) return;

  const { data: charges } = await supabase
    .from("card_charges")
    .select("id, bill_instance_id")
    .eq("household_id", household.id)
    .eq("installment_group_id", groupId);

  for (const charge of charges ?? []) {
    if (!charge.bill_instance_id) continue;
    await supabase
      .from("bill_instances")
      .update({
        status: "pendente",
        paid_at: null,
        paid_on: null,
        payment_method: null,
        payment_account: null,
        transaction_id: null,
        account_id: null,
        credit_card_id: null,
        card_charge_id: null,
      })
      .eq("id", charge.bill_instance_id)
      .eq("household_id", household.id);
  }

  await supabase
    .from("card_charges")
    .delete()
    .eq("household_id", household.id)
    .eq("installment_group_id", groupId);
  revalidateCardPaths();
}

