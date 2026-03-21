import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { derivePriority, sortTickets } from "@/lib/priority";
import { env } from "@/lib/env";

function normalizeString(value) {
  return String(value || "").trim();
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isClosedLikeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket) {
  return Boolean(
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim()
  );
}

function shouldHideStaleTicket(ticket) {
  const status = String(ticket?.status || "").trim().toLowerCase();
  const missingChannel = !hasUsableChannel(ticket);

  if (!missingChannel) return false;
  if (!isClosedLikeStatus(status)) return false;

  const closedAtMs = parseDateMs(ticket?.closed_at);
  const updatedAtMs = parseDateMs(ticket?.updated_at);
  const createdAtMs = parseDateMs(ticket?.created_at);
  const newestMs = Math.max(closedAtMs, updatedAtMs, createdAtMs);
  const ageMs = Date.now() - newestMs;

  return ageMs > 5 * 60 * 1000;
}

function sanitizeUserTicket(ticket) {
  return {
    id: ticket?.id || null,
    title: ticket?.title || "Ticket",
    category: ticket?.category || null,
    matched_category_name: ticket?.matched_category_name || null,
    matched_category_slug: ticket?.matched_category_slug || null,
    matched_intake_type: ticket?.matched_intake_type || null,
    status: ticket?.status || "open",
    priority: ticket?.priority || "medium",
    claimed_by: ticket?.claimed_by || null,
    closed_reason: ticket?.closed_reason || null,
    created_at: ticket?.created_at || null,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
  };
}

function deriveViewerFromSession(session) {
  const discordId = normalizeString(
    session?.user?.discord_id ||
      session?.user?.id ||
      session?.discordUser?.id
  );

  const username = normalizeString(
    session?.user?.username ||
      session?.discordUser?.username ||
      session?.user?.global_name ||
      session?.user?.name ||
      "Member"
  );

  return {
    discordId,
    username,
    isStaff: Boolean(session?.isStaff),
  };
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const viewer = deriveViewerFromSession(session);

    if (!viewer.discordId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const guildId = normalizeString(env.guildId);
    if (!guildId) {
      return NextResponse.json(
        { ok: false, error: "Missing guild id." },
        { status: 500 }
      );
    }

    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", viewer.discordId)
      .order("updated_at", { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const visibleTickets = (data || [])
      .map((ticket) => ({
        ...ticket,
        priority: ticket.priority || derivePriority(ticket),
        channel_id: ticket.channel_id || ticket.discord_thread_id || null,
      }))
      .filter((ticket) => !shouldHideStaleTicket(ticket))
      .map(sanitizeUserTicket);

    const recentTickets = sortTickets(visibleTickets, "updated_desc");
    const openTicket =
      recentTickets.find((ticket) =>
        ["open", "claimed"].includes(String(ticket?.status || "").toLowerCase())
      ) || null;

    return NextResponse.json(
      {
        ok: true,
        openTicket,
        recentTickets,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user dashboard.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
