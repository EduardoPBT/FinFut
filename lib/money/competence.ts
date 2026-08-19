const TZ = "America/Sao_Paulo";

/** Converte AAAA-MM-DD em Date ao meio-dia UTC — evita mudar o dia ao formatar. */
function calendarDateUTC(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Timestamp ISO no fuso de Brasília (UTC-3). */
export function nowBrasiliaISO() {
  const local = new Date().toLocaleString("sv-SE", { timeZone: TZ });
  return `${local.replace(" ", "T")}-03:00`;
}

export function currentYearMonth() {
  return todayISO().slice(0, 7);
}

export function parseYearMonth(value?: string | null) {
  const yearMonth =
    value && /^\d{4}-\d{2}$/.test(value) ? value : currentYearMonth();
  const [year, month] = yearMonth.split("-").map(Number);
  const start = `${yearMonth}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
  return { yearMonth, start, end, year, month, lastDay };
}

export function shiftYearMonth(yearMonth: string, delta: number) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dueOnForMonth(
  year: number,
  month: number,
  dueDay: number,
  lastDay: number,
) {
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)));
}

/** Formata data de calendário (AAAA-MM-DD) como DD/MM/AAAA — sem deslocar por fuso. */
export function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function parseDateBR(input: string) {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const utc = calendarDateUTC(iso);
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return iso;
}

export function maskDateBR(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
