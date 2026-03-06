import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "pending",
  "submitted",
  "approved",
  "denied",
  "resubmit",
  "used",
  "expired",
]);

function normalizeLegacyStatus(row: any) {
  const explicit = String(row?.status || "").trim().toLowerCase();
  if (VALID_STATUSES.has(explicit)) return explicit;

  const decision = String(row?.decision || "").trim().toUpperCase();
  const used = !!row?.used;
  const submitted = !!row?.submitted;
  const expiresAt = row?.expires_at ? new Date(row.expires_at).getTime() : NaN;

  if (decision.startsWith("APPROVED")) return "approved";
  if (decision.startsWith("DENIED")) return "denied";
  if (decision.startsWith("RESUBMIT")) return "resubmit";
  if (submitted) return "submitted";
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) return "expired";
  if (used) return "used";
  return "pending";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase admin not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);

  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const guildId = String(url.searchParams.get("guild_id") || "").trim();
  const channelId = String(url.searchParams.get("channel_id") || "").trim();
  const requesterId = String(url.searchParams.get("requester_id") || "").trim();

  let query = sb
    .from("verification_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (guildId) query = query.eq("guild_id", guildId);
  if (channelId) query = query.eq("channel_id", channelId);
  if (requesterId) query = query.eq("requester_id", requesterId);
  if (VALID_STATUSES.has(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data || []).map((row: any) => ({
    ...row,
    status: normalizeLegacyStatus(row),
  }));

  if (status && !VALID_STATUSES.has(status)) {
    rows = rows.filter((row) => row.status === status);
  }

  return NextResponse.json({
    ok: true,
    rows,
    data: rows,
    limit,
    offset,
  });
}
