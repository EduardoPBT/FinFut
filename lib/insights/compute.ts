import type { Mood } from "@/lib/types";
import { formatBRL } from "@/lib/money/brl";

export type InsightInput = {
  plannedFixedIncomeCents: number;
  variableIncomeCents: number;
  fixedBillsCents: number;
  fixedPaidCents: number;
  variableSpentCents: number;
  variableByCategory: { name: string; cents: number }[];
  goalsRemainingCents: number;
  savedCents?: number;
  envelopes?: { name: string; spentCents: number; limitCents: number }[];
};

export type CoupleInsights = {
  totalIncomeCents: number;
  fixedIncomeCents: number;
  variableIncomeCents: number;
  remainingCents: number;
  fixedCents: number;
  variableCents: number;
  fixedShare: number;
  variableShare: number;
  leak: { name: string; cents: number; share: number } | null;
  suggestedReserveCents: number;
  suggestedInvestCents: number;
  unpaidFixedCents: number;
  mood: Mood;
  headlines: string[];
  envelopes: { name: string; spentCents: number; limitCents: number }[];
  envelopeAlerts: { name: string; spentCents: number; limitCents: number }[];
};

export function computeInsights(input: InsightInput): CoupleInsights {
  const totalIncomeCents =
    input.plannedFixedIncomeCents + input.variableIncomeCents;
  const remainingCents =
    totalIncomeCents -
    input.fixedBillsCents -
    input.variableSpentCents -
    (input.savedCents ?? 0);
  const unpaidFixedCents = Math.max(
    0,
    input.fixedBillsCents - input.fixedPaidCents,
  );
  const fixedShare =
    totalIncomeCents > 0 ? input.fixedBillsCents / totalIncomeCents : 0;
  const variableShare =
    totalIncomeCents > 0 ? input.variableSpentCents / totalIncomeCents : 0;

  const envelopes = input.envelopes ?? [];
  const envelopeAlerts = envelopes.filter((item) => item.spentCents > item.limitCents);

  const variableTotal = input.variableSpentCents;
  const top = [...input.variableByCategory].sort((a, b) => b.cents - a.cents)[0];
  const leak =
    envelopeAlerts[0]
      ? {
          name: envelopeAlerts[0].name,
          cents: envelopeAlerts[0].spentCents - envelopeAlerts[0].limitCents,
          share:
            envelopeAlerts[0].limitCents > 0
              ? envelopeAlerts[0].spentCents / envelopeAlerts[0].limitCents
              : 1,
        }
      : top && variableTotal > 0 && top.cents / variableTotal >= 0.35
        ? { name: top.name, cents: top.cents, share: top.cents / variableTotal }
        : null;

  const positiveRemainder = Math.max(0, remainingCents);
  const suggestedReserveCents = Math.round(positiveRemainder * 0.6);
  const suggestedInvestCents = positiveRemainder - suggestedReserveCents;

  let mood: Mood = "empty";
  if (totalIncomeCents > 0 || input.variableSpentCents > 0) {
    if (remainingCents > totalIncomeCents * 0.2) mood = "good";
    else if (remainingCents >= 0) mood = "ok";
    else mood = "tight";
  }

  const headlines = buildHeadlines({
    totalIncomeCents,
    remainingCents,
    fixedShare,
    leak,
    unpaidFixedCents,
    suggestedReserveCents,
    suggestedInvestCents,
    goalsRemainingCents: input.goalsRemainingCents,
    envelopeAlerts,
  });

  return {
    totalIncomeCents,
    fixedIncomeCents: input.plannedFixedIncomeCents,
    variableIncomeCents: input.variableIncomeCents,
    remainingCents,
    fixedCents: input.fixedBillsCents,
    variableCents: input.variableSpentCents,
    fixedShare,
    variableShare,
    leak,
    suggestedReserveCents,
    suggestedInvestCents,
    unpaidFixedCents,
    mood,
    headlines,
    envelopes,
    envelopeAlerts,
  };
}

function buildHeadlines(params: {
  totalIncomeCents: number;
  remainingCents: number;
  fixedShare: number;
  leak: CoupleInsights["leak"];
  unpaidFixedCents: number;
  suggestedReserveCents: number;
  suggestedInvestCents: number;
  goalsRemainingCents: number;
  envelopeAlerts: { name: string; spentCents: number; limitCents: number }[];
}) {
  const lines: string[] = [];

  if (params.totalIncomeCents === 0) {
    lines.push("Cadastrem os dois salários para o mês ganhar forma.");
    return lines;
  }

  if (params.fixedShare > 0.7) {
    lines.push("As contas fixas estão comendo mais de 70% da renda.");
  } else if (params.fixedShare > 0) {
    lines.push(
      `As fixas ocupam ${Math.round(params.fixedShare * 100)}% da renda do casal.`,
    );
  }

  if (params.envelopeAlerts[0]) {
    const alert = params.envelopeAlerts[0];
    lines.push(
      `Faltam ${formatBRL(alert.spentCents - alert.limitCents)} no envelope ${alert.name}.`,
    );
  } else if (params.leak) {
    lines.push(
      `${params.leak.name} leva ${Math.round(params.leak.share * 100)}% das variáveis — vale olhar com carinho.`,
    );
  }

  if (params.unpaidFixedCents > 0) {
    lines.push("Ainda há contas da casa em aberto neste mês.");
  }

  if (params.remainingCents > 0 && params.goalsRemainingCents > 0) {
    lines.push("Sobrou fôlego: plante na reserva antes de espalhar o resto.");
  } else if (params.remainingCents > 0) {
    lines.push("Sobrou fôlego: parte para objetivos, parte para aportar.");
  } else if (params.remainingCents < 0) {
    lines.push("O mês está no vermelho — o envelope variável precisa de um freio.");
  }

  return lines.slice(0, 3);
}
