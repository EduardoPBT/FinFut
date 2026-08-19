import { PageHeader } from "@/components/shell/page-header";
import { InboxBoard } from "@/components/forms/inbox-board";
import { loadWorkspace } from "@/lib/data/workspace";
import { loadPlanningExtras } from "@/lib/data/planning";

export default async function EntradaPage() {
  const workspace = await loadWorkspace();
  const extras = await loadPlanningExtras(workspace.household.id);

  return (
    <div>
      <PageHeader eyebrow="Telegram" title="Revisar mensagens" />
      <InboxBoard
        inbound={extras.inbound}
        categories={workspace.categories}
        accounts={workspace.bankAccounts}
        cards={workspace.creditCards}
      />
    </div>
  );
}
