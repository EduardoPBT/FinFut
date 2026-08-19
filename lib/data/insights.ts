import type {
  AnnualEvent,
  BillInstanceView,
  CardCharge,
  Category,
  CategoryBudget,
  Goal,
  IncomeInstanceView,
  IncomeSource,
  Member,
  Transaction,
} from "@/lib/types";
import { computeInsights, type CoupleInsights } from "@/lib/insights/compute";

export type FixedBreakdown = {
  billsTotalCents: number;
  billsPaidCents: number;
  billsUnpaidCents: number;
  /** Fixas já lançadas fora das contas recorrentes (pix, cartão etc.) */
  otherSpentCents: number;
};

export function insightsFromMonth(params: {
  incomeSources: IncomeSource[];
  incomeInstances: IncomeInstanceView[];
  categories: Category[];
  transactions: Transaction[];
  billInstances: BillInstanceView[];
  cardCharges?: CardCharge[];
  goals: Goal[];
  annualEvents?: AnnualEvent[];
  budgets?: CategoryBudget[];
  members?: Member[];
}): CoupleInsights & {
  spentByMember: { name: string; cents: number }[];
  fixedBreakdown: FixedBreakdown;
} {
  const categoryById = new Map(params.categories.map((item) => [item.id, item]));
  const sourceById = new Map(params.incomeSources.map((item) => [item.id, item]));
  const charges = params.cardCharges ?? [];
  const annual = params.annualEvents ?? [];

  const annualIncome = annual
    .filter((item) => item.kind === "receita")
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const annualFixed = annual
    .filter((item) => item.kind !== "receita")
    .reduce((sum, item) => sum + item.amount_cents, 0);

  const plannedFixedIncomeCents =
    params.incomeInstances
      .filter((item) => sourceById.get(item.income_source_id)?.kind === "fixo")
      .reduce((sum, item) => sum + item.amount_cents, 0) + annualIncome;

  const variableIncomeFromInstances = params.incomeInstances
    .filter((item) => sourceById.get(item.income_source_id)?.kind === "variavel")
    .reduce((sum, item) => sum + item.amount_cents, 0);

  const cashTransactions = params.transactions.filter(
    (item) => item.movement_kind !== "transferencia",
  );

  const variableIncomeCents =
    variableIncomeFromInstances +
    cashTransactions
      .filter((item) => {
        if (item.income_instance_id || item.bill_instance_id) return false;
        const category = categoryById.get(item.category_id ?? "");
        return category?.kind === "receita";
      })
      .reduce((sum, item) => sum + item.amount_cents, 0);

  const variableByCategoryMap = new Map<string, number>();
  let variableSpentCents = 0;

  function addVariable(categoryId: string | null, cents: number) {
    const category = categoryById.get(categoryId ?? "");
    if (category?.kind !== "variavel") return;
    variableSpentCents += cents;
    variableByCategoryMap.set(
      category.name,
      (variableByCategoryMap.get(category.name) ?? 0) + cents,
    );
  }

  for (const item of cashTransactions) addVariable(item.category_id, item.amount_cents);
  for (const item of charges) addVariable(item.category_id, item.amount_cents);

  const envelopes = (params.budgets ?? []).map((budget) => {
    const category = categoryById.get(budget.category_id);
    return {
      name: category?.name ?? "Categoria",
      spentCents: variableByCategoryMap.get(category?.name ?? "") ?? 0,
      limitCents: budget.monthly_limit_cents,
    };
  });

  const memberById = new Map((params.members ?? []).map((item) => [item.id, item.display_name]));
  const memberMap = new Map<string, number>();
  function addMember(memberId: string | null, cents: number) {
    const name = memberById.get(memberId ?? "") ?? "casal";
    memberMap.set(name, (memberMap.get(name) ?? 0) + cents);
  }
  for (const item of cashTransactions) {
    if (categoryById.get(item.category_id ?? "")?.kind === "receita") continue;
    addMember(item.member_id, item.amount_cents);
  }
  for (const item of charges) addMember(item.member_id, item.amount_cents);

  const fixedFromCash = cashTransactions
    .filter((item) => categoryById.get(item.category_id ?? "")?.kind === "fixa")
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const fixedFromCharges = charges
    .filter((item) => categoryById.get(item.category_id ?? "")?.kind === "fixa")
    .reduce((sum, item) => sum + item.amount_cents, 0);

  const fixedBillsCents =
    params.billInstances.reduce((sum, item) => sum + item.amount_cents, 0) + annualFixed;
  const fixedPaidCents = params.billInstances
    .filter((item) => item.status === "pago")
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const fixedBillsUnpaidCents = params.billInstances
    .filter((item) => item.status !== "pago")
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const otherFixedSpentCents = fixedFromCash + fixedFromCharges;

  const goalsRemainingCents = params.goals.reduce(
    (sum, goal) => sum + Math.max(0, goal.target_cents - goal.current_cents),
    0,
  );
  const savedCents = params.transactions
    .filter((item) => item.goal_id && item.movement_kind === "transferencia")
    .reduce((sum, item) => sum + item.amount_cents, 0);

  return {
    ...computeInsights({
      plannedFixedIncomeCents,
      variableIncomeCents,
      fixedBillsCents: Math.max(fixedBillsCents, fixedFromCash + fixedFromCharges + annualFixed),
      fixedPaidCents,
      variableSpentCents,
      variableByCategory: [...variableByCategoryMap.entries()].map(
        ([name, cents]) => ({ name, cents }),
      ),
      goalsRemainingCents,
      savedCents,
      envelopes,
    }),
    spentByMember: [...memberMap.entries()].map(([name, cents]) => ({ name, cents })),
    fixedBreakdown: {
      billsTotalCents: fixedBillsCents,
      billsPaidCents: fixedPaidCents,
      billsUnpaidCents: fixedBillsUnpaidCents,
      otherSpentCents: otherFixedSpentCents,
    },
  };
}
