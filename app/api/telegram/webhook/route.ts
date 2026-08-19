import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelegramConfig } from "@/lib/telegram/config";
import type { TelegramUpdate } from "@/lib/telegram/client";
import { handleTelegramUpdate } from "@/lib/ingest/telegram-handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { webhookSecret } = getTelegramConfig();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook sem segredo" }, { status: 503 });
  }

  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (header !== webhookSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  try {
    const supabase = createAdminClient();
    const result = await handleTelegramUpdate(supabase, update);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
