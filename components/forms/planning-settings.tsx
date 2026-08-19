"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  createAnnualEvent,
  deleteAnnualEvent,
  deleteCategoryBudget,
  joinHousehold,
  updateReminderDays,
  upsertCategoryBudget,
} from "@/lib/actions/planning";
import { formatBRLInput } from "@/lib/money/brl";
import type { AnnualEvent, Category, CategoryBudget } from "@/lib/types";

export function PlanningSettings({
  inviteCode,
  reminderDays,
  categories,
  budgets,
  annualEvents,
}: {
  inviteCode: string;
  reminderDays: number;
  categories: Category[];
  budgets: CategoryBudget[];
  annualEvents: AnnualEvent[];
}) {
  const variables = categories.filter((item) => item.kind === "variavel");
  const [joinState, joinAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => joinHousehold(formData),
    null,
  );
  const [reminderState, reminderAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      updateReminderDays(formData),
    null,
  );
  const [budgetState, budgetAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      upsertCategoryBudget(formData),
    null,
  );
  const [eventState, eventAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      createAnnualEvent(formData),
    null,
  );

  return (
    <div className="grid gap-6">
      <div>
        <p className="mb-2 text-sm font-bold text-slate-700">Dois acessos na mesma casa</p>
        <p className="mb-2 text-xs text-slate-500">
          Código para o casal entrar: <strong>{inviteCode}</strong>
        </p>
        <form action={joinAction} className="flex gap-2">
          <input
            name="invite_code"
            placeholder="código da outra casa"
            className="flex-1 rounded-full bg-white/80 px-4 py-2 outline-none"
          />
          <Button type="submit" variant="soft">
            entrar
          </Button>
        </form>
        {joinState?.error ? <p className="mt-1 text-sm text-rose-600">{joinState.error}</p> : null}
      </div>
      <form action={reminderAction} className="flex items-end gap-2">
        <label className="grid flex-1 gap-1 text-sm text-slate-600">
          Avisar vencimentos (dias)
          <input
            name="reminder_days"
            type="number"
            min={1}
            max={14}
            defaultValue={reminderDays}
            className="rounded-full bg-white/80 px-4 py-2 outline-none"
          />
        </label>
        <Button type="submit" variant="ghost">
          ok
        </Button>
      </form>
      {reminderState?.error ? (
        <p className="text-sm text-rose-600">{reminderState.error}</p>
      ) : null}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-700">Tetos variáveis</p>
        <form action={budgetAction} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
          <Select
            name="category_id"
            defaultValue={variables[0]?.id}
            options={variables.map((item) => ({ value: item.id, label: item.name }))}
          />
          <input
            name="limit"
            placeholder="800,00"
            className="rounded-full bg-white/80 px-4 py-2 outline-none"
          />
          <Button type="submit" variant="soft">
            teto
          </Button>
        </form>
        {budgetState?.error ? (
          <p className="mt-1 text-sm text-rose-600">{budgetState.error}</p>
        ) : null}
        <ul className="mt-2 grid gap-1 text-sm text-slate-600">
          {budgets.map((budget) => (
            <li key={budget.id} className="flex justify-between">
              <span>
                {categories.find((item) => item.id === budget.category_id)?.name} ·{" "}
                {formatBRLInput(budget.monthly_limit_cents)}
              </span>
              <form action={deleteCategoryBudget}>
                <input type="hidden" name="id" value={budget.id} />
                <button className="text-xs text-slate-400" type="submit">
                  x
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-slate-700">Eventos anuais</p>
        <form action={eventAction} className="grid gap-2">
          <input name="name" placeholder="13º, IPTU, IPVA" className="rounded-full bg-white/80 px-4 py-2 outline-none" />
          <div className="grid grid-cols-3 gap-2">
            <input name="amount" placeholder="valor" className="rounded-full bg-white/80 px-3 py-2 outline-none" />
            <input name="event_month" type="number" min={1} max={12} defaultValue={12} className="rounded-full bg-white/80 px-3 py-2 outline-none" />
            <Select
              name="kind"
              defaultValue="fixa"
              options={[
                { value: "fixa", label: "Conta" },
                { value: "receita", label: "Receita" },
              ]}
            />
          </div>
          <Button type="submit">criar evento</Button>
        </form>
        {eventState?.error ? (
          <p className="mt-1 text-sm text-rose-600">{eventState.error}</p>
        ) : null}
        <ul className="mt-2 grid gap-1 text-sm text-slate-600">
          {annualEvents.map((event) => (
            <li key={event.id} className="flex justify-between">
              <span>
                {event.name} · mês {event.event_month}
              </span>
              <form action={deleteAnnualEvent}>
                <input type="hidden" name="id" value={event.id} />
                <button className="text-xs text-slate-400" type="submit">
                  x
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
