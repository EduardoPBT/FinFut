#!/usr/bin/env node
/**
 * Smoke test das funcionalidades principais do FinFut.
 * Uso: node scripts/smoke.mjs [--skip-build]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const skipBuild = process.argv.includes("--skip-build");
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const results = [];

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const env = { ...loadEnvFile(".env.local"), ...process.env };

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`[${mark}] ${name}${suffix}`);
}

const isWin = process.platform === "win32";

function runCommand(name, command, args, options = {}) {
  const proc = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin,
    ...options,
  });
  const ok = proc.status === 0;
  const detail = ok
    ? ""
    : (proc.stderr || proc.stdout || `exit ${proc.status}`).trim().split("\n").slice(-3).join(" ");
  record(name, ok, detail);
  return ok;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, json, text };
}

async function checkHttp(name, url, expectStatus, init = {}) {
  try {
    const response = await fetch(url, init);
    const ok = response.status === expectStatus;
    record(name, ok, ok ? `HTTP ${response.status}` : `esperado ${expectStatus}, veio ${response.status}`);
    return ok;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : "fetch falhou");
    return false;
  }
}

async function main() {
  console.log("\n=== FinFut smoke test ===\n");

  runCommand("Unit tests", "npm", ["test"]);
  runCommand("Typecheck", "npx", ["tsc", "--noEmit"]);
  runCommand("Lint", "npm", ["run", "lint"]);

  if (!skipBuild) {
    runCommand("Production build", "npm", ["run", "build"]);
  } else {
    record("Production build", true, "pulado (--skip-build)");
  }

  let devUp = false;
  try {
    const ping = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    devUp = ping.status === 200;
  } catch {
    devUp = false;
  }

  if (!devUp) {
    record("Dev server", false, `${baseUrl} indisponível — suba com npm run dev para testes HTTP`);
  } else {
    record("Dev server", true, baseUrl);

    await checkHttp("GET /login", `${baseUrl}/login`, 200);
    await checkHttp("GET /lancamentos (sem auth)", `${baseUrl}/lancamentos`, 307, {
      redirect: "manual",
    });

    const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
    await checkHttp(
      "POST /api/telegram/webhook (sem segredo)",
      `${baseUrl}/api/telegram/webhook`,
      401,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );

    if (webhookSecret) {
      const chatId = Number(
        String(env.TELEGRAM_CHAT_ID ?? "-5083397589")
          .split(/[,\s]+/)
          .filter(Boolean)[0],
      );
      const updateId = 9_900_000 + Math.floor(Math.random() * 100_000);
      const { response, json } = await fetchJson(`${baseUrl}/api/telegram/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": webhookSecret,
        },
        body: JSON.stringify({
          update_id: updateId,
          message: {
            message_id: updateId,
            date: Math.floor(Date.now() / 1000),
            chat: { id: chatId, type: "group" },
            text: "gastei 12 no mercado no pix",
          },
        }),
      });
      const webhookOk =
        response.status === 200 &&
        json &&
        ("posted" in json || "pending" in json || "duplicate" in json);
      record(
        "POST /api/telegram/webhook (texto)",
        webhookOk,
        webhookOk ? JSON.stringify(json) : `HTTP ${response.status}`,
      );

      const commandId = updateId + 1;
      const command = await fetchJson(`${baseUrl}/api/telegram/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": webhookSecret,
        },
        body: JSON.stringify({
          update_id: commandId,
          message: {
            message_id: commandId,
            date: Math.floor(Date.now() / 1000),
            chat: { id: chatId, type: "group" },
            text: "/mes",
          },
        }),
      });
      record(
        "POST /api/telegram/webhook (/mes)",
        command.response.status === 200 && Boolean(command.json?.command || command.json?.help),
        command.json ? JSON.stringify(command.json) : `HTTP ${command.response.status}`,
      );

      await checkHttp(
        "POST /api/telegram/setup (sem segredo)",
        `${baseUrl}/api/telegram/setup`,
        401,
        { method: "POST" },
      );
    } else {
      record("POST /api/telegram/webhook (texto)", false, "TELEGRAM_WEBHOOK_SECRET ausente");
    }
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    record("Supabase data", false, "URL ou SERVICE_ROLE_KEY ausentes");
  } else {
    const supabase = createClient(supabaseUrl, serviceKey);
    const checks = await Promise.all([
      supabase.from("households").select("id, name, telegram_chat_id").limit(1),
      supabase.from("categories").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase
        .from("income_instances")
        .select("id, transaction_id")
        .eq("status", "recebido")
        .not("transaction_id", "is", null),
      supabase.from("inbound_messages").select("id, parse_status, source").eq("source", "telegram").limit(5),
      supabase.from("telegram_sessions").select("id", { count: "exact", head: true }),
    ]);

    const householdOk = !checks[0].error && (checks[0].data?.length ?? 0) > 0;
    record(
      "Supabase: household",
      householdOk,
      householdOk ? checks[0].data[0].name : checks[0].error?.message,
    );

    const categoriesOk = !checks[1].error && (checks[1].count ?? 0) > 0;
    record("Supabase: categorias", categoriesOk, categoriesOk ? `${checks[1].count} categorias` : checks[1].error?.message);

    const txOk = !checks[2].error;
    record("Supabase: transações", txOk, txOk ? `${checks[2].count ?? 0} lançamentos` : checks[2].error?.message);

    const incomeRows = checks[3].data ?? [];
    const orphanIncome = incomeRows.filter((row) => !row.transaction_id);
    record(
      "Supabase: receitas recebidas ligadas",
      !checks[3].error && orphanIncome.length === 0,
      checks[3].error?.message ?? `${incomeRows.length} instâncias recebidas`,
    );

    const telegramInbound = checks[4].data ?? [];
    const parsedTelegram = telegramInbound.some((row) => row.parse_status === "parsed");
    record(
      "Supabase: inbound Telegram",
      !checks[4].error && telegramInbound.length > 0,
      checks[4].error?.message ??
        `${telegramInbound.length} mensagens (${parsedTelegram ? "com parsed" : "sem parsed"})`,
    );

    record(
      "Supabase: telegram_sessions",
      !checks[5].error,
      checks[5].error?.message ?? "tabela ok",
    );
  }

  const botToken = env.TELEGRAM_BOT_TOKEN;
  const appUrl = (env.APP_URL ?? "").replace(/\/$/, "");
  if (botToken) {
    try {
      const { response, json } = await fetchJson(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const urlOk =
        response.ok &&
        json?.ok &&
        typeof json.result?.url === "string" &&
        json.result.url.includes("/api/telegram/webhook");
      record(
        "Telegram webhook registrado",
        urlOk,
        urlOk
          ? json.result.url
          : json?.description ?? `HTTP ${response.status}`,
      );
      if (appUrl && urlOk) {
        record(
          "Telegram webhook URL = APP_URL",
          json.result.url.startsWith(appUrl),
          `APP_URL=${appUrl}`,
        );
      }
    } catch (error) {
      record("Telegram webhook registrado", false, error instanceof Error ? error.message : "falhou");
    }
  } else {
    record("Telegram webhook registrado", false, "TELEGRAM_BOT_TOKEN ausente");
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n=== Resultado: ${results.length - failed.length}/${results.length} OK ===\n`);
  if (failed.length > 0) {
    console.log("Falhas:");
    for (const item of failed) {
      console.log(`  - ${item.name}${item.detail ? `: ${item.detail}` : ""}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
