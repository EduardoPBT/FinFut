import { createHash } from "node:crypto";
import { suggestCategory } from "@/lib/import/categorize";
import type { ImportDecision, PreparedImportLine } from "@/lib/import/types";
import type { ParsedOfxTxn } from "@/lib/ofx/parse";
import type { Category, MovementKind, StatementImportKind } from "@/lib/types";

export type { ImportDecision, PreparedImportLine } from "@/lib/import/types";

export function resolveFitId(txn: ParsedOfxTxn) {
  const fitId = txn.fitId?.trim();
  if (fitId) return fitId;
  const seed = `${txn.occurredOn}|${txn.amountCents}|${txn.description}`;
  return `hash:${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
}

export function looksLikeCardBillPayment(text: string) {
  return /\bfatura\b|\bcart[aã]o\b/i.test(text);
}

export function looksLikeCardPaymentMemo(text: string) {
  return (
    /\b(pagto|pgto|pagamento)\b/i.test(text) && /\b(fatura|cart[aã]o)\b/i.test(text)
  );
}

export function looksLikeCardRefund(text: string) {
  return /\b(estorno|cancelamento|ajuste)\b/i.test(text);
}

function prepareBankLine(txn: ParsedOfxTxn, categories: Category[]): PreparedImportLine {
  const signedCents = txn.amountCents;
  const description = txn.description;
  if (signedCents === 0) {
    return {
      fitId: resolveFitId(txn),
      occurredOn: txn.occurredOn,
      amountCents: 0,
      signedCents,
      description,
      movementKind: "despesa",
      categoryId: null,
      categoryName: null,
      decision: "skip_zero",
      reason: "Valor zerado",
    };
  }

  const isBillPay = looksLikeCardBillPayment(description);
  const movementKind: MovementKind = isBillPay
    ? "transferencia"
    : signedCents > 0
      ? "receita"
      : "despesa";
  const category = suggestCategory(description, categories, movementKind);

  return {
    fitId: resolveFitId(txn),
    occurredOn: txn.occurredOn,
    amountCents: Math.abs(signedCents),
    signedCents,
    description,
    movementKind,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    decision: "import",
    reason: isBillPay ? "Pagamento de fatura entra como transferência" : null,
  };
}

function classifyCardLine(txn: ParsedOfxTxn): {
  decision: ImportDecision;
  reason: string | null;
} {
  if (txn.amountCents === 0) return { decision: "skip_zero", reason: "Valor zerado" };
  const text = `${txn.description} ${txn.trnType}`;
  if (txn.trnType === "PAYMENT" || looksLikeCardPaymentMemo(txn.description)) {
    return { decision: "skip_payment", reason: "Pagamento da fatura no OFX do cartão" };
  }
  if (looksLikeCardRefund(text) || txn.amountCents > 0) {
    return { decision: "skip_refund", reason: "Estorno ou crédito no cartão" };
  }
  return { decision: "import", reason: null };
}

function prepareCardLine(txn: ParsedOfxTxn, categories: Category[]): PreparedImportLine {
  const classified = classifyCardLine(txn);
  const category = suggestCategory(txn.description, categories, "despesa");
  const willImport = classified.decision === "import";
  return {
    fitId: resolveFitId(txn),
    occurredOn: txn.occurredOn,
    amountCents: Math.abs(txn.amountCents),
    signedCents: txn.amountCents,
    description: txn.description,
    movementKind: "despesa",
    categoryId: willImport ? category.categoryId : null,
    categoryName: willImport ? category.categoryName : null,
    decision: classified.decision,
    reason: classified.reason,
  };
}

export function prepareOfxLines(
  kind: StatementImportKind,
  transactions: ParsedOfxTxn[],
  categories: Category[],
  existingFitIds: Set<string>,
): PreparedImportLine[] {
  const prepared =
    kind === "extrato"
      ? transactions.map((txn) => prepareBankLine(txn, categories))
      : recoverUnsignedCardPurchases(
          transactions.map((txn) => prepareCardLine(txn, categories)),
          categories,
        );

  return prepared.map((line) => {
    if (line.decision !== "import") return line;
    if (!existingFitIds.has(line.fitId)) return line;
    return {
      ...line,
      decision: "duplicate" as const,
      reason: "Já importado nesta conta ou cartão",
    };
  });
}

/** Alguns emissores listam compras como CREDIT positivo e sem sinal. */
function recoverUnsignedCardPurchases(
  lines: PreparedImportLine[],
  categories: Category[],
) {
  const importable = lines.filter((line) => line.decision === "import").length;
  if (importable > 0) return lines;

  return lines.map((line) => {
    if (line.decision !== "skip_refund") return line;
    if (looksLikeCardRefund(line.description) || looksLikeCardPaymentMemo(line.description)) {
      return line;
    }
    const category = suggestCategory(line.description, categories, "despesa");
    return {
      ...line,
      decision: "import" as const,
      reason: null,
      categoryId: category.categoryId,
      categoryName: category.categoryName,
    };
  });
}
