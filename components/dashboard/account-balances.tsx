import { Amount } from "@/components/ui/amount";
import { GlassPanel } from "@/components/ui/glass-panel";
import { formatBRL } from "@/lib/money/brl";
import type { BankAccount } from "@/lib/types";

export function AccountBalances({
  items,
}: {
  items: { account: BankAccount; balanceCents: number }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Cadastre uma conta em Configurações.</p>;
  }

  return (
    <div className="grid gap-2">
      {items.map(({ account, balanceCents }) => (
        <div key={account.id} className="flex items-center justify-between rounded-2xl bg-white/55 px-3 py-2">
          <span>
            <span className="block text-sm font-semibold text-slate-800">{account.name}</span>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">{account.kind}</span>
          </span>
          <Amount cents={balanceCents} tone={balanceCents >= 0 ? "good" : "tight"} />
        </div>
      ))}
    </div>
  );
}

export function compactBalanceLabel(items: { account: BankAccount; balanceCents: number }[]) {
  return items.map((item) => `${item.account.name} ${formatBRL(item.balanceCents)}`).join(" · ");
}

export function AccountBalancesCard({
  items,
}: {
  items: { account: BankAccount; balanceCents: number }[];
}) {
  return (
    <GlassPanel className="p-4">
      <p className="mb-3 text-sm font-bold text-slate-700">Saldos</p>
      <AccountBalances items={items} />
    </GlassPanel>
  );
}
