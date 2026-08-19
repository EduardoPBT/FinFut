import { addCalendarDays } from "@/lib/money/card-cycle";

export type CashflowEvent = {
  date: string;
  label: string;
  cents: number;
};

export type CashflowDay = {
  date: string;
  projectedCents: number;
  events: CashflowEvent[];
};

export type CashflowProjection = {
  days: CashflowDay[];
  firstNegativeOn: string | null;
  runwayDays: number;
  nextOutflow: CashflowEvent | null;
  shortfallCents: number;
};

export function projectCashflow(params: {
  startBalanceCents: number;
  startDate: string;
  dayCount?: number;
  events: CashflowEvent[];
}): CashflowProjection {
  const dayCount = Math.max(1, params.dayCount ?? 45);
  const byDate = new Map<string, CashflowEvent[]>();
  for (const event of params.events) {
    if (event.date < params.startDate) continue;
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  const days: CashflowDay[] = [];
  let balance = params.startBalanceCents;
  let firstNegativeOn: string | null = null;

  for (let index = 0; index < dayCount; index += 1) {
    const date = addCalendarDays(params.startDate, index);
    const events = byDate.get(date) ?? [];
    balance += events.reduce((sum, event) => sum + event.cents, 0);
    days.push({ date, projectedCents: balance, events });
    if (firstNegativeOn === null && balance < 0) firstNegativeOn = date;
  }

  const nextOutflow =
    params.events
      .filter((event) => event.cents < 0 && event.date >= params.startDate)
      .sort((left, right) => left.date.localeCompare(right.date) || left.cents - right.cents)[0] ??
    null;

  const negativeDay = days.find((item) => item.date === firstNegativeOn);
  const runwayDays = firstNegativeOn
    ? days.findIndex((item) => item.date === firstNegativeOn)
    : dayCount;

  return {
    days,
    firstNegativeOn,
    runwayDays,
    nextOutflow,
    shortfallCents: Math.min(0, negativeDay?.projectedCents ?? 0),
  };
}

export function committedCardCents(
  statements: { displayStatus: string; totalCents: number; paid_cents?: number }[],
) {
  return statements
    .filter((item) => item.displayStatus === "aberta" || item.displayStatus === "futura")
    .reduce((sum, item) => sum + Math.max(0, item.totalCents - (item.paid_cents ?? 0)), 0);
}

export function emergencyMonths(reserveCents: number, essentialMonthlyCents: number) {
  if (essentialMonthlyCents <= 0) return reserveCents > 0 ? 12 : 0;
  return Math.round((reserveCents / essentialMonthlyCents) * 10) / 10;
}

export function cardUtilization(openCents: number, limitCents: number | null) {
  if (!limitCents || limitCents <= 0) return null;
  return Math.min(1, Math.max(0, openCents / limitCents));
}
