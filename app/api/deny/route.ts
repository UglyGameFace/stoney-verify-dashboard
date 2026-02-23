import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const token = body?.token;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { error } = await sb
    .from("verification_tokens")
    .update({
      decision: "DENIED",
      decided_by: session.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb.from("audit_logs").insert([
    {
      at: new Date().toISOString(),
      actor_id: session.userId,
      actor_name: session.username,
      action: "deny_token",
      meta: { token },
    },
  ]);

  return NextResponse.json({ success: true });
}
