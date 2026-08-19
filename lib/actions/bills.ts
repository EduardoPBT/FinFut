"use server";

import { revalidatePath } from "next/cache";
import { parseBRLToCents } from "@/lib/money/brl";
import {
  buildPaymentNotes,
  defaultPaidOn,
} from "@/lib/money/bill-payment";
import { createCardCharges } from "@/lib/data/cards";
import { loadWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { dueOnForMonth, nowBrasiliaISO, parseYearMonth } from "@/lib/money/competence";
import type { PaymentMethod } from "@/lib/types";

const METHODS = new Set<PaymentMethod>(["pix", "debito", "credito", "boleto", "outro"]);

function revalidateBillPaths() {
  revalidatePath("/");
  revalidatePath("/recorrentes");
  revalidatePath("/lancamentos");
  revalidatePath("/analise");
  revalidatePath("/cartoes", "layout");
}

export async function createRecurringBill(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const dueDay = Number(formData.get("due_day") ?? 1);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const defaultAccountId = String(formData.get("account_id") ?? "") || null;
  const defaultCardId = String(formData.get("credit_card_id") ?? "") || null;
  const defaultMethod = String(formData.get("payment_method") ?? "") as PaymentMethod | "";
  const amountFlexible = String(formData.get("amount_flexible") ?? "") === "on";
  const mes = String(formData.get("mes") ?? "") || undefined;
  const competence = parseYearMonth(mes);

  if (!name || !amount || dueDay < 1 || dueDay > 31) {
    return { error: "Preencha nome, valor e vencimento." };
  }

  const { data, error } = await supabase
    .from("recurring_bills")
    .insert({
      household_id: household.id,
      name,
      amount_cents: amount,
      due_day: dueDay,
      category_id: categoryId,
      active: true,
      default_account_id: defaultAccountId,
      default_credit_card_id: defaultCardId,
      default_payment_method: METHODS.has(defaultMethod as PaymentMethod)
        ? defaultMethod
        : null,
      amount_flexible: amountFlexible,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Não deu para salvar." };

  await supabase.from("bill_instances").upsert(
    {
      household_id: household.id,
      recurring_bill_id: data.id,
      competence: competence.start,
      amount_cents: amount,
      due_on: dueOnForMonth(
        competence.year,
        competence.month,
        dueDay,
        competence.lastDay,
      ),
      status: "pendente",
    },
    { onConflict: "recurring_bill_id,competence" },
  );

  revalidateBillPaths();
  return { ok: true };
}

export async function updateRecurringBill(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const instanceId = String(formData.get("instance_id") ?? "");
  const mes = String(formData.get("mes") ?? "") || undefined;
  const competence = parseYearMonth(mes);
  const name = String(formData.get("name") ?? "").trim();
  const amount = parseBRLToCents(String(formData.get("amount") ?? ""));
  const dueDay = Number(formData.get("due_day") ?? 1);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const defaultAccountId = String(formData.get("account_id") ?? "") || null;
  const defaultCardId = String(formData.get("credit_card_id") ?? "") || null;
  const defaultMethod = String(formData.get("payment_method") ?? "") as PaymentMethod | "";
  const amountFlexible = String(formData.get("amount_flexible") ?? "") === "on";

  if (!id || !name || !amount || dueDay < 1 || dueDay > 31) {
    return { error: "Preencha nome, valor e vencimento." };
  }

  const dueOn = dueOnForMonth(
    competence.year,
    competence.month,
    dueDay,
    competence.lastDay,
  );

  const { error: billError } = await supabase
    .from("recurring_bills")
    .update({
      name,
      due_day: dueDay,
      category_id: categoryId,
      default_account_id: defaultAccountId,
      default_credit_card_id: defaultCardId,
      default_payment_method: METHODS.has(defaultMethod as PaymentMethod)
        ? defaultMethod
        : null,
      amount_flexible: amountFlexible,
      ...(amountFlexible ? {} : { amount_cents: amount }),
    })
    .eq("id", id)
    .eq("household_id", household.id);

  if (billError) return { error: billError.message };

  if (instanceId) {
    await supabase
      .from("bill_instances")
      .update({
        amount_cents: amount,
        due_on: dueOn,
      })
      .eq("id", instanceId)
      .eq("household_id", household.id);
  }

  revalidateBillPaths();
  return { ok: true };
}

export async function markBillPaid(formData: FormData) {
  const { household, bankAccounts, creditCards } = await loadWorkspace();
  const supabase = await createClient();
  const instanceId = String(formData.get("instance_id") ?? "");
  const billName = String(formData.get("bill_name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const amountCents = Number(formData.get("amount_cents") ?? 0);
  const method = String(formData.get("payment_method") ?? "") as PaymentMethod;
  const accountId = String(formData.get("account_id") ?? "") || null;
  const creditCardId = String(formData.get("credit_card_id") ?? "") || null;
  const paidOn = String(formData.get("paid_on") ?? "") || defaultPaidOn();

  if (!instanceId || !METHODS.has(method) || !amountCents) {
    return { error: "Informe como a conta foi paga." };
  }

  const account = bankAccounts.find((item) => item.id === accountId);
  const card = creditCards.find((item) => item.id === creditCardId);
  const destinationLabel =
    method === "credito" ? card?.name : account?.name;

  if (method === "credito") {
    if (!card) return { error: "Escolha o cartão da compra." };
    const charged = await createCardCharges(supabase, {
      householdId: household.id,
      card,
      categoryId,
      memberId: null,
      amountCents,
      purchaseDate: paidOn,
      notes: billName,
      installments: 1,
      billInstanceId: instanceId,
    });
    if ("error" in charged) return { error: charged.error };
    const charge = charged.charges[0];

    const { error } = await supabase
      .from("bill_instances")
      .update({
        status: "pago",
        paid_at: nowBrasiliaISO(),
        paid_on: paidOn,
        payment_method: method,
        payment_account: destinationLabel ?? null,
        transaction_id: null,
        account_id: null,
        credit_card_id: card.id,
        card_charge_id: charge.id,
      })
      .eq("id", instanceId)
      .eq("household_id", household.id);

    if (error) {
      await supabase.from("card_charges").delete().eq("id", charge.id);
      return { error: error.message };
    }

    revalidateBillPaths();
    return { ok: true };
  }

  if (!account) return { error: "Escolha a conta de onde saiu o dinheiro." };
  const notes = buildPaymentNotes(billName, method, destinationLabel);

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      household_id: household.id,
      category_id: categoryId,
      amount_cents: amountCents,
      occurred_on: paidOn,
      notes,
      origin: "app",
      bill_instance_id: instanceId,
      account_id: account.id,
      movement_kind: "despesa",
    })
    .select("id")
    .single();

  if (txError || !tx) {
    return { error: txError?.message ?? "Não foi possível criar o lançamento." };
  }

  const { error } = await supabase
    .from("bill_instances")
    .update({
      status: "pago",
      paid_at: nowBrasiliaISO(),
      paid_on: paidOn,
      payment_method: method,
      payment_account: destinationLabel ?? null,
      transaction_id: tx.id,
      account_id: account.id,
      credit_card_id: null,
      card_charge_id: null,
    })
    .eq("id", instanceId)
    .eq("household_id", household.id);

  if (error) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return { error: error.message };
  }

  revalidateBillPaths();
  return { ok: true };
}

export async function unmarkBillPaid(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const instanceId = String(formData.get("instance_id") ?? "");

  const { data: instance } = await supabase
    .from("bill_instances")
    .select("transaction_id, card_charge_id")
    .eq("id", instanceId)
    .eq("household_id", household.id)
    .single();

  if (instance?.transaction_id) {
    await supabase
      .from("transactions")
      .delete()
      .eq("id", instance.transaction_id)
      .eq("household_id", household.id);
  }

  if (instance?.card_charge_id) {
    await supabase
      .from("card_charges")
      .delete()
      .eq("id", instance.card_charge_id)
      .eq("household_id", household.id);
  }

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
    .eq("id", instanceId)
    .eq("household_id", household.id);

  revalidateBillPaths();
}

export async function deleteRecurringBill(formData: FormData) {
  const { household } = await loadWorkspace();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase
    .from("recurring_bills")
    .delete()
    .eq("id", id)
    .eq("household_id", household.id);
  revalidateBillPaths();
}
