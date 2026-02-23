import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const TABLE = process.env.KICK_TIMERS_TABLE || "verification_kick_timers";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb.from(TABLE).select("*").order("started_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const channel_id = url.searchParams.get("channel_id");
  if (!channel_id) return NextResponse.json({ ok: false, error: "Missing channel_id" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from(TABLE).delete().eq("channel_id", channel_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
