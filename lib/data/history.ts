import { insightsFromMonth } from "@/lib/data/insights";
import { fetchMonthData } from "@/lib/data/month";
import { createClient } from "@/lib/supabase/server";
import { parseYearMonth, shiftYearMonth, todayISO } from "@/lib/money/competence";
import type { Category } from "@/lib/types";

export async function loadSixMonthTrend(
  householdId: string,
  categories: Category[],
  yearMonth: string,
) {
  const supabase = await createClient();
  const today = todayISO();
  const months = Array.from({ length: 6 }, (_, index) =>
    parseYearMonth(shiftYearMonth(yearMonth, index - 5)),
  );

  const series = await Promise.all(
    months.map(async (competence) => {
      const month = await fetchMonthData(supabase, householdId, competence, today);
      const insights = insightsFromMonth({
        incomeSources: month.incomeSources,
        incomeInstances: month.incomeInstances,
        categories,
        transactions: month.transactions,
        billInstances: month.billInstances,
        cardCharges: month.cardCharges,
        goals: month.goals,
      });
      return {
        yearMonth: competence.yearMonth,
        remainingCents: insights.remainingCents,
        fixedShare: insights.fixedShare,
        variableCents: insights.variableCents,
      };
    }),
  );

  return series;
}
