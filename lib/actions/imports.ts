"use server";

import { revalidatePath } from "next/cache";
import { createCardCharges } from "@/lib/data/cards";
import { loadWorkspace } from "@/lib/data/workspace";
import { refineImportCategories } from "@/lib/import/categorize";
import { parseSpreadsheetBytes } from "@/lib/import/spreadsheet";
import type { PreparedImportLine } from "@/lib/import/types";
import { parseOfxBytes } from "@/lib/ofx/parse";
import { prepareOfxLines, resolveFitId } from "@/lib/ofx/prepare";
import { createClient } from "@/lib/supabase/server";
import type { Category, CreditCard, StatementImportKind } from "@/lib/types";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportPreviewLine = {
  fitId: string;
  occurredOn: string;
  description: string;
  amountCents: number;
  signedCents: number;
  movementKind: PreparedImportLine["movementKind"];
  categoryName: string | null;
  decision: PreparedImportLine["decision"];
  reason: string | null;
};

export type ImportPreviewResult = {
  error?: string;
  kind?: StatementImportKind;
  targetName?: string;
  fileName?: string;
  lines?: ImportPreviewLine[];
  importableCount?: number;
  skippedCount?: number;
  importedCount?: number;
};

function revalidateImportPaths() {
  revalidatePath("/");
  revalidatePath("/importacoes");
  revalidatePath("/lancamentos");
  revalidatePath("/analise");
  revalidatePath("/cartoes", "layout");
}

function asKind(value: string): StatementImportKind | null {
  return value === "extrato" || value === "fatura" ? value : null;
}

async function readStatementFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Envie um arquivo OFX ou uma planilha." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "Arquivo grande demais (máx. 2 MB)." };
  }
  const name = file.name.trim() || "extrato.ofx";
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    if (/\.(ofx|qfx)$/i.test(name) || /<OFX|OFXHEADER|<STMTTRN/i.test(new TextDecoder("ascii", { fatal: false }).decode(bytes.subarray(0, 200)))) {
      return { fileName: name, parsed: parseOfxBytes(bytes) };
    }
    if (/\.(csv|xlsx|xls)$/i.test(name)) {
      return { fileName: name, parsed: await parseSpreadsheetBytes(bytes, name) };
    }
    return { error: "Use um arquivo OFX, CSV, XLS ou XLSX." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao ler o arquivo." };
  }
}

async function prepareImport(
  kind: StatementImportKind,
  parsed: { transactions: Parameters<typeof prepareOfxLines>[1] },
  categories: Category[],
  householdId: string,
  targetId: string,
) {
  const prepared = prepareOfxLines(
    kind,
    parsed.transactions,
    categories,
    await existingFitIds(
      householdId,
      kind,
      targetId,
      parsed.transactions.map(resolveFitId),
    ),
  );
  return refineImportCategories(prepared, categories);
}

async function existingFitIds(
  householdId: string,
  kind: StatementImportKind,
  targetId: string,
  fitIds: string[],
) {
  const supabase = await createClient();
  const found = new Set<string>();
  const column = kind === "extrato" ? "bank_account_id" : "credit_card_id";

  for (let index = 0; index < fitIds.length; index += 100) {
    const slice = fitIds.slice(index, index + 100);
    const { data } = await supabase
      .from("statement_import_lines")
      .select("fit_id")
      .eq("household_id", householdId)
      .eq(column, targetId)
      .in("fit_id", slice);
    for (const row of data ?? []) found.add(row.fit_id);
  }

  return found;
}

function toPreviewLines(lines: PreparedImportLine[]): ImportPreviewLine[] {
  return lines.map((line) => ({
    fitId: line.fitId,
    occurredOn: line.occurredOn,
    description: line.description,
    amountCents: line.amountCents,
    signedCents: line.signedCents,
    movementKind: line.movementKind,
    categoryName: line.categoryName,
    decision: line.decision,
    reason: line.reason,
  }));
}

export async function previewStatementImport(formData: FormData): Promise<ImportPreviewResult> {
  const workspace = await loadWorkspace();
  const kind = asKind(String(formData.get("kind") ?? ""));
  const targetId = String(formData.get("target_id") ?? "");
  if (!kind) return { error: "Escolha se é extrato ou fatura." };

  const target =
    kind === "extrato"
      ? workspace.bankAccounts.find((item) => item.id === targetId)
      : workspace.creditCards.find((item) => item.id === targetId);
  if (!target) {
    return { error: kind === "extrato" ? "Escolha a conta." : "Escolha o cartão." };
  }

  const read = await readStatementFile(formData);
  if ("error" in read) return { error: read.error };

  const prepared = await prepareImport(
    kind,
    read.parsed,
    workspace.categories,
    workspace.household.id,
    target.id,
  );

  const importableCount = prepared.filter((line) => line.decision === "import").length;
  return {
    kind,
    targetName: target.name,
    fileName: read.fileName,
    lines: toPreviewLines(prepared),
    importableCount,
    skippedCount: prepared.length - importableCount,
  };
}

export async function commitStatementImport(formData: FormData): Promise<ImportPreviewResult> {
  const workspace = await loadWorkspace();
  const supabase = await createClient();
  const kind = asKind(String(formData.get("kind") ?? ""));
  const targetId = String(formData.get("target_id") ?? "");
  if (!kind) return { error: "Escolha se é extrato ou fatura." };

  const account = workspace.bankAccounts.find((item) => item.id === targetId) ?? null;
  const card = workspace.creditCards.find((item) => item.id === targetId) ?? null;
  if (kind === "extrato" && !account) return { error: "Escolha a conta." };
  if (kind === "fatura" && !card) return { error: "Escolha o cartão." };

  const read = await readStatementFile(formData);
  if ("error" in read) return { error: read.error };

  const prepared = await prepareImport(
    kind,
    read.parsed,
    workspace.categories,
    workspace.household.id,
    targetId,
  );

  const { data: importRow, error: importError } = await supabase
    .from("statement_imports")
    .insert({
      household_id: workspace.household.id,
      kind,
      bank_account_id: kind === "extrato" ? account?.id ?? null : null,
      credit_card_id: kind === "fatura" ? card?.id ?? null : null,
      file_name: read.fileName,
      imported_count: 0,
      skipped_count: 0,
    })
    .select("id")
    .single();

  if (importError || !importRow) {
    return { error: importError?.message ?? "Não foi possível abrir a importação." };
  }

  let importedCount = 0;
  let skippedCount = 0;

  for (const line of prepared) {
    if (line.decision !== "import") {
      skippedCount += 1;
      continue;
    }

    const posted = await postImportLine(supabase, {
      householdId: workspace.household.id,
      importId: importRow.id,
      kind,
      accountId: account?.id ?? null,
      card,
      line,
    });
    if (posted === "imported") importedCount += 1;
    else skippedCount += 1;
  }

  await supabase
    .from("statement_imports")
    .update({ imported_count: importedCount, skipped_count: skippedCount })
    .eq("id", importRow.id)
    .eq("household_id", workspace.household.id);

  revalidateImportPaths();
  return {
    kind,
    targetName: account?.name ?? card?.name,
    fileName: read.fileName,
    lines: toPreviewLines(
      prepared.map((line) =>
        line.decision === "import"
          ? {
              ...line,
              decision: "duplicate" as const,
              reason: "Já importado nesta conta ou cartão",
            }
          : line,
      ),
    ),
    importableCount: 0,
    importedCount,
    skippedCount,
  };
}

async function postImportLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    householdId: string;
    importId: string;
    kind: StatementImportKind;
    accountId: string | null;
    card: CreditCard | null;
    line: PreparedImportLine;
  },
) {
  let transactionId: string | null = null;
  let cardChargeId: string | null = null;

  if (params.kind === "fatura") {
    if (!params.card) return "skipped";
    const charged = await createCardCharges(supabase, {
      householdId: params.householdId,
      card: params.card,
      categoryId: params.line.categoryId,
      memberId: null,
      amountCents: params.line.amountCents,
      purchaseDate: params.line.occurredOn,
      notes: params.line.description,
      installments: 1,
    });
    if ("error" in charged || !charged.charges[0]) return "skipped";
    cardChargeId = charged.charges[0].id;
  } else {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        household_id: params.householdId,
        category_id: params.line.movementKind === "transferencia" ? null : params.line.categoryId,
        amount_cents: params.line.amountCents,
        occurred_on: params.line.occurredOn,
        notes: params.line.description,
        origin: "ofx",
        account_id: params.accountId,
        movement_kind: params.line.movementKind,
      })
      .select("id")
      .single();
    if (error || !data) return "skipped";
    transactionId = data.id;
  }

  const { error: lineError } = await supabase.from("statement_import_lines").insert({
    household_id: params.householdId,
    statement_import_id: params.importId,
    bank_account_id: params.kind === "extrato" ? params.accountId : null,
    credit_card_id: params.kind === "fatura" ? params.card?.id ?? null : null,
    fit_id: params.line.fitId,
    occurred_on: params.line.occurredOn,
    amount_cents: params.line.amountCents,
    transaction_id: transactionId,
    card_charge_id: cardChargeId,
  });

  if (lineError) {
    if (transactionId) {
      await supabase.from("transactions").delete().eq("id", transactionId).eq("household_id", params.householdId);
    }
    if (cardChargeId) {
      await supabase.from("card_charges").delete().eq("id", cardChargeId).eq("household_id", params.householdId);
    }
    return "skipped";
  }

  return "imported";
}
