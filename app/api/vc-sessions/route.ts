// app/api/vc-sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Best-effort VC sessions API.
 * Your bot's table name can vary by version. We try a few common ones.
 */
const TABLE_CANDIDATES = [
  "vc_sessions",
  "verification_vc_sessions",
  "stoney_vc_sessions",
  "vc_verify_sessions",
];

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();

  for (const table of TABLE_CANDIDATES) {
    const { data, error } = await sb
      .from(table as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);

    if (!error) {
      // normalize a bit
      const rows = (data || []).map((r: any) => ({
        id: r.id ?? r.session_id ?? null,
        guild_id: r.guild_id ?? r.guildId ?? null,
        channel_id: r.channel_id ?? r.channelId ?? null,
        requester_id: r.requester_id ?? r.user_id ?? r.owner_id ?? null,
        started_by: r.started_by ?? r.startedBy ?? null,
        started_at: r.started_at ?? r.startedAt ?? r.created_at ?? null,
        status: r.status ?? r.state ?? null,
        meta: r,
      }));
      return NextResponse.json({ table, rows });
    }

    // If table doesn't exist, Supabase returns a "relation does not exist" style error.
    // Just try the next candidate.
    const msg = String(error?.message || "");
    if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) {
      continue;
    }
  }

  return NextResponse.json({ rows: [], table: null });
}
