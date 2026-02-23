// app/api/timers/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channelId = String(body?.channel_id || body?.channelId || "").trim();
  if (!channelId) return NextResponse.json({ error: "Missing channel_id" }, { status: 400 });

  const { error } = await sb.from("verification_kick_timers").delete().eq("channel_id", channelId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_logs").insert([
    {
      action: "delete_kick_timer",
      token: null,
      staff_id: session.userId,
      meta: { channel_id: channelId, staff_username: session.username },
    },
  ]);

  return NextResponse.json({ success: true });
}
