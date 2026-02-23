// app/api/deny/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbMaybe = getSupabaseAdmin();
  if (sbMaybe == null) {
    // ✅ IMPORTANT: must RETURN so TypeScript knows sb is not null below
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  // ✅ Now TS knows this is non-null
  const sb = sbMaybe;

  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const decided_at = new Date().toISOString();

  const { error: updErr } = await sb
    .from("verification_tokens")
    .update({
      decision: "DENIED",
      decided_by: session.userId, // your session type uses userId
      decided_at,
      used: true,
    })
    .eq("token", token);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // audit log (best effort)
  try {
    await sb.from("audit_logs").insert([
      {
        at: decided_at,
        actor_id: session.userId,
        actor_name: session.username,
        action: "deny_token",
        meta: { token },
      },
    ]);
  } catch {
    // ignore audit failures
  }

  return NextResponse.json({ ok: true });
}
