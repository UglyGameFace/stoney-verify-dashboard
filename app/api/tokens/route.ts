// app/api/tokens/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const url = new URL(req.url);

  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  // Optional filters:
  // status=pending|approved|denied|used|submitted
  const status = (url.searchParams.get("status") || "").trim().toLowerCase();
  const guildId = (url.searchParams.get("guild_id") || "").trim();
  const channelId = (url.searchParams.get("channel_id") || "").trim();
  const requesterId = (url.searchParams.get("requester_id") || "").trim();

  let q = sb
    .from("verification_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (guildId) q = q.eq("guild_id", guildId);
  if (channelId) q = q.eq("channel_id", channelId);
  if (requesterId) q = q.eq("requester_id", requesterId);

  // status mapping
  if (status === "pending") q = q.eq("decision", "PENDING");
  if (status === "approved") q = q.eq("decision", "APPROVED");
  if (status === "denied") q = q.eq("decision", "DENIED");
  if (status === "used") q = q.eq("used", true);
  if (status === "submitted") q = q.eq("submitted", true);

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    data: data || [],
    limit,
    offset,
  });
}
