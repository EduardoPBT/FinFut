"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  commitStatementImport,
  previewStatementImport,
  type ImportPreviewResult,
} from "@/lib/actions/imports";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Select } from "@/components/ui/select";
import { Amount } from "@/components/ui/amount";
import { formatDay } from "@/lib/money/competence";
import type { BankAccount, CreditCard, StatementImportKind } from "@/lib/types";

function ReadSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full min-w-0">
      {pending ? "Lendo arquivo..." : "Ler arquivo"}
    </Button>
  );
}

function decisionLabel(decision: string) {
  if (decision === "import") return "Entra";
  if (decision === "duplicate") return "Já importado";
  if (decision === "skip_payment") return "Pagamento";
  if (decision === "skip_refund") return "Estorno";
  return "Ignorado";
}

export function ImportBoard({
  accounts,
  cards,
  children,
}: {
  accounts: BankAccount[];
  cards: CreditCard[];
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<StatementImportKind>("extrato");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const targets = kind === "extrato" ? accounts : cards;
  const emptyHint =
    kind === "extrato"
      ? "Cadastre uma conta em Configurações."
      : "Cadastre um cartão em Configurações.";

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <GlassPanel className="min-w-0 overflow-hidden p-5">
          <p className="mb-1 text-sm font-semibold text-slate-700">Nova importação</p>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Prefira OFX. Sem OFX, envie CSV, XLS ou XLSX com data, descrição e valor.
          </p>
          <form
            ref={formRef}
            className="grid min-w-0 gap-3"
            action={async (formData) => {
              setResult(null);
              if (!fileRef.current?.files?.length) {
                setLocalError("Escolha um arquivo OFX ou uma planilha.");
                return;
              }
              setLocalError(null);
              const next = await previewStatementImport(formData);
              setPreview(next);
            }}
          >
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-600">
              Tipo
              <Select
                name="kind"
                defaultValue="extrato"
                options={[
                  { value: "extrato", label: "Extrato bancário" },
                  { value: "fatura", label: "Fatura de cartão" },
                ]}
                onValueChange={(value) => {
                  setKind(value as StatementImportKind);
                  setPreview(null);
                  setResult(null);
                }}
              />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-600">
              {kind === "extrato" ? "Conta" : "Cartão"}
              <Select
                key={kind}
                name="target_id"
                options={targets.map((item) => ({ value: item.id, label: item.name }))}
                placeholder={emptyHint}
                required
              />
            </label>
            <div className="grid min-w-0 gap-1 text-sm font-medium text-slate-600">
              Arquivo
              <input
                ref={fileRef}
                type="file"
                name="file"
                accept=".ofx,.qfx,.csv,.xls,.xlsx,application/x-ofx,application/ofx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(event) => {
                  setFileName(event.target.files?.[0]?.name ?? "");
                  setLocalError(null);
                  setPreview(null);
                  setResult(null);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-left outline-none ring-teal-300 focus:ring-2"
              >
                <span className="min-w-0 truncate text-sm font-normal text-slate-700">
                  {fileName || "OFX, CSV, XLS ou XLSX"}
                </span>
                <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                  Escolher arquivo
                </span>
              </button>
            </div>
            <ReadSubmit />
          </form>
          {localError || preview?.error ? (
            <p className="mt-3 text-sm text-rose-600">{localError ?? preview?.error}</p>
          ) : null}
        </GlassPanel>
        {children}
      </div>

      {preview?.lines ? (
        <GlassPanel className="min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">
                {preview.fileName} · {preview.targetName}
              </p>
              <p className="text-xs text-slate-500">
                {preview.importableCount} novas · {preview.skippedCount} ignoradas
              </p>
            </div>
            <Button
              type="button"
              disabled={busy || !preview.importableCount}
              onClick={async () => {
                const form = formRef.current;
                if (!form) return;
                setBusy(true);
                const next = await commitStatementImport(new FormData(form));
                setBusy(false);
                setResult(next);
                if (!next.error) setPreview(next);
              }}
            >
              {busy
                ? "Lançando..."
                : preview.importableCount
                  ? `Lançar ${preview.importableCount}`
                  : "Nada novo"}
            </Button>
          </div>
          {result?.error ? <p className="mb-3 text-sm text-rose-600">{result.error}</p> : null}
          {result?.importedCount != null && !result.error ? (
            <p className="mb-3 text-sm font-semibold text-teal-700">
              {result.importedCount} lançamentos entraram
              {result.skippedCount ? ` · ${result.skippedCount} pulados` : ""}.
            </p>
          ) : null}
          <div className="grid gap-2">
            {preview.lines.map((line) => (
              <div
                key={`${line.fitId}-${line.occurredOn}`}
                className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-2xl bg-white/55 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{line.description}</p>
                  <p className="text-xs text-slate-500">
                    {formatDay(line.occurredOn)}
                    {line.categoryName ? ` · ${line.categoryName}` : ""}
                    {line.reason ? ` · ${line.reason}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <Amount
                    cents={line.signedCents}
                    tone={
                      line.decision === "import"
                        ? line.movementKind === "receita"
                          ? "income"
                          : "default"
                        : "muted"
                    }
                  />
                  <p className="text-[11px] font-semibold text-slate-500">
                    {decisionLabel(line.decision)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}
