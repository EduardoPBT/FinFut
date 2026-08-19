"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { signIn, signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { FluxMascot } from "@/components/mascots/flux";
import { CasaMascot } from "@/components/mascots/casa";
import { SementeMascot } from "@/components/mascots/semente";
import { GlassPanel } from "@/components/ui/glass-panel";

function AuthForm({ mode }: { mode: "in" | "up" }) {
  const action = mode === "in" ? signIn : signUp;
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input
        name="email"
        type="email"
        required
        placeholder="seu e-mail"
        className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
      />
      <input
        name="password"
        type="password"
        required
        minLength={6}
        placeholder="senha"
        className="rounded-2xl bg-white/80 px-4 py-3 outline-none"
      />
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Button type="submit" className="w-full">
        {mode === "in" ? "Entrar na casa" : "Criar a casa"}
      </Button>
    </form>
  );
}

export function LoginScene() {
  const [mode, setMode] = useState<"in" | "up">("in");

  return (
    <div className="relative mx-auto grid min-h-screen w-full max-w-lg place-items-center px-5 py-10">
      <motion.div
        className="pointer-events-none absolute left-4 top-10"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <FluxMascot mood="good" size={120} />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute right-2 top-24"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 3.6, repeat: Infinity }}
      >
        <CasaMascot mood="ok" size={100} />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute bottom-8 left-8"
        animate={{ rotate: [-4, 4, -4] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <SementeMascot progress={0.45} size={110} />
      </motion.div>
      <GlassPanel glow className="relative z-10 w-full p-6">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
          FinFut
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-800">A caixa do casal</h1>
        <p className="mt-2 text-sm text-slate-500">
          Um bolso só, com leveza. Entre para lançar o mês.
        </p>
        <div className="my-5 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${mode === "in" ? "bg-teal-600 text-white" : "bg-white/60 text-slate-600"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${mode === "up" ? "bg-teal-600 text-white" : "bg-white/60 text-slate-600"}`}
          >
            Primeiro acesso
          </button>
        </div>
        <AuthForm mode={mode} />
      </GlassPanel>
    </div>
  );
}
