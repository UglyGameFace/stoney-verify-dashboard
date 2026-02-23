// lib/botBridge.ts
import { mustGet } from "@/lib/env";

type BotDecisionPayload = {
  token: string;
  decision: string; // "APPROVED" | "DENIED" | "RESUBMIT REQUESTED" | etc.
  staffId: string;
  staffName: string;
};

function optionalEnv(key: string) {
  const v = (process.env[key] || "").trim();
  return v || null;
}

export async function notifyBotDecision(payload: BotDecisionPayload) {
  const endpoint = optionalEnv("BOT_ACTIONS_URL");
  const secret = optionalEnv("BOT_ACTIONS_SECRET");

  if (!endpoint) {
    // dashboard still works (supabase + webhook), bot actions just won’t fire yet
    return { ok: false, skipped: true as const, reason: "BOT_ACTIONS_URL not set" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, skipped: false as const, status: res.status, error: text || `http_${res.status}` };
  }

  const text = await res.text().catch(() => "");
  return { ok: true, skipped: false as const, status: res.status, text };
}
