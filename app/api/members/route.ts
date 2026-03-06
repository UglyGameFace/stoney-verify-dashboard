import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guild_id") || session.guildId || "").trim();
  const roleState = String(url.searchParams.get("role_state") || "").trim().toLowerCase();
  const search = String(url.searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 250)));

  let query = sb
    .from("guild_members")
    .select("*")
    .order("display_name", { ascending: true })
    .limit(limit);

  if (guildId) query = query.eq("guild_id", guildId);
  if (roleState) query = query.eq("role_state", roleState);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data || [];

  if (search) {
    rows = rows.filter((row: any) => {
      const hay = [
        row.user_id,
        row.username,
        row.display_name,
        row.role_state,
        row.role_state_reason,
        ...(Array.isArray(row.role_names) ? row.role_names : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(search);
    });
  }

  return NextResponse.json({ ok: true, rows, total: rows.length });
}
