// app/api/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Compatibility: support either session.userId or legacy session.id/sub
  const actorId = String((session as any).userId || (session as any).id || (session as any).sub || "");
  const actorName = String((session as any).username || "");

  if (!actorId || !actorName) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = String(body?.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const { error: updErr } = await sb
    .from("verification_tokens")
    .update({
      decision: "APPROVED",
      decided_by: actorId,
      decided_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // ✅ Audit log is best-effort (don’t break approve if audit insert fails)
  try {
    await sb.from("audit_logs").insert([
      {
        at: new Date().toISOString(),
        actor_id: actorId,
        actor_name: actorName,
        action: "approve_token",
        meta: { token },
      },
    ]);
  } catch {
    // ignore audit failures
  }

  return NextResponse.json({ success: true });
}
