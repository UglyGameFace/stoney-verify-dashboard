// app/api/timers/route.ts
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

  const guildId = (url.searchParams.get("guild_id") || "").trim();
  const ownerId = (url.searchParams.get("owner_id") || "").trim();
  const channelId = (url.searchParams.get("channel_id") || "").trim();

  let q = sb
    .from("verification_kick_timers")
    .select("*")
    .order("started_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (guildId) q = q.eq("guild_id", guildId);
  if (ownerId) q = q.eq("owner_id", ownerId);
  if (channelId) q = q.eq("channel_id", channelId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data: data || [], limit, offset });
}

// Create or update a timer (upsert by channel_id primary key)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const body = await req.json().catch(() => ({}));

  const channel_id = String(body?.channel_id || "").trim();
  const guild_id = String(body?.guild_id || "").trim();
  const owner_id = String(body?.owner_id || "").trim();
  const hours = Number(body?.hours || 0);

  if (!channel_id || !guild_id || !owner_id || !hours || hours < 1) {
    return NextResponse.json(
      { error: "Missing/invalid fields. Required: channel_id, guild_id, owner_id, hours>=1" },
      { status: 400 }
    );
  }

  const startedAt = body?.started_at ? new Date(body.started_at).toISOString() : new Date().toISOString();

  const payload = {
    channel_id,
    guild_id,
    owner_id,
    hours: Math.floor(hours),
    started_at: startedAt,
    started_by: String(body?.started_by || session.userId || "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("verification_kick_timers").upsert(payload, { onConflict: "channel_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ✅ audit_logs (MATCH YOUR SCHEMA)
  // columns: action, token, staff_id, meta, created_at(auto)
  await sb.from("audit_logs").insert([
    {
      action: "timer_upsert",
      token: null,
      staff_id: session.userId,
      meta: {
        staff_username: session.username,
        ...payload,
      },
    },
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });

  const url = new URL(req.url);
  const channel_id = String(url.searchParams.get("channel_id") || "").trim();
  if (!channel_id) return NextResponse.json({ error: "Missing channel_id" }, { status: 400 });

  const { error } = await sb.from("verification_kick_timers").delete().eq("channel_id", channel_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ✅ audit_logs (MATCH YOUR SCHEMA)
  await sb.from("audit_logs").insert([
    {
      action: "timer_delete",
      token: null,
      staff_id: session.userId,
      meta: {
        staff_username: session.username,
        channel_id,
      },
    },
  ]);

  return NextResponse.json({ ok: true });
}
