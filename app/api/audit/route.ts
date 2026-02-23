// app/api/audit/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const { data, error } = await sb
    .from("audit_logs")
    .select("id, action, token, staff_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map DB rows -> UI-friendly shape (keeps your existing UI stable)
  const rows =
    (data || []).map((r: any) => ({
      id: r.id,
      at: r.created_at, // ✅ UI expects "at"
      actor_id: r.staff_id, // ✅ UI expects "actor_id"
      actor_name: (r.meta?.username ?? r.meta?.actor_name ?? null) as string | null,
      action: r.action,
      token: r.token ?? null,
      meta: r.meta ?? null,
    })) ?? [];

  return NextResponse.json({ rows });
}
