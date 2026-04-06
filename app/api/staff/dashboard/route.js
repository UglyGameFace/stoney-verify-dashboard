import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { derivePriority, sortTickets } from "@/lib/priority";
import { env } from "@/lib/env";

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
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

function isClosedLikeStatus(status) {
  const value = normalizeString(status).toLowerCase();
  return value === "closed" || value === "deleted";
}

function isActiveTicketStatus(status) {
  const value = normalizeString(status).toLowerCase();
  return value === "open" || value === "claimed";
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

async function safeSupabaseCount(queryFactory) {
  try {
    const response = await queryFactory();
    return Number(response?.count || 0);
  } catch {
    return 0;
  }
}

function resolveDisplayName(memberRow, fallback = "Unknown") {
  return (
    memberRow?.display_name ||
    memberRow?.nickname ||
    memberRow?.username ||
    fallback
  );
}

function sanitizeCategory(category) {
  return {
    id: category?.id || null,
    name: category?.name || "Support",
    slug: category?.slug || "support",
    color: category?.color || "#45d483",
    description: category?.description || "",
    intake_type: category?.intake_type || "general",
    button_label:
      category?.button_label ||
      `Open ${String(category?.name || "Support").trim()} Ticket`,
    is_default: Boolean(category?.is_default),
    sort_order: category?.sort_order ?? null,
    staff_role_ids: Array.isArray(category?.staff_role_ids)
      ? category.staff_role_ids
      : [],
    staff_role_names: Array.isArray(category?.staff_role_names)
      ? category.staff_role_names
      : [],
    match_keywords: Array.isArray(category?.match_keywords)
      ? category.match_keywords
      : [],
  };
}

function sanitizeRole(role) {
  return {
    id: role?.id || null,
    guild_id: role?.guild_id || null,
    role_id: role?.role_id || null,
    name: role?.name || "Role",
    position: normalizeNumber(role?.position, 0),
    member_count: normalizeNumber(role?.member_count, 0),
  };
}

function sanitizeGuildMember(member) {
  return {
    guild_id: member?.guild_id || null,
    user_id: member?.user_id || null,
    username: member?.username || null,
    display_name: member?.display_name || null,
    nickname: member?.nickname || null,
    avatar_url: member?.avatar_url || null,
    role_ids: Array.isArray(member?.role_ids) ? member.role_ids : [],
    role_names: Array.isArray(member?.role_names) ? member.role_names : [],
    highest_role_id: member?.highest_role_id || null,
    highest_role_name: member?.highest_role_name || null,
    top_role:
      member?.top_role ||
      member?.highest_role_name ||
      (Array.isArray(member?.role_names) ? member.role_names[0] : null) ||
      null,
    in_guild: member?.in_guild !== false,
    has_any_role: Boolean(member?.has_any_role),
    data_health: member?.data_health || "unknown",
    synced_at: member?.synced_at || null,
    created_at: member?.created_at || null,
    updated_at: member?.updated_at || null,
    has_unverified: Boolean(member?.has_unverified),
    has_verified_role: Boolean(member?.has_verified_role),
    has_staff_role: Boolean(member?.has_staff_role),
    has_secondary_verified_role: Boolean(member?.has_secondary_verified_role),
    has_cosmetic_only: Boolean(member?.has_cosmetic_only),
    role_state: member?.role_state || "unknown",
    role_state_reason: member?.role_state_reason || null,
    avatar_hash: member?.avatar_hash || null,
    joined_at: member?.joined_at || null,
    previous_usernames: Array.isArray(member?.previous_usernames)
      ? member.previous_usernames
      : [],
    previous_display_names: Array.isArray(member?.previous_display_names)
      ? member.previous_display_names
      : [],
    previous_nicknames: Array.isArray(member?.previous_nicknames)
      ? member.previous_nicknames
      : [],
    last_seen_username: member?.last_seen_username || null,
    last_seen_display_name: member?.last_seen_display_name || null,
    last_seen_nickname: member?.last_seen_nickname || null,
    first_seen_at: member?.first_seen_at || null,
    last_seen_at: member?.last_seen_at || null,
    left_at: member?.left_at || null,
    rejoined_at: member?.rejoined_at || null,
    times_joined: normalizeNumber(member?.times_joined, 0),
    times_left: normalizeNumber(member?.times_left, 0),
    is_bot: Boolean(member?.is_bot),
    invited_by: member?.invited_by || null,
    invited_by_name: member?.invited_by_name || null,
    invite_code: member?.invite_code || null,
    vouched_by: member?.vouched_by || null,
    vouched_by_name: member?.vouched_by_name || null,
    approved_by: member?.approved_by || null,
    approved_by_name: member?.approved_by_name || null,
    verification_ticket_id: member?.verification_ticket_id || null,
    source_ticket_id: member?.source_ticket_id || null,
    entry_method: member?.entry_method || null,
    verification_source: member?.verification_source || null,
    entry_reason: member?.entry_reason || null,
    approval_reason: member?.approval_reason || null,
  };
}

function sanitizeTicket(ticket, memberLookup = {}) {
  const claimedBy = normalizeString(ticket?.claimed_by);
  const assignedTo = normalizeString(ticket?.assigned_to);
  const closedBy = normalizeString(ticket?.closed_by);

  const claimedMember = claimedBy ? memberLookup[claimedBy] : null;
  const assignedMember = assignedTo ? memberLookup[assignedTo] : null;
  const closedMember = closedBy ? memberLookup[closedBy] : null;

  return {
    ...ticket,
    id: ticket?.id || null,
    guild_id: ticket?.guild_id || null,
    user_id: ticket?.user_id || null,
    username: ticket?.username || null,
    title: ticket?.title || ticket?.channel_name || "Ticket",
    category: ticket?.category || null,
    status: ticket?.status || "open",
    priority: ticket?.priority || "medium",
    claimed_by: claimedBy || null,
    claimed_by_name: claimedMember
      ? resolveDisplayName(claimedMember, claimedBy)
      : claimedBy || null,
    assigned_to: assignedTo || null,
    assigned_to_name: assignedMember
      ? resolveDisplayName(assignedMember, assignedTo)
      : assignedTo || null,
    closed_by: closedBy || null,
    closed_by_name: closedMember
      ? resolveDisplayName(closedMember, closedBy)
      : closedBy || null,
    closed_reason: ticket?.closed_reason || null,
    created_at: ticket?.created_at || null,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    deleted_at: ticket?.deleted_at || null,
    reopened_at: ticket?.reopened_at || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    discord_thread_id: ticket?.discord_thread_id || null,
    transcript_url: ticket?.transcript_url || null,
    transcript_message_id: ticket?.transcript_message_id || null,
    transcript_channel_id: ticket?.transcript_channel_id || null,
    source: ticket?.source || null,
    initial_message: ticket?.initial_message || "",
    is_ghost: Boolean(ticket?.is_ghost),
    matched_category_id: ticket?.matched_category_id || null,
    matched_category_name: ticket?.matched_category_name || null,
    matched_category_slug: ticket?.matched_category_slug || null,
    matched_intake_type: ticket?.matched_intake_type || null,
    matched_category_reason: ticket?.matched_category_reason || null,
    matched_category_score: normalizeNumber(ticket?.matched_category_score, 0),
    ticket_number: ticket?.ticket_number ?? null,
  };
}

function sanitizeWarn(row) {
  return {
    id: row?.id || null,
    guild_id: row?.guild_id || null,
    user_id: row?.user_id || null,
    username: row?.username || null,
    reason: row?.reason || "",
    source_message: row?.source_message || null,
    created_at: row?.created_at || null,
  };
}

function sanitizeRaid(row) {
  return {
    id: row?.id || null,
    guild_id: row?.guild_id || null,
    join_count: normalizeNumber(row?.join_count, 0),
    window_seconds: normalizeNumber(row?.window_seconds, 0),
    severity: row?.severity || "unknown",
    summary: row?.summary || "",
    created_at: row?.created_at || null,
  };
}

function sanitizeFraudFlag(row) {
  return {
    id: row?.id || null,
    guild_id: row?.guild_id || null,
    user_id: row?.user_id || null,
    username: row?.username || null,
    score: normalizeNumber(row?.score, 0),
    reasons: Array.isArray(row?.reasons) ? row.reasons : [],
    flagged: Boolean(row?.flagged),
    created_at: row?.created_at || null,
  };
}

function sanitizeJoin(memberJoin, memberLookup = {}) {
  const userId = normalizeString(memberJoin?.user_id);
  const member = userId ? memberLookup[userId] : null;

  return {
    ...(member || {}),
    ...(memberJoin || {}),
    user_id: memberJoin?.user_id || member?.user_id || null,
    username: memberJoin?.username || member?.username || null,
    display_name: memberJoin?.display_name || member?.display_name || null,
    nickname: member?.nickname || null,
    avatar_url: memberJoin?.avatar_url || member?.avatar_url || null,
    joined_at: memberJoin?.joined_at || member?.joined_at || memberJoin?.created_at || null,
    updated_at: memberJoin?.updated_at || member?.updated_at || member?.last_seen_at || null,
    created_at: memberJoin?.created_at || member?.created_at || null,
    role_names:
      Array.isArray(member?.role_names) ? member.role_names : [],
    has_verified_role: Boolean(member?.has_verified_role),
    has_unverified: Boolean(member?.has_unverified),
    has_staff_role: Boolean(member?.has_staff_role),
    in_guild: member?.in_guild !== false,
    role_state: member?.role_state || "tracked",
    role_state_reason: member?.role_state_reason || null,
    top_role:
      member?.top_role ||
      member?.highest_role_name ||
      (Array.isArray(member?.role_names) ? member.role_names[0] : null) ||
      null,
    highest_role_name:
      member?.highest_role_name ||
      member?.top_role ||
      (Array.isArray(member?.role_names) ? member.role_names[0] : null) ||
      null,
    source: "member_joins",
  };
}

function sanitizeActivityFeedEvent(row, memberLookup = {}) {
  const actorId = normalizeString(row?.actor_user_id);
  const actorMember = actorId ? memberLookup[actorId] : null;
  const actorName =
    row?.actor_name ||
    (actorMember ? resolveDisplayName(actorMember, actorId) : null) ||
    "System";

  const targetUserId = normalizeString(row?.target_user_id);
  const targetMember = targetUserId ? memberLookup[targetUserId] : null;

  return {
    id: row?.id || null,
    title: row?.title || "Activity",
    description: row?.description || "",
    reason: row?.reason || "",
    event_type: row?.event_type || "activity",
    event_family: row?.event_family || "activity",
    related_id: row?.related_id || null,
    created_at: row?.created_at || null,
    actor_id: actorId || null,
    actor_name: actorName,
    target_user_id: targetUserId || null,
    target_name:
      row?.target_name ||
      (targetMember ? resolveDisplayName(targetMember, targetUserId) : null) ||
      null,
    channel_id: row?.channel_id || null,
    channel_name: row?.channel_name || null,
    ticket_id: row?.ticket_id || null,
    metadata: safeObject(row?.metadata),
    source: row?.source || "activity_feed_events",
  };
}

function sanitizeAuditLogEvent(row, memberLookup = {}) {
  const meta = safeObject(row?.meta);
  const actorId = normalizeString(row?.staff_id || meta?.staff_id);
  const actorMember = actorId ? memberLookup[actorId] : null;
  const actorName =
    meta?.staff_name ||
    row?.staff_name ||
    (actorMember ? resolveDisplayName(actorMember, actorId) : null) ||
    actorId ||
    "Staff";

  return {
    id: `audit-log-${row?.id || row?.created_at}`,
    title: String(row?.action || "Audit Log")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase()),
    description:
      meta?.reason ||
      meta?.message ||
      "Dashboard/bot audit log entry.",
    reason: meta?.reason || meta?.message || "",
    event_type: row?.action || "audit_log",
    event_family: "audit",
    related_id: row?.staff_id || null,
    created_at: row?.created_at || null,
    actor_id: actorId || null,
    actor_name: actorName,
    target_user_id: normalizeString(meta?.user_id || meta?.target_user_id) || null,
    target_name: null,
    channel_id: meta?.channel_id || null,
    channel_name: null,
    ticket_id: meta?.ticket_id || meta?.source_ticket_id || null,
    metadata: meta,
    source: "audit_logs",
  };
}

function sanitizeAuditEvent(row) {
  return {
    id: `audit-event-${row?.id || row?.created_at}`,
    title: row?.title || "Audit Event",
    description: row?.description || "",
    reason: row?.description || "",
    event_type: row?.event_type || "audit_event",
    event_family: "audit",
    related_id: row?.related_id || null,
    created_at: row?.created_at || null,
    actor_id: null,
    actor_name: "System",
    target_user_id: null,
    target_name: null,
    channel_id: null,
    channel_name: null,
    ticket_id: null,
    metadata: {},
    source: "audit_events",
  };
}

function buildRecentJoins(memberJoins = [], memberLookup = {}) {
  return safeArray(memberJoins)
    .map((row) => sanitizeJoin(row, memberLookup))
    .sort(
      (a, b) =>
        parseDateMs(b?.joined_at || b?.created_at || b?.updated_at) -
        parseDateMs(a?.joined_at || a?.created_at || a?.updated_at)
    )
    .slice(0, 50);
}

function deriveMetricsFromTickets(tickets = [], existingMetrics = [], memberLookup = {}) {
  const byStaff = new Map();

  function ensureRow(key, fallbackName = "Unknown Staff") {
    const safeKey = normalizeString(key);
    if (!safeKey) return null;

    if (!byStaff.has(safeKey)) {
      const member = memberLookup[safeKey];
      byStaff.set(safeKey, {
        staff_id: safeKey,
        staff_name: member ? resolveDisplayName(member, safeKey) : fallbackName,
        tickets_handled: 0,
        approvals: 0,
        denials: 0,
        avg_response_minutes: 0,
        last_active: null,
      });
    }

    return byStaff.get(safeKey);
  }

  for (const row of safeArray(existingMetrics)) {
    const key = normalizeString(row?.staff_id || row?.staff_name);
    if (!key) continue;

    const member = memberLookup[key];

    byStaff.set(key, {
      staff_id: key,
      staff_name:
        row?.staff_name ||
        (member ? resolveDisplayName(member, key) : key),
      tickets_handled: normalizeNumber(row?.tickets_handled, 0),
      approvals: normalizeNumber(row?.approvals, 0),
      denials: normalizeNumber(row?.denials, 0),
      avg_response_minutes: normalizeNumber(row?.avg_response_minutes, 0),
      last_active: row?.last_active || null,
    });
  }

  for (const ticket of safeArray(tickets)) {
    const status = normalizeString(ticket?.status).toLowerCase();
    const category = normalizeString(
      ticket?.matched_intake_type || ticket?.category
    ).toLowerCase();

    const staffId = normalizeString(
      ticket?.closed_by || ticket?.claimed_by || ticket?.assigned_to
    );

    if (!staffId) continue;

    const row = ensureRow(staffId, staffId);
    if (!row) continue;

    const updatedAt =
      ticket?.updated_at || ticket?.closed_at || ticket?.created_at || null;

    if (
      updatedAt &&
      (!row.last_active || parseDateMs(updatedAt) > parseDateMs(row.last_active))
    ) {
      row.last_active = updatedAt;
    }

    if (status === "closed" || status === "deleted") {
      row.tickets_handled += 1;

      const reasonText = normalizeString(
        ticket?.closed_reason || ticket?.reason || ticket?.mod_suggestion
      ).toLowerCase();

      const denied = /\b(deny|denied|reject|rejected|decline|declined|failed)\b/.test(
        reasonText
      );

      if (category.includes("verification")) {
        if (denied) {
          row.denials += 1;
        } else {
          row.approvals += 1;
        }
      }
    }
  }

  return [...byStaff.values()].sort((a, b) => {
    const handledDiff =
      normalizeNumber(b?.tickets_handled, 0) - normalizeNumber(a?.tickets_handled, 0);
    if (handledDiff !== 0) return handledDiff;

    const approvalsDiff =
      normalizeNumber(b?.approvals, 0) - normalizeNumber(a?.approvals, 0);
    if (approvalsDiff !== 0) return approvalsDiff;

    return normalizeString(a?.staff_name || a?.staff_id).localeCompare(
      normalizeString(b?.staff_name || b?.staff_id)
    );
  });
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

    if (!session?.isStaff) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
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
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      rawTickets,
      rawAuditLogs,
      rawAuditEvents,
      rawRoles,
      rawMetrics,
      rawCategories,
      rawMemberJoins,
      rawRecentActiveMembers,
      rawRecentFormerMembers,
      rawAllGuildMembers,
      warnsTodayCount,
      raidAlertsCount,
      fraudFlagsCount,
      activeMembersCount,
      formerMembersCount,
      pendingVerificationCount,
      verifiedMembersCount,
      staffMembersCount,
      rawWarns,
      rawRaids,
      rawFraudFlags,
      rawActivityFeed,
    ] = await Promise.all([
      safeSupabaseRows(() =>
        supabase
          .from("tickets")
          .select("*")
          .eq("guild_id", guildId)
          .order("updated_at", { ascending: false })
          .limit(300)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(40)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(40)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("guild_roles")
          .select("*")
          .eq("guild_id", guildId)
          .order("position", { ascending: false })
          .limit(100)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("staff_metrics")
          .select("*")
          .eq("guild_id", guildId)
          .order("tickets_handled", { ascending: false })
          .limit(25)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("ticket_categories")
          .select("*")
          .eq("guild_id", guildId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      ),

      safeSupabaseRows(() =>
        supabase
          .from("member_joins")
          .select("*")
          .eq("guild_id", guildId)
          .order("joined_at", { ascending: false })
          .limit(50)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("guild_members")
          .select("*")
          .eq("guild_id", guildId)
          .eq("in_guild", true)
          .order("joined_at", { ascending: false })
          .limit(25)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("guild_members")
          .select("*")
          .eq("guild_id", guildId)
          .eq("in_guild", false)
          .order("updated_at", { ascending: false })
          .limit(25)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("guild_members")
          .select("*")
          .eq("guild_id", guildId)
          .order("updated_at", { ascending: false })
          .limit(2000)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("warns")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .gte("created_at", since24h)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("raid_events")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .gte("created_at", since24h)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("verification_flags")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .eq("flagged", true)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("guild_members")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .eq("in_guild", true)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("guild_members")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .eq("in_guild", false)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("guild_members")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .eq("in_guild", true)
          .eq("has_unverified", true)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("guild_members")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .eq("in_guild", true)
          .eq("has_verified_role", true)
      ),

      safeSupabaseCount(() =>
        supabase
          .from("guild_members")
          .select("*", { count: "exact", head: true })
          .eq("guild_id", guildId)
          .eq("in_guild", true)
          .eq("has_staff_role", true)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("warns")
          .select("*")
          .eq("guild_id", guildId)
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(25)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("raid_events")
          .select("*")
          .eq("guild_id", guildId)
          .gte("created_at", since24h)
          .order("created_at", { ascending: false })
          .limit(25)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("verification_flags")
          .select("*")
          .eq("guild_id", guildId)
          .eq("flagged", true)
          .order("created_at", { ascending: false })
          .limit(25)
      ),

      safeSupabaseRows(() =>
        supabase
          .from("activity_feed_events")
          .select("*")
          .eq("guild_id", guildId)
          .order("created_at", { ascending: false })
          .limit(80)
      ),
    ]);

    const guildMembers = safeArray(rawAllGuildMembers).map(sanitizeGuildMember);

    const memberLookup = {};
    for (const member of guildMembers) {
      const id = normalizeString(member?.user_id);
      if (!id) continue;
      memberLookup[id] = member;
    }

    const visibleTickets = safeArray(rawTickets)
      .map((ticket) => ({
        ...ticket,
        priority: ticket?.priority || derivePriority(ticket),
        channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
        transcript_url: ticket?.transcript_url || null,
        transcript_message_id: ticket?.transcript_message_id || null,
        transcript_channel_id: ticket?.transcript_channel_id || null,
      }))
      .filter((ticket) => !shouldHideStaleTicket(ticket))
      .map((ticket) => sanitizeTicket(ticket, memberLookup));

    const sortedTickets = sortTickets(visibleTickets, "updated_desc");
    const activeTickets = sortTickets(
      visibleTickets.filter((ticket) => isActiveTicketStatus(ticket?.status)),
      "priority_desc"
    );

    const roles = safeArray(rawRoles).map(sanitizeRole);
    const categories = safeArray(rawCategories).map(sanitizeCategory);
    const warns = safeArray(rawWarns).map(sanitizeWarn);
    const raids = safeArray(rawRaids).map(sanitizeRaid);
    const fraud = safeArray(rawFraudFlags).map(sanitizeFraudFlag);

    const recentActiveMembers = safeArray(rawRecentActiveMembers).map(sanitizeGuildMember);
    const recentFormerMembers = safeArray(rawRecentFormerMembers).map(sanitizeGuildMember);
    const recentJoins = buildRecentJoins(rawMemberJoins, memberLookup);

    const metrics = deriveMetricsFromTickets(
      visibleTickets,
      rawMetrics,
      memberLookup
    );

    const events = [
      ...safeArray(rawActivityFeed).map((row) =>
        sanitizeActivityFeedEvent(row, memberLookup)
      ),
      ...safeArray(rawAuditLogs).map((row) =>
        sanitizeAuditLogEvent(row, memberLookup)
      ),
      ...safeArray(rawAuditEvents).map(sanitizeAuditEvent),
    ]
      .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at))
      .slice(0, 80);

    return NextResponse.json(
      {
        ok: true,
        generated_at: new Date().toISOString(),
        tickets: sortedTickets,
        activeTickets,
        events,
        warns,
        raids,
        fraud,
        fraudFlagsList: fraud,
        roles,
        metrics,
        categories,
        recentJoins,
        recentActiveMembers,
        recentFormerMembers,
        guildMembers,
        members: guildMembers,
        memberRows: guildMembers,
        memberCounts: {
          tracked: activeMembersCount + formerMembersCount,
          active: activeMembersCount,
          former: formerMembersCount,
          pendingVerification: pendingVerificationCount,
          verified: verifiedMembersCount,
          staff: staffMembersCount,
        },
        counts: {
          openTickets: activeTickets.length,
          warnsToday: warnsTodayCount,
          raidAlerts: raidAlertsCount,
          fraudFlags: fraudFlagsCount,
        },
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
      error instanceof Error ? error.message : "Failed to load staff dashboard.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
