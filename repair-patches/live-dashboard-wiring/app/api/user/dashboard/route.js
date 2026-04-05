import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { derivePriority, sortTickets } from "@/lib/priority";
import { env } from "@/lib/env";
import { fetchRecentTicketEventsForUser } from "@/lib/ticketEventFeed";

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

function sanitizeMember(memberRow, viewer) {
  if (!memberRow) {
    return {
      guild_id: viewer?.guild_id || null,
      user_id: viewer?.discord_id || null,
      username: viewer?.username || "Member",
      display_name: viewer?.global_name || viewer?.username || "Member",
      avatar_url: viewer?.avatar_url || null,
      joined_at: null,
      role_names: [],
      has_unverified: false,
      has_verified_role: false,
      has_staff_role: false,
      has_secondary_verified_role: false,
      role_state: "unknown",
      role_state_reason: "Member row not found in guild_members.",
    };
  }

  return {
    guild_id: memberRow?.guild_id || null,
    user_id: memberRow?.user_id || null,
    username: memberRow?.username || viewer?.username || "Member",
    display_name:
      memberRow?.display_name ||
      memberRow?.nickname ||
      viewer?.global_name ||
      viewer?.username ||
      "Member",
    nickname: memberRow?.nickname || null,
    avatar_url: memberRow?.avatar_url || viewer?.avatar_url || null,
    joined_at: memberRow?.joined_at || null,
    role_names: Array.isArray(memberRow?.role_names) ? memberRow.role_names : [],
    role_ids: Array.isArray(memberRow?.role_ids) ? memberRow.role_ids : [],
    has_unverified: Boolean(memberRow?.has_unverified),
    has_verified_role: Boolean(memberRow?.has_verified_role),
    has_staff_role: Boolean(memberRow?.has_staff_role),
    has_secondary_verified_role: Boolean(memberRow?.has_secondary_verified_role),
    role_state: memberRow?.role_state || "unknown",
    role_state_reason: memberRow?.role_state_reason || "",
  };
}

function sanitizeCategory(category) {
  return {
    id: category?.id || null,
    name: category?.name || "Support",
    slug: category?.slug || "support",
    description: category?.description || "",
    intake_type: category?.intake_type || "general",
    button_label:
      category?.button_label ||
      `Open ${String(category?.name || "Support").trim()} Ticket`,
    is_default: Boolean(category?.is_default),
  };
}

function deriveViewerFromSession(session, guildId) {
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

  const globalName = normalizeString(
    session?.user?.global_name ||
      session?.user?.display_name ||
      session?.discordUser?.global_name ||
      username
  );

  const avatarUrl = normalizeString(
    session?.user?.avatar_url ||
      session?.user?.avatar ||
      session?.user?.image ||
      session?.user?.picture ||
      session?.discordUser?.avatar_url ||
      ""
  );

  return {
    discord_id: discordId,
    username,
    global_name: globalName || username,
    avatar_url: avatarUrl || null,
    isStaff: Boolean(session?.isStaff),
    guild_id: guildId || null,
  };
}

async function loadMemberRow(supabase, guildId, discordId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", discordId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data || null;
}

async function loadTicketCategories(supabase, guildId) {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("guild_id", guildId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return Array.isArray(data) ? data.map(sanitizeCategory) : [];
}

async function loadVerificationFlags(supabase, guildId, discordId) {
  const candidateTables = [
    "verification_flags",
    "member_flags",
    "user_flags",
  ];

  for (const tableName of candidateTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", discordId)
        .order("created_at", { ascending: false });

      if (!error) {
        return Array.isArray(data) ? data : [];
      }
    } catch {
      // try next candidate table
    }
  }

  return [];
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

    const guildId = normalizeString(env.guildId);

    if (!guildId) {
      return NextResponse.json(
        { ok: false, error: "Missing guild id." },
        { status: 500 }
      );
    }

    const viewer = deriveViewerFromSession(session, guildId);

    if (!viewer.discord_id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase();

    const [ticketResult, memberRow, categories, verificationFlags] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", viewer.discord_id)
        .order("updated_at", { ascending: false })
        .limit(25),
      loadMemberRow(supabase, guildId, viewer.discord_id),
      loadTicketCategories(supabase, guildId),
      loadVerificationFlags(supabase, guildId, viewer.discord_id),
    ]);

    const { data: ticketRows, error: ticketError } = ticketResult;

    if (ticketError) {
      return NextResponse.json(
        { ok: false, error: ticketError.message },
        { status: 500 }
      );
    }

    const visibleTickets = (ticketRows || [])
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

    const recentActivity = await fetchRecentTicketEventsForUser(supabase, {
      guildId,
      userId: viewer.discord_id,
      ticketIds: recentTickets.map((ticket) => ticket?.id).filter(Boolean),
      limit: 20,
    });

    const member = sanitizeMember(memberRow, viewer);

    return NextResponse.json(
      {
        ok: true,
        viewer,
        member,
        categories,
        verificationFlags,
        openTicket,
        recentTickets,
        recentActivity,
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
