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

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function dedupeStrings(values) {
  const seen = new Set();
  const out = [];

  for (const value of safeArray(values)) {
    const clean = normalizeString(value);
    if (!clean) continue;

    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }

  return out;
}

function pushCandidate(values, candidate) {
  const clean = normalizeString(candidate);
  if (clean) values.push(clean);
}

async function safeSupabaseRows(queryFactory) {
  try {
    const response = await queryFactory();
    return Array.isArray(response?.data) ? response.data : [];
  } catch {
    return [];
  }
}

async function safeSupabaseSingle(queryFactory) {
  try {
    const response = await queryFactory();
    return response?.data && typeof response.data === "object" ? response.data : null;
  } catch {
    return null;
  }
}

function isClosedLikeStatus(status) {
  const value = normalizeString(status).toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket) {
  return Boolean(normalizeString(ticket?.channel_id || ticket?.discord_thread_id));
}

function shouldHideStaleTicket(ticket) {
  const status = normalizeString(ticket?.status).toLowerCase();
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
    title: ticket?.title || ticket?.channel_name || "Ticket",
    category: ticket?.category || null,
    matched_category_name: ticket?.matched_category_name || null,
    matched_category_slug: ticket?.matched_category_slug || null,
    matched_intake_type: ticket?.matched_intake_type || null,
    status: ticket?.status || "open",
    priority: ticket?.priority || "medium",
    claimed_by: ticket?.claimed_by || null,
    claimed_by_name: ticket?.claimed_by_name || null,
    closed_by: ticket?.closed_by || null,
    closed_reason: ticket?.closed_reason || null,
    created_at: ticket?.created_at || null,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    deleted_at: ticket?.deleted_at || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    transcript_url: ticket?.transcript_url || null,
    source: ticket?.source || null,
    initial_message: ticket?.initial_message || "",
    is_ghost: Boolean(ticket?.is_ghost),
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
      role_ids: [],
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
    sort_order: category?.sort_order ?? null,
  };
}

function sanitizeVerificationFlag(flag) {
  return {
    id: flag?.id || null,
    created_at: flag?.created_at || null,
    score: normalizeNumber(flag?.score, 0),
    flagged: Boolean(flag?.flagged),
    reasons: Array.isArray(flag?.reasons) ? flag.reasons : [],
    note: flag?.note || flag?.reason || "",
    raw: flag || {},
  };
}

function sanitizeVcSession(row) {
  return {
    id: row?.id || null,
    token: row?.token || null,
    status: normalizeString(row?.status || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    accepted_at: row?.accepted_at || null,
    completed_at: row?.completed_at || null,
    canceled_at: row?.canceled_at || null,
    staff_id: row?.staff_id || null,
    staff_name: row?.staff_name || null,
    ticket_id: row?.ticket_id || null,
    access_minutes: normalizeNumber(row?.access_minutes, 0),
    raw: row || {},
  };
}

function sanitizeJoinRow(row) {
  return {
    id: row?.id || null,
    joined_at: row?.joined_at || row?.created_at || null,
    join_source: row?.join_source || row?.entry_method || row?.source || null,
    entry_method: row?.entry_method || row?.join_source || row?.source || null,
    invite_code: row?.invite_code || null,
    inviter_id: row?.inviter_id || row?.invited_by || null,
    inviter_name: row?.inviter_name || row?.invited_by_name || null,
    vanity_used: Boolean(row?.vanity_used),
    raw: row || {},
  };
}

function sanitizeVouchRow(row) {
  return {
    id: row?.id || null,
    created_at: row?.created_at || null,
    actor_id:
      row?.actor_id ||
      row?.author_id ||
      row?.voucher_id ||
      row?.giver_id ||
      null,
    actor_name:
      row?.actor_name ||
      row?.author_name ||
      row?.voucher_name ||
      row?.giver_name ||
      null,
    target_user_id:
      row?.target_user_id ||
      row?.user_id ||
      row?.member_id ||
      row?.recipient_id ||
      null,
    reason: row?.reason || row?.message || row?.note || "",
    raw: row || {},
  };
}

function sanitizeHistoryRow(row) {
  return {
    id: row?.id || null,
    created_at: row?.created_at || row?.updated_at || null,
    username:
      row?.username ||
      row?.new_username ||
      row?.old_username ||
      null,
    display_name:
      row?.display_name ||
      row?.new_display_name ||
      row?.old_display_name ||
      row?.global_name ||
      null,
    nickname:
      row?.nickname ||
      row?.new_nickname ||
      row?.old_nickname ||
      null,
    raw: row || {},
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
  return safeSupabaseSingle(() =>
    supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .maybeSingle()
  );
}

async function loadTicketCategories(supabase, guildId) {
  const rows = await safeSupabaseRows(() =>
    supabase
      .from("ticket_categories")
      .select("*")
      .eq("guild_id", guildId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  );

  return rows.map(sanitizeCategory);
}

async function loadVerificationFlags(supabase, guildId, discordId) {
  const candidateTables = ["verification_flags", "member_flags", "user_flags"];

  for (const tableName of candidateTables) {
    const rows = await safeSupabaseRows(() =>
      supabase
        .from(tableName)
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", discordId)
        .order("created_at", { ascending: false })
        .limit(20)
    );

    if (rows.length) {
      return rows.map(sanitizeVerificationFlag);
    }
  }

  return [];
}

async function loadVcSessions(supabase, discordId) {
  const numericId = normalizeNumber(discordId, 0);
  if (!numericId) return [];

  const rows = await safeSupabaseRows(() =>
    supabase
      .from("vc_verify_sessions")
      .select("*")
      .eq("owner_id", numericId)
      .order("created_at", { ascending: false })
      .limit(20)
  );

  return rows.map(sanitizeVcSession);
}

async function loadJoinHistory(supabase, guildId, discordId) {
  const candidateTables = ["member_joins", "join_history", "guild_member_joins"];

  for (const tableName of candidateTables) {
    const rows = await safeSupabaseRows(() =>
      supabase
        .from(tableName)
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", discordId)
        .order("joined_at", { ascending: false })
        .limit(10)
    );

    if (rows.length) {
      return rows.map(sanitizeJoinRow);
    }
  }

  return [];
}

async function loadUsernameHistory(supabase, guildId, discordId) {
  const candidateTables = [
    "username_history",
    "member_username_history",
    "member_name_history",
    "guild_member_history",
  ];

  for (const tableName of candidateTables) {
    const rows = await safeSupabaseRows(() =>
      supabase
        .from(tableName)
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", discordId)
        .order("created_at", { ascending: false })
        .limit(30)
    );

    if (rows.length) {
      return rows.map(sanitizeHistoryRow);
    }
  }

  return [];
}

async function loadVouches(supabase, guildId, discordId) {
  const candidateQueries = [
    () =>
      supabase
        .from("vouches")
        .select("*")
        .eq("guild_id", guildId)
        .eq("target_user_id", discordId)
        .order("created_at", { ascending: false })
        .limit(30),
    () =>
      supabase
        .from("vouches")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", discordId)
        .order("created_at", { ascending: false })
        .limit(30),
    () =>
      supabase
        .from("member_vouches")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", discordId)
        .order("created_at", { ascending: false })
        .limit(30),
    () =>
      supabase
        .from("vouch_events")
        .select("*")
        .eq("guild_id", guildId)
        .eq("target_user_id", discordId)
        .order("created_at", { ascending: false })
        .limit(30),
  ];

  for (const queryFactory of candidateQueries) {
    const rows = await safeSupabaseRows(queryFactory);
    if (rows.length) {
      return rows.map(sanitizeVouchRow);
    }
  }

  return [];
}

function deriveHistoricalUsernames({ member, viewer, usernameHistory, joinHistory, recentTickets }) {
  const candidates = [];

  pushCandidate(candidates, member?.username);
  pushCandidate(candidates, member?.display_name);
  pushCandidate(candidates, member?.nickname);
  pushCandidate(candidates, viewer?.username);
  pushCandidate(candidates, viewer?.global_name);

  for (const row of safeArray(usernameHistory)) {
    pushCandidate(candidates, row?.username);
    pushCandidate(candidates, row?.display_name);
    pushCandidate(candidates, row?.nickname);

    const raw = safeObject(row?.raw);
    pushCandidate(candidates, raw?.old_username);
    pushCandidate(candidates, raw?.new_username);
    pushCandidate(candidates, raw?.old_display_name);
    pushCandidate(candidates, raw?.new_display_name);
    pushCandidate(candidates, raw?.old_nickname);
    pushCandidate(candidates, raw?.new_nickname);
  }

  for (const row of safeArray(joinHistory)) {
    const raw = safeObject(row?.raw);
    pushCandidate(candidates, raw?.username);
    pushCandidate(candidates, raw?.display_name);
    pushCandidate(candidates, raw?.nickname);
  }

  for (const ticket of safeArray(recentTickets)) {
    pushCandidate(candidates, ticket?.title);
  }

  return dedupeStrings(candidates).slice(0, 25);
}

function buildTicketSummary(recentTickets) {
  const statusCounts = {};
  const priorityCounts = {};
  const categoryCounts = {};

  for (const ticket of safeArray(recentTickets)) {
    const status = normalizeString(ticket?.status || "unknown").toLowerCase() || "unknown";
    const priority = normalizeString(ticket?.priority || "medium").toLowerCase() || "medium";
    const category =
      normalizeString(ticket?.matched_category_slug || ticket?.category || "support").toLowerCase() ||
      "support";

    statusCounts[status] = (statusCounts[status] || 0) + 1;
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  return {
    total: safeArray(recentTickets).length,
    open: (statusCounts.open || 0) + (statusCounts.claimed || 0),
    closed: statusCounts.closed || 0,
    deleted: statusCounts.deleted || 0,
    claimed: statusCounts.claimed || 0,
    status_counts: statusCounts,
    priority_counts: priorityCounts,
    category_counts: categoryCounts,
    latest_ticket_at:
      safeArray(recentTickets)
        .map((ticket) => ticket?.updated_at || ticket?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

function deriveEntry(joinHistory, member) {
  const latestJoin = safeArray(joinHistory).sort(
    (a, b) => parseDateMs(b?.joined_at) - parseDateMs(a?.joined_at)
  )[0] || null;

  return {
    joined_at: latestJoin?.joined_at || member?.joined_at || null,
    join_source: latestJoin?.join_source || latestJoin?.entry_method || null,
    entry_method: latestJoin?.entry_method || latestJoin?.join_source || null,
    invite_code: latestJoin?.invite_code || null,
    inviter_id: latestJoin?.inviter_id || null,
    inviter_name: latestJoin?.inviter_name || null,
    vanity_used: Boolean(latestJoin?.vanity_used),
    raw: latestJoin?.raw || null,
  };
}

function deriveVerificationSummary({ member, verificationFlags, vcSessions, openTicket }) {
  const flags = safeArray(verificationFlags);
  const vc = safeArray(vcSessions);

  let status = "unknown";
  if (member?.has_verified_role || member?.has_secondary_verified_role) {
    status = "verified";
  } else if (member?.has_staff_role) {
    status = "staff";
  } else if (member?.has_unverified) {
    status = "pending";
  } else if (openTicket) {
    status = "in_review";
  }

  return {
    status,
    has_unverified: Boolean(member?.has_unverified),
    has_verified_role: Boolean(member?.has_verified_role),
    has_secondary_verified_role: Boolean(member?.has_secondary_verified_role),
    has_staff_role: Boolean(member?.has_staff_role),
    flag_count: flags.length,
    flagged_count: flags.filter((item) => item?.flagged).length,
    latest_flag_at:
      flags
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
    vc_request_count: vc.length,
    vc_completed_count: vc.filter((item) => item?.completed_at).length,
    vc_latest_status:
      vc
        .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at))[0]?.status || null,
    open_ticket_id: openTicket?.id || null,
  };
}

function buildRelationshipSummary({ vouches, joinHistory }) {
  const entry = deriveEntry(joinHistory, null);

  return {
    invite_code: entry?.invite_code || null,
    inviter_id: entry?.inviter_id || null,
    inviter_name: entry?.inviter_name || null,
    vanity_used: Boolean(entry?.vanity_used),
    vouch_count: safeArray(vouches).length,
    latest_vouch_at:
      safeArray(vouches)
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

function buildStats({ recentTickets, verificationFlags, vcSessions, recentActivity }) {
  return {
    ticket_count: safeArray(recentTickets).length,
    activity_count: safeArray(recentActivity).length,
    verification_flag_count: safeArray(verificationFlags).length,
    vc_session_count: safeArray(vcSessions).length,
    last_activity_at:
      safeArray(recentActivity)
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
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

    const [
      ticketResponse,
      memberRowRaw,
      categories,
      verificationFlags,
      vcSessions,
      joinHistory,
      usernameHistory,
      vouches,
    ] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("guild_id", guildId)
        .eq("user_id", viewer.discord_id)
        .order("updated_at", { ascending: false })
        .limit(50),
      loadMemberRow(supabase, guildId, viewer.discord_id),
      loadTicketCategories(supabase, guildId),
      loadVerificationFlags(supabase, guildId, viewer.discord_id),
      loadVcSessions(supabase, viewer.discord_id),
      loadJoinHistory(supabase, guildId, viewer.discord_id),
      loadUsernameHistory(supabase, guildId, viewer.discord_id),
      loadVouches(supabase, guildId, viewer.discord_id),
    ]);

    if (ticketResponse?.error) {
      return NextResponse.json(
        { ok: false, error: ticketResponse.error.message },
        { status: 500 }
      );
    }

    const member = sanitizeMember(memberRowRaw, viewer);

    const visibleTickets = safeArray(ticketResponse?.data)
      .map((ticket) => ({
        ...ticket,
        priority: ticket?.priority || derivePriority(ticket),
        channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      }))
      .filter((ticket) => !shouldHideStaleTicket(ticket))
      .map(sanitizeUserTicket);

    const recentTickets = sortTickets(visibleTickets, "updated_desc");
    const openTicket =
      recentTickets.find((ticket) =>
        ["open", "claimed"].includes(normalizeString(ticket?.status).toLowerCase())
      ) || null;

    const recentActivity = await fetchRecentTicketEventsForUser(supabase, {
      guildId,
      userId: viewer.discord_id,
      ticketIds: recentTickets.map((ticket) => ticket?.id).filter(Boolean),
      tickets: recentTickets,
      limit: 25,
    });

    const historicalUsernames = deriveHistoricalUsernames({
      member,
      viewer,
      usernameHistory,
      joinHistory,
      recentTickets,
    });

    const entry = deriveEntry(joinHistory, member);
    const ticketSummary = buildTicketSummary(recentTickets);
    const verification = deriveVerificationSummary({
      member,
      verificationFlags,
      vcSessions,
      openTicket,
    });
    const relationships = buildRelationshipSummary({ vouches, joinHistory });
    const stats = buildStats({
      recentTickets,
      verificationFlags,
      vcSessions,
      recentActivity,
    });

    return NextResponse.json(
      {
        ok: true,
        viewer,
        member,
        profile: member,
        entry,
        categories,
        verificationFlags,
        verification,
        vcSessions,
        joinHistory,
        usernameHistory,
        historicalUsernames,
        vouches,
        relationships,
        openTicket,
        recentTickets,
        ticketSummary,
        recentActivity,
        stats,
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
