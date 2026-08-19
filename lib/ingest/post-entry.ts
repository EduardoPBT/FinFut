import type { SupabaseClient } from "@supabase/supabase-js";
import { createCardCharges } from "@/lib/data/cards";
import type { ClassifiedEntry } from "@/lib/ingest/classify";
import { resolveCategory } from "@/lib/ingest/category-match";
import type {
  BankAccount,
  Category,
  CreditCard,
  Member,
  TransactionOrigin,
} from "@/lib/types";

export async function postClassifiedEntry(
  supabase: SupabaseClient,
  params: {
    householdId: string;
    classified: ClassifiedEntry;
    categories: Category[];
    accounts: BankAccount[];
    cards: CreditCard[];
    members: Member[];
    origin: TransactionOrigin;
    memberHint?: string | null;
  },
) {
  const category = resolveCategory(params.categories, {
    categoryName: params.classified.categoryName,
    label: params.classified.label,
    description: params.classified.description,
  });
  const member = matchMember(params.memberHint, params.members);
  const account = params.accounts[0] ?? null;
  const card = params.cards[0] ?? null;

  if (params.classified.kind === "despesa" && params.classified.paymentMethod === "credito") {
    if (!card) return { error: "Cadastre um cartão para lançar crédito." };
    const charged = await createCardCharges(supabase, {
      householdId: params.householdId,
      card,
      categoryId: category?.id ?? null,
      memberId: member?.id ?? null,
      amountCents: params.classified.amountCents,
      purchaseDate: params.classified.occurredOn,
      notes: params.classified.label ?? (params.origin === "telegram" ? null : params.classified.description),
      installments: params.classified.installments,
    });
    if ("error" in charged) return { error: charged.error };
    return { category, member, card, account: null };
  }

  const movementKind = params.classified.kind === "receita" ? "receita" : "despesa";
  const { error } = await supabase.from("transactions").insert({
    household_id: params.householdId,
    category_id: category?.id ?? null,
    member_id: member?.id ?? null,
    amount_cents: params.classified.amountCents,
    occurred_on: params.classified.occurredOn,
    notes: params.classified.label ?? (params.origin === "telegram" ? null : params.classified.description),
    origin: params.origin,
    account_id: account?.id ?? null,
    movement_kind: movementKind,
  });
  if (error) return { error: error.message };
  return { category, member, card: null, account };
}

function matchMember(hint: string | null | undefined, members: Member[]) {
  if (!hint) return null;
  const needle = hint.toLowerCase();
  return (
    members.find((item) => item.display_name.toLowerCase() === needle) ??
    members.find((item) => needle.includes(item.display_name.toLowerCase())) ??
    null
  );
}
