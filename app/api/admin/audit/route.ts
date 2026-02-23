import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const TABLE = process.env.AUDIT_TABLE || "verification_audit_logs";

export async function GET() {
  const sb = supabaseServer();
  // Table may not exist; return empty list without failing deployment
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: true, data: [], warning: error.message });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const row = {
    action: String(body.action || "unknown"),
    actor_discord_id: String(body.actor_discord_id || ""),
    actor_username: String(body.actor_username || ""),
    token: body.token ? String(body.token) : null,
    meta: body.meta ?? {},
    created_at: new Date().toISOString(),
  };
  const sb = supabaseServer();
  const { error } = await sb.from(TABLE).insert(row);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
