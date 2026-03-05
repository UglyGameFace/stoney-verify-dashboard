import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE_CANDIDATES = [
  "transcripts",
  "ticket_transcripts",
  "verification_transcripts",
  "sb_transcripts",
  "audit_transcripts",
];

export async function GET() {
  const sb = getSupabaseAdmin();

  // ✅ Null-safe: if env vars missing, don't crash build or runtime.
  if (!sb) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase admin not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).",
        rows: [],
        table: null,
      },
      { status: 200 }
    );
  }

  for (const table of TABLE_CANDIDATES) {
    try {
      const { data, error } = await sb
        .from(table as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error) {
        const rows = (data || []).map((r: any) => ({
          id: r.id ?? null,
          ticket_channel_id: r.ticket_channel_id ?? r.channel_id ?? null,
          ticket_name: r.ticket_name ?? r.channel_name ?? null,
          url: r.url ?? r.html_url ?? r.transcript_url ?? null,
          created_at: r.created_at ?? r.created ?? null,
          meta: r.meta ?? r.data ?? r,
        }));

        return NextResponse.json(
          { ok: true, table, rows },
          { status: 200 }
        );
      }
    } catch {
      // ignore and try next candidate table
    }
  }

  return NextResponse.json(
    { ok: true, table: null, rows: [] },
    { status: 200 }
  );
}
