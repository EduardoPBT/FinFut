import { MonthSwitcher } from "@/components/nav/month-switcher";

export function PageHeader({
  eyebrow,
  title,
  yearMonth,
}: {
  eyebrow: string;
  title: string;
  yearMonth?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-800">
          {title}
        </h1>
      </div>
      {yearMonth ? <MonthSwitcher yearMonth={yearMonth} /> : null}
    </header>
  );
}
