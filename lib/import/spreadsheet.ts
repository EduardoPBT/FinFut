import { parseOfxDate } from "@/lib/ofx/parse";
import type { ParsedOfx, ParsedOfxTxn } from "@/lib/ofx/parse";

const DATE_HEADER = /data|date|dia|dtposted|compet[eê]ncia/i;
const DESC_HEADER = /descri|hist[oó]rico|memo|nome|estabelecimento|detalhe|lan[cç]amento|title/i;
const AMOUNT_HEADER = /valor|amount|trnamt|quantia|total/i;
const DEBIT_HEADER = /d[eé]bito|sa[ií]da|despesa/i;
const CREDIT_HEADER = /cr[eé]dito|entrada|receita/i;
const TYPE_HEADER = /tipo|nature|c\/d|dc\b/i;

function decodeText(bytes: Uint8Array) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const text = utf8.charCodeAt(0) === 0xfeff ? utf8.slice(1) : utf8;
  if (!text.includes("\uFFFD")) return text;
  return new TextDecoder("windows-1252").decode(bytes);
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvText(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  const first = normalized.split("\n")[0] ?? "";
  const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitCsvLine(line, delimiter));
}

function parseSheetDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const br = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return parseOfxDate(value.replace(/\D/g, "").padEnd(8, "0").slice(0, 8));
}

function parseSheetAmount(raw: string): number | null {
  const value = raw.trim().replace(/[r$\s]/gi, "");
  if (!value) return null;
  const negative = /^\(.*\)$/.test(value) || value.startsWith("-");
  const cleaned = value.replace(/[()]/g, "").replace(/^[+-]/, "");
  if (!cleaned) return null;
  const number =
    cleaned.includes(",") && !cleaned.includes(".")
      ? Number(cleaned.replace(",", "."))
      : cleaned.includes(",") && cleaned.includes(".")
        ? Number(cleaned.replace(/\./g, "").replace(",", "."))
        : Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(number)) return null;
  const cents = Math.round(Math.abs(number) * 100);
  return negative ? -cents : cents;
}

type ColumnMap = {
  date: number;
  desc: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  type: number | null;
};

function headerScore(cell: string) {
  return {
    date: DATE_HEADER.test(cell),
    desc: DESC_HEADER.test(cell) && !DATE_HEADER.test(cell) && !AMOUNT_HEADER.test(cell),
    amount: AMOUNT_HEADER.test(cell) && !DEBIT_HEADER.test(cell) && !CREDIT_HEADER.test(cell),
    debit: DEBIT_HEADER.test(cell),
    credit: CREDIT_HEADER.test(cell),
    type: TYPE_HEADER.test(cell),
  };
}

function mapFromHeader(row: string[]): ColumnMap | null {
  const scores = row.map(headerScore);
  const date = scores.findIndex((item) => item.date);
  const desc = scores.findIndex((item) => item.desc);
  const amount = scores.findIndex((item) => item.amount);
  const debit = scores.findIndex((item) => item.debit);
  const credit = scores.findIndex((item) => item.credit);
  const type = scores.findIndex((item) => item.type);
  if (date < 0 || desc < 0 || (amount < 0 && debit < 0 && credit < 0)) return null;
  return {
    date,
    desc,
    amount: amount >= 0 ? amount : null,
    debit: debit >= 0 ? debit : null,
    credit: credit >= 0 ? credit : null,
    type: type >= 0 ? type : null,
  };
}

function inferColumns(rows: string[][]): ColumnMap | null {
  const width = Math.max(0, ...rows.slice(0, 8).map((row) => row.length));
  if (width < 2) return null;
  let date = -1;
  let desc = -1;
  let amount = -1;
  for (let col = 0; col < width; col += 1) {
    const sample = rows.slice(0, 8).map((row) => row[col] ?? "");
    const dates = sample.filter((cell) => parseSheetDate(cell)).length;
    const amounts = sample.filter((cell) => parseSheetAmount(cell) !== null).length;
    const texts = sample.filter((cell) => cell.length > 2 && parseSheetDate(cell) === null && parseSheetAmount(cell) === null).length;
    if (date < 0 && dates >= 2) date = col;
    else if (amount < 0 && amounts >= 2) amount = col;
    else if (desc < 0 && texts >= 2) desc = col;
  }
  if (date < 0 || desc < 0 || amount < 0) return null;
  return { date, desc, amount, debit: null, credit: null, type: null };
}

function signedFromRow(row: string[], columns: ColumnMap): number | null {
  if (columns.debit != null || columns.credit != null) {
    const debit = parseSheetAmount(row[columns.debit ?? -1] ?? "") ?? 0;
    const credit = parseSheetAmount(row[columns.credit ?? -1] ?? "") ?? 0;
    if (debit === 0 && credit === 0) return null;
    return credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
  }
  const amount = parseSheetAmount(row[columns.amount ?? -1] ?? "");
  if (amount === null) return null;
  const type = (row[columns.type ?? -1] ?? "").toLowerCase();
  if (/cr[eé]dito|entrada|receita|^c$/.test(type)) return Math.abs(amount);
  if (/d[eé]bito|sa[ií]da|despesa|^d$/.test(type)) return -Math.abs(amount);
  return amount;
}

export function rowsToStatement(rows: string[][]): ParsedOfx {
  if (rows.length === 0) {
    throw new Error("A planilha está vazia.");
  }

  const headerMap = mapFromHeader(rows[0] ?? []);
  const dataRows = headerMap ? rows.slice(1) : rows;
  const columns = headerMap ?? inferColumns(dataRows);
  if (!columns) {
    throw new Error("Não achei colunas de data, descrição e valor nesta planilha.");
  }

  const transactions: ParsedOfxTxn[] = [];
  for (const row of dataRows) {
    const occurredOn = parseSheetDate(row[columns.date] ?? "");
    const amountCents = signedFromRow(row, columns);
    const description = (row[columns.desc] ?? "").replace(/\s+/g, " ").trim();
    if (!occurredOn || amountCents === null || !description) continue;
    transactions.push({
      fitId: null,
      occurredOn,
      amountCents,
      trnType: amountCents < 0 ? "DEBIT" : "CREDIT",
      name: description,
      memo: "",
      description: description.slice(0, 200),
    });
  }

  if (transactions.length === 0) {
    throw new Error("Nenhuma movimentação encontrada nesta planilha.");
  }

  return { accountHint: "desconhecido", transactions };
}

export async function parseSpreadsheetBytes(bytes: Uint8Array, fileName: string): Promise<ParsedOfx> {
  if (/\.csv$/i.test(fileName)) {
    return rowsToStatement(parseCsvText(decodeText(bytes)));
  }
  if (!/\.xlsx?$/i.test(fileName)) {
    throw new Error("Use um arquivo OFX, CSV, XLS ou XLSX.");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, { type: "array", raw: false, cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("A planilha não tem abas.");
  const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  return rowsToStatement(
    rows.map((row) => row.map((cell) => (cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? "").trim()))),
  );
}
