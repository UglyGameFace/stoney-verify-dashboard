// app/api/audit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "50", 10) || 50));

  const { data, error } = await sb
    .from("audit_logs")
    .select("id, action, token, staff_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return a UI-friendly shape (keeps your existing UI working)
  const rows =
    (data || []).map((r: any) => ({
      id: String(r.id),
      action: String(r.action || ""),
      token: r.token ?? null,
      actor_id: r.staff_id ?? null,
      actor_name: null,
      meta: r.meta ?? null,
      at: r.created_at ?? null,
    })) ?? [];

  return NextResponse.json({ rows });
}
