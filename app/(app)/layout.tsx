import { AppNav } from "@/components/nav/app-nav";
import { signOut } from "@/lib/actions/auth";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pl-[72px] sm:pl-[88px]">
      <AppNav />
      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-black tracking-[0.2em] text-teal-800">
            FINFUT
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/configuracoes"
              className="rounded-full bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              configurações
            </Link>
            <form action={signOut}>
              <button className="text-xs font-semibold text-slate-500" type="submit">
                sair
              </button>
            </form>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
