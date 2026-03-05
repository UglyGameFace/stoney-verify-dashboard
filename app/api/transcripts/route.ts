// app/api/transcripts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Best-effort transcript index.
 * Your bot may not store transcripts in Supabase; in that case this returns [].
 */
const TABLE_CANDIDATES = [
  "transcripts",
  "ticket_transcripts",
  "verification_transcripts",
  "stoney_transcripts",
];

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();

  for (const table of TABLE_CANDIDATES) {
    const { data, error } = await sb.from(table as any).select("*").order("created_at", { ascending: false }).limit(200);
    if (!error) {
      const rows = (data || []).map((r: any) => ({
        id: r.id ?? null,
        channel_id: r.channel_id ?? r.channelId ?? null,
        guild_id: r.guild_id ?? r.guildId ?? null,
        ticket_no: r.ticket_no ?? r.ticket_number ?? r.ticket ?? null,
        url: r.url ?? r.link ?? r.html_url ?? null,
        created_at: r.created_at ?? r.at ?? null,
        meta: r,
      }));
      return NextResponse.json({ table, rows });
    }
    const msg = String(error?.message || "");
    if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) continue;
  }

  return NextResponse.json({ rows: [], table: null });
}
