import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const TOKENS = process.env.TOKENS_TABLE || "verification_tokens";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from(TOKENS)
    .select("token, guild_id, channel_id, requester_id, expires_at, used, submitted, decision, decided_by, decided_at, created_at, webhook_url, submitted_at, ai_status, owner_display_name, owner_username, owner_tag")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  const decision = String(body.decision || "").trim();
  const decided_by = body.decided_by ? String(body.decided_by) : null;
  const used = typeof body.used === "boolean" ? body.used : undefined;

  if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

  const update: any = {};
  if (decision) {
    update.decision = decision;
    update.decided_at = new Date().toISOString();
    update.decided_by = decided_by;
  }
  if (used !== undefined) update.used = used;

  const sb = supabaseServer();
  const { error } = await sb.from(TOKENS).update(update).eq("token", token);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
