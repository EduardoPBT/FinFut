import { PageHeader } from "@/components/shell/page-header";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ImportBoard } from "@/components/forms/import-board";
import { loadRecentImports } from "@/lib/data/imports";
import { loadWorkspace } from "@/lib/data/workspace";
import { formatDay } from "@/lib/money/competence";

export default async function ImportacoesPage() {
  const workspace = await loadWorkspace();
  const imports = await loadRecentImports(
    workspace.household.id,
    workspace.bankAccounts,
    workspace.creditCards,
  );

  return (
    <div>
      <PageHeader eyebrow="Arquivo" title="Importações" />
      <ImportBoard accounts={workspace.bankAccounts} cards={workspace.creditCards}>
        <GlassPanel className="min-w-0 p-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">Histórico recente</p>
          {imports.length === 0 ? (
            <p className="text-sm leading-relaxed text-slate-500">
              Ainda não há importações. Envie um OFX ou uma planilha (CSV, XLS, XLSX).
            </p>
          ) : (
            <div className="grid gap-2">
              {imports.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white/55 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.kind === "extrato" ? "Extrato" : "Fatura"} · {item.targetName} ·{" "}
                      {formatDay(item.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">
                    {item.imported_count} novas · {item.skipped_count} puladas
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </ImportBoard>
    </div>
  );
}
