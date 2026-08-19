import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig } from "@/lib/telegram/config";
import { registerTelegramWebhook } from "@/lib/telegram/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { webhookSecret } = getTelegramConfig();
  const header = request.headers.get("x-telegram-setup-secret");
  if (!webhookSecret || header !== webhookSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await registerTelegramWebhook();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
