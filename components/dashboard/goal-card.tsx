"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { contributeGoal } from "@/lib/actions/goals";
import { Amount } from "@/components/ui/amount";
import { SementeMascot } from "@/components/mascots/semente";
import { clampPercent } from "@/lib/money/brl";
import type { BankAccount, Goal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function GoalCard({ goal, accounts }: { goal: Goal; accounts: BankAccount[] }) {
  const progress = clampPercent(goal.current_cents / goal.target_cents);
  const [state, action] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => contributeGoal(formData),
    null,
  );

  return (
    <div className="flex items-center gap-3 rounded-[24px] bg-white/50 p-3">
      <SementeMascot progress={progress} size={92} />
      <div className="flex-1">
        <p className="font-bold text-slate-800">{goal.name}</p>
        <p className="text-sm text-slate-500">
          <Amount cents={goal.current_cents} /> / <Amount cents={goal.target_cents} />
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-sky-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
          />
        </div>
        <form action={action} className="mt-3 grid gap-2">
          <input type="hidden" name="id" value={goal.id} />
          {accounts.length > 0 ? (
            <Select
              name="account_id"
              defaultValue={accounts[0]?.id}
              options={accounts.map((account) => ({ value: account.id, label: account.name }))}
            />
          ) : null}
          <div className="flex gap-2">
            <input
              name="amount"
              placeholder="aportar"
              className="flex-1 rounded-full bg-white/80 px-3 py-2 text-sm outline-none"
            />
            <Button type="submit" className="px-4 py-2">
              +
            </Button>
          </div>
        </form>
        {state?.error ? <p className="mt-1 text-xs text-rose-600">{state.error}</p> : null}
      </div>
    </div>
  );
}
