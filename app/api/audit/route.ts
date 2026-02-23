// app/api/audit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const url = new URL(req.url);

  // optional query params
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  // Optional filters (safe to ignore if you don’t use them yet)
  const actorId = (url.searchParams.get("actor_id") || "").trim();
  const action = (url.searchParams.get("action") || "").trim();

  let q = sb.from("audit_logs").select("*").order("at", { ascending: false }).range(offset, offset + limit - 1);

  if (actorId) q = q.eq("actor_id", actorId);
  if (action) q = q.eq("action", action);

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: data || [],
    limit,
    offset,
  });
}
