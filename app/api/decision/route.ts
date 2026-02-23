// app/api/decision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { postToDiscordWebhook, buildDecisionEmbed } from "@/lib/discordWebhook";
import { notifyBotDecision } from "@/lib/botBridge";

function normalizeDecision(d: string) {
  const s = (d || "").trim().toUpperCase();
  if (!s) return "PENDING";
  if (s === "APPROVE") return "APPROVED";
  if (s === "DENY") return "DENIED";
  if (s === "RESUBMIT") return "RESUBMIT REQUESTED";
  return s;
}

function auditActionFromDecision(decision: string) {
  if (decision.startsWith("APPROVED")) return "approve_token";
  if (decision.startsWith("DENIED")) return "deny_token";
  if (decision.startsWith("RESUBMIT")) return "resubmit_token";
  return "set_decision";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();
  const decision = normalizeDecision(String(body?.decision || ""));
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: rows, error: readErr } = await sb
    .from("verification_tokens")
    .select("*")
    .eq("token", token)
    .limit(1);

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const row: any = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return NextResponse.json({ error: "Token not found" }, { status: 404 });

  const now = new Date().toISOString();
  const isFinal = decision.startsWith("APPROVED") || decision.startsWith("DENIED");

  const { error: updErr } = await sb
    .from("verification_tokens")
    .update({
      decision,
      decided_by: session.userId,
      decided_at: now,
      used: isFinal ? true : false,
      updated_at: now,
    })
    .eq("token", token);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await sb.from("audit_logs").insert([
    {
      action: auditActionFromDecision(decision),
      token,
      staff_id: session.userId,
      meta: {
        staff_username: session.username,
        decision,
        guild_id: row.guild_id ?? null,
        channel_id: row.channel_id ?? null,
        requester_id: row.requester_id ?? row.user_id ?? null,
      },
    },
  ]);

  const webhookUrl = String(row.webhook_url || "").trim();
  let webhookResult: any = null;

  if (webhookUrl) {
    const embed = buildDecisionEmbed({
      decision,
      token,
      staffName: session.username,
      staffId: session.userId,
      userId: row.requester_id ?? row.user_id ?? null,
      channelId: row.channel_id ?? null,
      guildId: row.guild_id ?? null,
    });

    webhookResult = await postToDiscordWebhook(webhookUrl, {
      content: `🧾 **Staff Decision:** \`${decision}\``,
      embeds: [embed],
      allowed_mentions: { parse: [] },
    });
  }

  const botResult = await notifyBotDecision({
    token,
    decision,
    staffId: session.userId,
    staffName: session.username,
  });

  return NextResponse.json({ ok: true, webhook: webhookResult, bot: botResult });
}
