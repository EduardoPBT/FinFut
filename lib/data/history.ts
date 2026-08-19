import { insightsFromMonth } from "@/lib/data/insights";
import { loadMonthData } from "@/lib/data/month";
import { parseYearMonth, shiftYearMonth } from "@/lib/money/competence";
import type { Category } from "@/lib/types";

export async function loadSixMonthTrend(
  householdId: string,
  categories: Category[],
  yearMonth: string,
) {
  const months = Array.from({ length: 6 }, (_, index) =>
    parseYearMonth(shiftYearMonth(yearMonth, index - 5)),
  );

  const series = [];
  for (const competence of months) {
    const month = await loadMonthData(householdId, competence);
    const insights = insightsFromMonth({
      incomeSources: month.incomeSources,
      incomeInstances: month.incomeInstances,
      categories,
      transactions: month.transactions,
      billInstances: month.billInstances,
      cardCharges: month.cardCharges,
      goals: month.goals,
    });
    series.push({
      yearMonth: competence.yearMonth,
      remainingCents: insights.remainingCents,
      fixedShare: insights.fixedShare,
      variableCents: insights.variableCents,
    });
  }
  return series;
}
