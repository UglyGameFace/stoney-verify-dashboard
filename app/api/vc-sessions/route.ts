import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE_CANDIDATES = [
  "vc_sessions",
  "verification_vc_sessions",
  "stoney_vc_sessions",
  "vc_verify_sessions",
];

export async function GET() {
  const sb = getSupabaseAdmin();

  // ✅ Null-safe: do not crash build or runtime if env vars are missing
  if (!sb) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase admin not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).",
        table: null,
        rows: [],
      },
      { status: 200 }
    );
  }

  for (const table of TABLE_CANDIDATES) {
    try {
      const { data, error } = await sb
        .from(table as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);

      if (!error) {
        const rows = (data || []).map((r: any) => ({
          id: r.id ?? null,
          token: r.token ?? null,
          user_id: r.user_id ?? r.requester_id ?? null,
          staff_id: r.staff_id ?? r.started_by ?? null,
          guild_id: r.guild_id ?? null,
          ticket_channel_id: r.ticket_channel_id ?? r.channel_id ?? null,
          vc_channel_id: r.vc_channel_id ?? null,
          status: r.status ?? r.state ?? "active",
          started_at: r.started_at ?? r.created_at ?? null,
          ended_at: r.ended_at ?? null,
          meta: r.meta ?? r,
        }));

        return NextResponse.json({ ok: true, table, rows }, { status: 200 });
      }
    } catch {
      // ignore and try next table name
    }
  }

  // none of the candidate tables exist
  return NextResponse.json({ ok: true, table: null, rows: [] }, { status: 200 });
}
