import { parseYearMonth, shiftYearMonth } from "@/lib/money/competence";

export type CardCycle = {
  cycleStart: string;
  cycleEnd: string;
  dueOn: string;
};

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number) {
  const clamped = Math.min(day, lastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

function parseISODate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function addDaysISO(iso: string, days: number) {
  const { year, month, day } = parseISODate(iso);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addCalendarDays(iso: string, days: number) {
  return addDaysISO(iso, days);
}

/** Soma meses no calendário, sem estourar o último dia do mês destino. */
export function addCalendarMonths(isoDateValue: string, months: number) {
  const { year, month, day } = parseISODate(isoDateValue);
  const yearMonth = shiftYearMonth(
    `${year}-${String(month).padStart(2, "0")}`,
    months,
  );
  const target = parseYearMonth(yearMonth);
  return isoDate(target.year, target.month, day);
}

/**
 * Compras de (fechamento+1) do mês anterior até o fechamento do mês corrente
 * entram na fatura que vence no due_day do mês do fechamento.
 */
export function resolveCycle(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): CardCycle {
  const { year, month } = parseISODate(purchaseDate);
  const closingThisMonth = isoDate(year, month, closingDay);

  const closesThisMonth = purchaseDate <= closingThisMonth;
  const cycleEnd = closesThisMonth
    ? closingThisMonth
    : isoDate(
        parseYearMonth(shiftYearMonth(`${year}-${String(month).padStart(2, "0")}`, 1)).year,
        parseYearMonth(shiftYearMonth(`${year}-${String(month).padStart(2, "0")}`, 1)).month,
        closingDay,
      );

  const endParts = parseISODate(cycleEnd);
  const prev = parseYearMonth(
    shiftYearMonth(
      `${endParts.year}-${String(endParts.month).padStart(2, "0")}`,
      -1,
    ),
  );
  const prevClosing = isoDate(prev.year, prev.month, closingDay);
  const cycleStart = addDaysISO(prevClosing, 1);
  const dueOn = isoDate(endParts.year, endParts.month, dueDay);

  return { cycleStart, cycleEnd, dueOn };
}

export function nextCycle(cycle: CardCycle, closingDay: number, dueDay: number): CardCycle {
  return resolveCycle(addDaysISO(cycle.cycleEnd, 1), closingDay, dueDay);
}

/** Parcelas seguem faturas consecutivas a partir da fatura da compra. */
export function installmentCycles(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
  count: number,
) {
  const n = Math.max(1, Math.floor(count));
  const cycles: CardCycle[] = [resolveCycle(purchaseDate, closingDay, dueDay)];
  for (let index = 1; index < n; index += 1) {
    cycles.push(nextCycle(cycles[index - 1], closingDay, dueDay));
  }
  return cycles;
}

export function splitInstallmentAmounts(totalCents: number, count: number) {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, index) =>
    index === n - 1 ? base + remainder : base,
  );
}

export function installmentPurchaseDates(purchaseDate: string, count: number) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, index) => addCalendarMonths(purchaseDate, index));
}

export const INSTALLMENT_PRESETS = [1, 2, 3, 4, 5, 6, 10, 12, 18, 24] as const;

export function clampInstallments(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(24, Math.max(1, Math.floor(value)));
}

export function statementDisplayStatus(
  stored: "aberta" | "fechada" | "paga",
  cycleStart: string,
  cycleEnd: string,
  today: string,
): "aberta" | "fechada" | "paga" | "futura" {
  if (stored === "paga") return "paga";
  if (today < cycleStart) return "futura";
  if (today <= cycleEnd) return "aberta";
  return "fechada";
}

export function statementStatusLabel(
  status: "aberta" | "fechada" | "paga" | "futura",
) {
  if (status === "paga") return "Paga";
  if (status === "fechada") return "Fechada";
  if (status === "futura") return "Futura";
  return "Aberta";
}
