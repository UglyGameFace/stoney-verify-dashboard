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

function uniqueBy(items, keyFactory) {
  const seen = new Set();
  const out = [];

  for (const item of safeArray(items)) {
    const key = String(keyFactory(item) || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function sortByCreatedDesc(rows) {
  return safeArray(rows).sort(
    (a, b) =>
      parseDateMs(b?.created_at || b?.updated_at) -
      parseDateMs(a?.created_at || a?.updated_at)
  );
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

function resolveMemberDisplayName(memberRow, fallback = "Unknown") {
  return (
    memberRow?.display_name ||
    memberRow?.nickname ||
    memberRow?.username ||
    fallback
  );
}

function sanitizeMember(memberRow, viewer) {
  if (!memberRow) {
    return {
      guild_id: viewer?.guild_id || null,
      user_id: viewer?.discord_id || null,
      username: viewer?.username || "Member",
      display_name: viewer?.global_name || viewer?.username || "Member",
      nickname: null,
      avatar_url: viewer?.avatar_url || null,
      joined_at: null,
      role_names: [],
      role_ids: [],
      has_unverified: false,
      has_verified_role: false,
      has_staff_role: false,
      has_secondary_verified_role: false,
      has_cosmetic_only: false,
      role_state: "unknown",
      role_state_reason: "Member row not found in guild_members.",
      previous_usernames: [],
      previous_display_names: [],
      previous_nicknames: [],
      last_seen_username: viewer?.username || null,
      last_seen_display_name: viewer?.global_name || null,
      last_seen_nickname: null,
      invited_by: null,
      invited_by_name: null,
      invite_code: null,
      vouched_by: null,
      vouched_by_name: null,
      approved_by: null,
      approved_by_name: null,
      entry_method: null,
      verification_source: null,
      entry_reason: null,
      approval_reason: null,
      top_role: null,
      in_guild: true,
      times_joined: 0,
      times_left: 0,
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
    has_cosmetic_only: Boolean(memberRow?.has_cosmetic_only),
    role_state: memberRow?.role_state || "unknown",
    role_state_reason: memberRow?.role_state_reason || "",
    previous_usernames: Array.isArray(memberRow?.previous_usernames)
      ? memberRow.previous_usernames
      : [],
    previous_display_names: Array.isArray(memberRow?.previous_display_names)
      ? memberRow.previous_display_names
      : [],
    previous_nicknames: Array.isArray(memberRow?.previous_nicknames)
      ? memberRow.previous_nicknames
      : [],
    last_seen_username: memberRow?.last_seen_username || null,
    last_seen_display_name: memberRow?.last_seen_display_name || null,
    last_seen_nickname: memberRow?.last_seen_nickname || null,
    invited_by: memberRow?.invited_by || null,
    invited_by_name: memberRow?.invited_by_name || null,
    invite_code: memberRow?.invite_code || null,
    vouched_by: memberRow?.vouched_by || null,
    vouched_by_name: memberRow?.vouched_by_name || null,
    approved_by: memberRow?.approved_by || null,
    approved_by_name: memberRow?.approved_by_name || null,
    verification_ticket_id: memberRow?.verification_ticket_id || null,
    source_ticket_id: memberRow?.source_ticket_id || null,
    entry_method: memberRow?.entry_method || null,
    verification_source: memberRow?.verification_source || null,
    entry_reason: memberRow?.entry_reason || null,
    approval_reason: memberRow?.approval_reason || null,
    top_role: memberRow?.top_role || memberRow?.highest_role_name || null,
    in_guild: memberRow?.in_guild !== false,
    times_joined: normalizeNumber(memberRow?.times_joined, 0),
    times_left: normalizeNumber(memberRow?.times_left, 0),
  };
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

function sanitizeVerificationToken(row) {
  return {
    token: row?.token || null,
    status: normalizeString(row?.status || "pending").toLowerCase() || "pending",
    decision: normalizeString(row?.decision || "PENDING").toUpperCase() || "PENDING",
    used: Boolean(row?.used),
    submitted: Boolean(row?.submitted),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    submitted_at: row?.submitted_at || null,
    decided_at: row?.decided_at || null,
    expires_at: row?.expires_at || null,
    requester_id: row?.requester_id || null,
    approved_user_id: row?.approved_user_id || null,
    decided_by: row?.decided_by || null,
    decided_by_display_name: row?.decided_by_display_name || null,
    decided_by_username: row?.decided_by_username || null,
    role_sync_ok: Boolean(row?.role_sync_ok),
    role_sync_reason: row?.role_sync_reason || null,
    ai_status: row?.ai_status || null,
    expected_role_state: row?.expected_role_state || null,
    actual_role_state: row?.actual_role_state || null,
    channel_id: row?.channel_id || null,
    raw: row || {},
  };
}

function sanitizeVcSession(row, staffLookup = {}) {
  const acceptedBy = normalizeString(row?.accepted_by);
  const canceledBy = normalizeString(row?.canceled_by);
  const actorId = acceptedBy || canceledBy || null;
  const actorRow = actorId ? staffLookup[actorId] : null;
  const actorName = actorRow
    ? resolveMemberDisplayName(actorRow, actorId)
    : actorId || null;

  return {
    token: row?.token || null,
    status: normalizeString(row?.status || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    accepted_at: row?.accepted_at || null,
    started_at: row?.started_at || null,
    completed_at: row?.completed_at || null,
    canceled_at: row?.canceled_at || null,
    access_minutes: normalizeNumber(row?.access_minutes, 0),
    requester_id: row?.requester_id ? String(row.requester_id) : null,
    owner_id: row?.owner_id ? String(row.owner_id) : null,
    accepted_by: acceptedBy || null,
    canceled_by: canceledBy || null,
    staff_id: actorId,
    staff_name: actorName,
    ticket_id: row?.ticket_id || null,
    ticket_channel_id: row?.ticket_channel_id
      ? String(row.ticket_channel_id)
      : null,
    vc_channel_id: row?.vc_channel_id ? String(row.vc_channel_id) : null,
    queue_channel_id: row?.queue_channel_id
      ? String(row.queue_channel_id)
      : null,
    queue_message_id: row?.queue_message_id
      ? String(row.queue_message_id)
      : null,
    revoke_at: row?.revoke_at || null,
    last_watchdog_at: row?.last_watchdog_at || null,
    meta: safeObject(row?.meta),
    raw: row || {},
  };
}

function sanitizeJoinRow(row) {
  return {
    id: row?.id || null,
    joined_at: row?.joined_at || row?.created_at || null,
    join_source:
      row?.verification_source ||
      row?.entry_method ||
      row?.join_source ||
      null,
    entry_method:
      row?.entry_method ||
      row?.verification_source ||
      row?.join_source ||
      null,
    invite_code: row?.invite_code || null,
    inviter_id: row?.invited_by || null,
    inviter_name: row?.invited_by_name || null,
    vouched_by: row?.vouched_by || null,
    vouched_by_name: row?.vouched_by_name || null,
    approved_by: row?.approved_by || null,
    approved_by_name: row?.approved_by_name || null,
    source_ticket_id: row?.source_ticket_id || null,
    join_note: row?.join_note || null,
    vanity_used: Boolean(row?.vanity_used),
    username: row?.username || null,
    display_name: row?.display_name || null,
    raw: row || {},
  };
}

function sanitizeMemberEventRow(row) {
  return {
    id: row?.id || null,
    created_at: row?.created_at || null,
    event_type: row?.event_type || "member_event",
    title: row?.title || "Member Event",
    reason: row?.reason || "",
    actor_id: row?.actor_id || null,
    actor_name: row?.actor_name || "System",
    metadata: safeObject(row?.metadata),
    raw: row || {},
  };
}

function sanitizeActivityFeedRow(row) {
  return {
    id: row?.id || null,
    created_at: row?.created_at || null,
    updated_at: row?.created_at || null,
    title: row?.title || "Activity",
    description: row?.description || "",
    reason: row?.reason || "",
    event_family: row?.event_family || "activity",
    event_type: row?.event_type || "activity",
    actor_id: row?.actor_user_id || null,
    actor_name: row?.actor_name || "System",
    target_user_id: row?.target_user_id || null,
    target_name: row?.target_name || null,
    ticket_id: row?.ticket_id || null,
    channel_id: row?.channel_id || null,
    channel_name: row?.channel_name || null,
    metadata: safeObject(row?.metadata),
    _source: row?.source || "activity_feed_events",
    raw: row || {},
  };
}

function sanitizeUserTicket(ticket, staffLookup = {}) {
  const claimedBy = normalizeString(ticket?.claimed_by);
  const assignedTo = normalizeString(ticket?.assigned_to);
  const closedBy = normalizeString(ticket?.closed_by);

  const claimedMember = claimedBy ? staffLookup[claimedBy] : null;
  const assignedMember = assignedTo ? staffLookup[assignedTo] : null;
  const closedMember = closedBy ? staffLookup[closedBy] : null;

  return {
    id: ticket?.id || null,
    title: ticket?.title || ticket?.channel_name || "Ticket",
    category: ticket?.category || null,
    matched_category_name: ticket?.matched_category_name || null,
    matched_category_slug: ticket?.matched_category_slug || null,
    matched_intake_type: ticket?.matched_intake_type || null,
    matched_category_reason: ticket?.matched_category_reason || null,
    matched_category_score: normalizeNumber(ticket?.matched_category_score, 0),
    status: ticket?.status || "open",
    priority: ticket?.priority || "medium",
    claimed_by: claimedBy || null,
    claimed_by_name: claimedMember
      ? resolveMemberDisplayName(claimedMember, claimedBy)
      : claimedBy || null,
    assigned_to: assignedTo || null,
    assigned_to_name: assignedMember
      ? resolveMemberDisplayName(assignedMember, assignedTo)
      : assignedTo || null,
    closed_by: closedBy || null,
    closed_by_name: closedMember
      ? resolveMemberDisplayName(closedMember, closedBy)
      : closedBy || null,
    closed_reason: ticket?.closed_reason || null,
    created_at: ticket?.created_at || null,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    deleted_at: ticket?.deleted_at || null,
    reopened_at: ticket?.reopened_at || null,
    sla_deadline: ticket?.sla_deadline || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
    transcript_url: ticket?.transcript_url || null,
    source: ticket?.source || null,
    initial_message: ticket?.initial_message || "",
    is_ghost: Boolean(ticket?.is_ghost),
    ticket_number: ticket?.ticket_number ?? null,
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

async function loadMemberLookupByIds(supabase, guildId, userIds) {
  const ids = dedupeStrings(userIds);
  if (!ids.length) return {};

  const rows = await safeSupabaseRows(() =>
    supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .in("user_id", ids)
  );

  const out = {};
  for (const row of rows) {
    const id = normalizeString(row?.user_id);
    if (!id) continue;
    out[id] = row;
  }
  return out;
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
  const rows = await safeSupabaseRows(() =>
    supabase
      .from("verification_flags")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("created_at", { ascending: false })
      .limit(20)
  );

  return rows.map(sanitizeVerificationFlag);
}

async function loadVerificationTokens(supabase, guildId, discordId) {
  const rows = await safeSupabaseRows(() =>
    supabase
      .from("verification_tokens")
      .select("*")
      .eq("guild_id", guildId)
      .or(
        `requester_id.eq.${discordId},user_id.eq.${discordId},approved_user_id.eq.${discordId}`
      )
      .order("created_at", { ascending: false })
      .limit(25)
  );

  return rows.map(sanitizeVerificationToken);
}

async function loadRawVcSessions(supabase, discordId) {
  const numericId = normalizeNumber(discordId, 0);
  if (!numericId) return [];

  return safeSupabaseRows(() =>
    supabase
      .from("vc_verify_sessions")
      .select("*")
      .or(`owner_id.eq.${numericId},requester_id.eq.${numericId}`)
      .order("created_at", { ascending: false })
      .limit(20)
  );
}

async function loadJoinHistory(supabase, guildId, discordId) {
  const rows = await safeSupabaseRows(() =>
    supabase
      .from("member_joins")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("joined_at", { ascending: false })
      .limit(10)
  );

  return rows.map(sanitizeJoinRow);
}

async function loadMemberEvents(supabase, guildId, discordId) {
  const rows = await safeSupabaseRows(() =>
    supabase
      .from("member_events")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("created_at", { ascending: false })
      .limit(20)
  );

  return rows.map(sanitizeMemberEventRow);
}

async function loadRecentTickets(supabase, guildId, discordId) {
  return safeSupabaseRows(() =>
    supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("updated_at", { ascending: false })
      .limit(50)
  );
}

async function loadActivityFeedEvents(supabase, guildId, discordId, ticketIds = []) {
  const byUser = await safeSupabaseRows(() =>
    supabase
      .from("activity_feed_events")
      .select("*")
      .eq("guild_id", guildId)
      .or(`target_user_id.eq.${discordId},actor_user_id.eq.${discordId}`)
      .order("created_at", { ascending: false })
      .limit(40)
  );

  let byTicket = [];
  const cleanTicketIds = dedupeStrings(ticketIds);
  if (cleanTicketIds.length) {
    byTicket = await safeSupabaseRows(() =>
      supabase
        .from("activity_feed_events")
        .select("*")
        .eq("guild_id", guildId)
        .in("ticket_id", cleanTicketIds)
        .order("created_at", { ascending: false })
        .limit(40)
    );
  }

  return uniqueBy([...byUser, ...byTicket], (row) => row?.id || `${row?.event_type}:${row?.created_at}`);
}

function buildTicketLifecycleEvents(tickets) {
  const events = [];

  for (const ticket of safeArray(tickets)) {
    const ticketId = ticket?.id || null;
    const ticketTitle = ticket?.title || ticket?.channel_name || "Ticket";
    const category = ticket?.matched_category_name || ticket?.category || "support";
    const baseMetadata = {
      ticket_id: ticketId,
      ticket_title: ticketTitle,
      channel_name: ticket?.channel_name || null,
      channel_id: ticket?.channel_id || null,
      category,
      status: ticket?.status || null,
      priority: ticket?.priority || null,
    };

    if (ticket?.created_at) {
      events.push({
        id: `ticket-created-${ticketId || ticket?.created_at}`,
        title: "Ticket Opened",
        description: `Opened ${ticketTitle}`,
        reason: ticket?.initial_message || "",
        event_type: "ticket_created",
        created_at: ticket.created_at,
        updated_at: ticket.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: ticketId,
        metadata: baseMetadata,
        _source: "tickets",
      });
    }

    if (ticket?.claimed_by && ticket?.updated_at) {
      events.push({
        id: `ticket-claimed-${ticketId || ticket?.updated_at}`,
        title: "Ticket Claimed",
        description: `${ticketTitle} was claimed by staff.`,
        reason: "",
        event_type: "ticket_claimed",
        created_at: ticket.updated_at,
        updated_at: ticket.updated_at,
        actor_id: ticket?.claimed_by || null,
        actor_name: ticket?.claimed_by_name || ticket?.claimed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          claimed_by: ticket?.claimed_by || null,
          claimed_by_name: ticket?.claimed_by_name || null,
        },
        _source: "tickets",
      });
    }

    if (ticket?.closed_at || normalizeString(ticket?.status).toLowerCase() === "closed") {
      events.push({
        id: `ticket-closed-${ticketId || ticket?.closed_at || ticket?.updated_at}`,
        title: "Ticket Closed",
        description: `${ticketTitle} was closed.`,
        reason: ticket?.closed_reason || "",
        event_type: "ticket_closed",
        created_at: ticket?.closed_at || ticket?.updated_at || null,
        updated_at: ticket?.closed_at || ticket?.updated_at || null,
        actor_id: ticket?.closed_by || null,
        actor_name: ticket?.closed_by_name || ticket?.closed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          closed_by: ticket?.closed_by || null,
          closed_reason: ticket?.closed_reason || null,
        },
        _source: "tickets",
      });
    }

    if (normalizeString(ticket?.status).toLowerCase() === "deleted") {
      events.push({
        id: `ticket-deleted-${ticketId || ticket?.deleted_at || ticket?.updated_at}`,
        title: "Ticket Deleted",
        description: `${ticketTitle} was deleted.`,
        reason: ticket?.closed_reason || "",
        event_type: "ticket_deleted",
        created_at: ticket?.deleted_at || ticket?.closed_at || ticket?.updated_at || null,
        updated_at: ticket?.deleted_at || ticket?.closed_at || ticket?.updated_at || null,
        actor_id: ticket?.closed_by || null,
        actor_name: ticket?.closed_by_name || ticket?.closed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
        },
        _source: "tickets",
      });
    }
  }

  return events.filter((event) => event?.created_at);
}

function buildVerificationFlagEvents(flags) {
  return safeArray(flags)
    .filter(Boolean)
    .map((flag) => ({
      id: `verification-flag-${flag?.id || flag?.created_at}`,
      title: flag?.flagged ? "Verification Flag Raised" : "Verification Reviewed",
      description: flag?.flagged
        ? "Your verification was flagged for manual review."
        : "Verification review activity detected.",
      reason: Array.isArray(flag?.reasons) ? flag.reasons.join(" • ") : "",
      event_type: "verification_flag",
      created_at: flag?.created_at || null,
      updated_at: flag?.created_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: {
        score: Number(flag?.score || 0),
        reasons: Array.isArray(flag?.reasons) ? flag.reasons : [],
      },
      _source: "verification_flags",
    }))
    .filter((event) => event?.created_at);
}

function buildVerificationTokenEvents(tokens) {
  const events = [];

  for (const row of safeArray(tokens)) {
    if (row?.created_at) {
      events.push({
        id: `verification-token-created-${row?.token || row?.created_at}`,
        title: "Verification Link Issued",
        description: `Verification token status: ${normalizeString(row?.status || "pending")}.`,
        reason: "",
        event_type: "verification_token_created",
        created_at: row.created_at,
        updated_at: row.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: null,
        metadata: {
          token: row?.token || null,
          status: row?.status || null,
          decision: row?.decision || null,
        },
        _source: "verification_tokens",
      });
    }

    if (row?.submitted_at) {
      events.push({
        id: `verification-token-submitted-${row?.token || row?.submitted_at}`,
        title: "Verification Submitted",
        description: "Your verification submission was received.",
        reason: "",
        event_type: "verification_submitted",
        created_at: row.submitted_at,
        updated_at: row.submitted_at,
        actor_id: row?.requester_id || null,
        actor_name: row?.requester_display_name || row?.requester_username || "Member",
        ticket_id: null,
        metadata: {
          token: row?.token || null,
          status: row?.status || null,
        },
        _source: "verification_tokens",
      });
    }

    if (row?.decided_at) {
      const decision = normalizeString(row?.decision || row?.status || "PENDING").toUpperCase();
      events.push({
        id: `verification-token-decided-${row?.token || row?.decided_at}`,
        title:
          decision === "APPROVED"
            ? "Verification Approved"
            : decision === "DENIED"
              ? "Verification Denied"
              : "Verification Updated",
        description: `Verification decision: ${decision}.`,
        reason: row?.role_sync_reason || "",
        event_type:
          decision === "APPROVED"
            ? "verification_approved"
            : decision === "DENIED"
              ? "verification_denied"
              : "verification_decision",
        created_at: row.decided_at,
        updated_at: row.decided_at,
        actor_id: row?.decided_by || null,
        actor_name:
          row?.decided_by_display_name ||
          row?.decided_by_username ||
          row?.decided_by ||
          "Staff",
        ticket_id: null,
        metadata: {
          token: row?.token || null,
          decision,
          status: row?.status || null,
          role_sync_ok: Boolean(row?.role_sync_ok),
        },
        _source: "verification_tokens",
      });
    }
  }

  return events.filter((event) => event?.created_at);
}

function buildVcSessionEvents(rows) {
  const events = [];

  for (const row of safeArray(rows)) {
    const status = normalizeString(row?.status || "PENDING").toUpperCase();

    if (row?.created_at) {
      events.push({
        id: `vc-created-${row?.token || row?.created_at}`,
        title: "VC Verification Requested",
        description: `VC verification status: ${status}`,
        reason: "",
        event_type: "vc_verify_requested",
        created_at: row.created_at,
        updated_at: row.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
          access_minutes: Number(row?.access_minutes || 0),
          ticket_channel_id: row?.ticket_channel_id || null,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.accepted_at) {
      events.push({
        id: `vc-accepted-${row?.token || row?.accepted_at}`,
        title: "VC Verification Accepted",
        description: "A staff member accepted your VC verification request.",
        reason: "",
        event_type: "vc_verify_accepted",
        created_at: row.accepted_at,
        updated_at: row.accepted_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.started_at) {
      events.push({
        id: `vc-started-${row?.token || row?.started_at}`,
        title: "VC Verification Started",
        description: "Your VC verification session started.",
        reason: "",
        event_type: "vc_verify_started",
        created_at: row.started_at,
        updated_at: row.started_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.completed_at) {
      events.push({
        id: `vc-completed-${row?.token || row?.completed_at}`,
        title: "VC Verification Completed",
        description: `VC verification finished with status ${status}.`,
        reason: "",
        event_type: "vc_verify_completed",
        created_at: row.completed_at,
        updated_at: row.completed_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.canceled_at) {
      events.push({
        id: `vc-canceled-${row?.token || row?.canceled_at}`,
        title: "VC Verification Ended",
        description: `VC verification ended with status ${status}.`,
        reason: "",
        event_type: "vc_verify_ended",
        created_at: row.canceled_at,
        updated_at: row.canceled_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }
  }

  return events.filter((event) => event?.created_at);
}

function buildJoinEvents(rows) {
  return safeArray(rows)
    .filter(Boolean)
    .map((row) => ({
      id: `member-join-${row?.id || row?.joined_at}`,
      title: "Joined Server",
      description: "Your member profile was recorded in the server.",
      reason: row?.join_source || row?.entry_method || "",
      event_type: "member_join",
      created_at: row?.joined_at || null,
      updated_at: row?.joined_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: {
        join_source: row?.join_source || null,
        entry_method: row?.entry_method || null,
        invite_code: row?.invite_code || null,
      },
      _source: "member_joins",
    }))
    .filter((event) => event?.created_at);
}

function buildMemberEventsTimeline(rows) {
  return safeArray(rows)
    .filter(Boolean)
    .map((row) => ({
      id: `member-event-${row?.id || row?.created_at}`,
      title: row?.title || "Member Event",
      description: row?.reason || "",
      reason: row?.reason || "",
      event_type: row?.event_type || "member_event",
      created_at: row?.created_at || null,
      updated_at: row?.created_at || null,
      actor_id: row?.actor_id || null,
      actor_name: row?.actor_name || "System",
      ticket_id: null,
      metadata: safeObject(row?.metadata),
      _source: "member_events",
    }))
    .filter((event) => event?.created_at);
}

function normalizeEventObject(event) {
  if (!event) return null;

  return {
    id: event?.id || null,
    title: event?.title || "Activity",
    description: event?.description || "",
    reason: event?.reason || "",
    event_type: event?.event_type || "activity",
    created_at: event?.created_at || null,
    updated_at: event?.updated_at || event?.created_at || null,
    actor_id: event?.actor_id || null,
    actor_name: event?.actor_name || "System",
    ticket_id: event?.ticket_id || null,
    metadata:
      event?.metadata && typeof event.metadata === "object" ? event.metadata : {},
    _source: event?._source || "activity",
  };
}

function buildRecentActivity({
  tickets,
  verificationFlags,
  verificationTokens,
  vcSessions,
  joinHistory,
  memberEvents,
  activityFeedRows,
  limit = 25,
}) {
  const merged = [
    ...safeArray(activityFeedRows).map(sanitizeActivityFeedRow),
    ...buildTicketLifecycleEvents(tickets),
    ...buildVerificationFlagEvents(verificationFlags),
    ...buildVerificationTokenEvents(verificationTokens),
    ...buildVcSessionEvents(vcSessions),
    ...buildJoinEvents(joinHistory),
    ...buildMemberEventsTimeline(memberEvents),
  ]
    .map(normalizeEventObject)
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at));

  const deduped = [];
  const seen = new Set();

  for (const item of merged) {
    const key = `${item?._source || "activity"}:${item?.id || ""}:${item?.created_at || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function buildUsernameHistory({ member, viewer, joinHistory, recentTickets }) {
  const rows = [];

  function pushRow(source, createdAt, username, displayName, nickname) {
    const cleanUser = normalizeString(username);
    const cleanDisplay = normalizeString(displayName);
    const cleanNick = normalizeString(nickname);

    if (!cleanUser && !cleanDisplay && !cleanNick) return;

    rows.push({
      id: `${source}:${createdAt || cleanUser || cleanDisplay || cleanNick}`,
      created_at: createdAt || null,
      username: cleanUser || null,
      display_name: cleanDisplay || null,
      nickname: cleanNick || null,
      source,
    });
  }

  pushRow(
    "current_member",
    member?.joined_at || null,
    member?.username,
    member?.display_name,
    member?.nickname
  );

  pushRow(
    "viewer_session",
    null,
    viewer?.username,
    viewer?.global_name,
    null
  );

  for (const value of safeArray(member?.previous_usernames)) {
    pushRow("guild_members_previous_username", null, value, null, null);
  }

  for (const value of safeArray(member?.previous_display_names)) {
    pushRow("guild_members_previous_display_name", null, null, value, null);
  }

  for (const value of safeArray(member?.previous_nicknames)) {
    pushRow("guild_members_previous_nickname", null, null, null, value);
  }

  pushRow(
    "guild_members_last_seen",
    null,
    member?.last_seen_username,
    member?.last_seen_display_name,
    member?.last_seen_nickname
  );

  for (const row of safeArray(joinHistory)) {
    pushRow(
      "member_joins",
      row?.joined_at,
      row?.username,
      row?.display_name,
      null
    );
  }

  for (const ticket of safeArray(recentTickets)) {
    pushRow(
      "tickets",
      ticket?.created_at,
      ticket?.username,
      null,
      null
    );
  }

  const sorted = rows.sort(
    (a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at)
  );

  const uniqueRows = uniqueBy(
    sorted,
    (row) =>
      `${normalizeString(row?.username).toLowerCase()}|${normalizeString(row?.display_name).toLowerCase()}|${normalizeString(row?.nickname).toLowerCase()}`
  );

  return uniqueRows.slice(0, 30);
}

function deriveHistoricalUsernames({ member, viewer, usernameHistory }) {
  const candidates = [];

  pushCandidate(candidates, member?.username);
  pushCandidate(candidates, member?.display_name);
  pushCandidate(candidates, member?.nickname);
  pushCandidate(candidates, member?.last_seen_username);
  pushCandidate(candidates, member?.last_seen_display_name);
  pushCandidate(candidates, member?.last_seen_nickname);
  pushCandidate(candidates, viewer?.username);
  pushCandidate(candidates, viewer?.global_name);

  for (const value of safeArray(member?.previous_usernames)) {
    pushCandidate(candidates, value);
  }
  for (const value of safeArray(member?.previous_display_names)) {
    pushCandidate(candidates, value);
  }
  for (const value of safeArray(member?.previous_nicknames)) {
    pushCandidate(candidates, value);
  }

  for (const row of safeArray(usernameHistory)) {
    pushCandidate(candidates, row?.username);
    pushCandidate(candidates, row?.display_name);
    pushCandidate(candidates, row?.nickname);
  }

  return dedupeStrings(candidates).slice(0, 30);
}

function buildTicketSummary(recentTickets) {
  const statusCounts = {};
  const priorityCounts = {};
  const categoryCounts = {};

  for (const ticket of safeArray(recentTickets)) {
    const status =
      normalizeString(ticket?.status || "unknown").toLowerCase() || "unknown";
    const priority =
      normalizeString(ticket?.priority || "medium").toLowerCase() || "medium";
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
  const latestJoin =
    safeArray(joinHistory).sort(
      (a, b) => parseDateMs(b?.joined_at) - parseDateMs(a?.joined_at)
    )[0] || null;

  return {
    joined_at: latestJoin?.joined_at || member?.joined_at || null,
    join_source:
      latestJoin?.join_source ||
      latestJoin?.entry_method ||
      member?.verification_source ||
      member?.entry_method ||
      null,
    entry_method:
      latestJoin?.entry_method ||
      latestJoin?.join_source ||
      member?.entry_method ||
      member?.verification_source ||
      null,
    invite_code: latestJoin?.invite_code || member?.invite_code || null,
    inviter_id: latestJoin?.inviter_id || member?.invited_by || null,
    inviter_name: latestJoin?.inviter_name || member?.invited_by_name || null,
    vanity_used: Boolean(latestJoin?.vanity_used),
    raw: latestJoin?.raw || null,
  };
}

function buildRecentVouches(member, joinHistory) {
  const rows = [];

  const currentVouchActorId = normalizeString(member?.vouched_by);
  const currentVouchActorName = normalizeString(member?.vouched_by_name);

  if (currentVouchActorId || currentVouchActorName) {
    rows.push({
      id: `member-vouch-${currentVouchActorId || currentVouchActorName}`,
      created_at: member?.joined_at || null,
      actor_id: currentVouchActorId || null,
      actor_name: currentVouchActorName || currentVouchActorId || null,
      target_user_id: member?.user_id || null,
      reason: member?.entry_reason || "Member was vouched into the server.",
      raw: null,
    });
  }

  for (const row of safeArray(joinHistory)) {
    const actorId = normalizeString(row?.vouched_by);
    const actorName = normalizeString(row?.vouched_by_name);
    if (!actorId && !actorName) continue;

    rows.push({
      id: `join-vouch-${row?.id || row?.joined_at || actorId || actorName}`,
      created_at: row?.joined_at || null,
      actor_id: actorId || null,
      actor_name: actorName || actorId || null,
      target_user_id: member?.user_id || null,
      reason: row?.join_note || "Member was vouched into the server.",
      raw: row?.raw || null,
    });
  }

  return uniqueBy(
    rows.sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at)),
    (row) => row?.id
  ).slice(0, 15);
}

function deriveVerificationSummary({
  member,
  verificationFlags,
  verificationTokens,
  vcSessions,
  openTicket,
}) {
  const flags = safeArray(verificationFlags);
  const tokens = safeArray(verificationTokens);
  const vc = safeArray(vcSessions);

  const latestToken = sortByCreatedDesc(tokens)[0] || null;
  const latestVc = sortByCreatedDesc(vc)[0] || null;

  let status = "unknown";

  if (member?.has_staff_role) {
    status = "staff";
  } else if (
    member?.has_verified_role ||
    member?.has_secondary_verified_role ||
    normalizeString(latestToken?.status).toLowerCase() === "approved" ||
    normalizeString(latestToken?.decision).toUpperCase() === "APPROVED"
  ) {
    status = "verified";
  } else if (
    normalizeString(latestToken?.status).toLowerCase() === "denied" ||
    normalizeString(latestToken?.decision).toUpperCase() === "DENIED"
  ) {
    status = "denied";
  } else if (flags.some((item) => item?.flagged)) {
    status = "needs_review";
  } else if (
    ["PENDING", "ACCEPTED", "READY", "STARTED", "IN_VC", "STAFF_ACCEPTED"].includes(
      normalizeString(latestVc?.status).toUpperCase()
    )
  ) {
    status = "vc_in_progress";
  } else if (
    ["submitted", "pending", "resubmit", "used"].includes(
      normalizeString(latestToken?.status).toLowerCase()
    ) ||
    member?.has_unverified ||
    openTicket
  ) {
    status = "pending";
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
      sortByCreatedDesc(vc)[0]?.status || null,
    token_count: tokens.length,
    token_latest_status: latestToken?.status || null,
    token_latest_decision: latestToken?.decision || null,
    token_submitted_count: tokens.filter(
      (item) => normalizeString(item?.status).toLowerCase() === "submitted"
    ).length,
    token_pending_count: tokens.filter(
      (item) => normalizeString(item?.status).toLowerCase() === "pending"
    ).length,
    token_approved_count: tokens.filter(
      (item) =>
        normalizeString(item?.status).toLowerCase() === "approved" ||
        normalizeString(item?.decision).toUpperCase() === "APPROVED"
    ).length,
    token_denied_count: tokens.filter(
      (item) =>
        normalizeString(item?.status).toLowerCase() === "denied" ||
        normalizeString(item?.decision).toUpperCase() === "DENIED"
    ).length,
    open_ticket_id: openTicket?.id || null,
  };
}

function buildRelationshipSummary({ member, joinHistory, vouches, recentTickets }) {
  const entry = deriveEntry(joinHistory, member);

  return {
    entry_method: entry?.entry_method || member?.entry_method || null,
    verification_source:
      entry?.join_source || member?.verification_source || null,
    entry_reason: member?.entry_reason || null,
    approval_reason: member?.approval_reason || null,
    invite_code: entry?.invite_code || member?.invite_code || null,
    inviter_id: entry?.inviter_id || member?.invited_by || null,
    inviter_name: entry?.inviter_name || member?.invited_by_name || null,
    vanity_used: Boolean(entry?.vanity_used),
    vouched_by: member?.vouched_by || null,
    vouched_by_name: member?.vouched_by_name || null,
    approved_by: member?.approved_by || null,
    approved_by_name: member?.approved_by_name || null,
    verification_ticket_id: member?.verification_ticket_id || null,
    source_ticket_id:
      member?.source_ticket_id ||
      safeArray(recentTickets)[0]?.id ||
      null,
    vouch_count: safeArray(vouches).length,
    latest_vouch_at:
      safeArray(vouches)
        .map((item) => item?.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

function buildStats({
  recentTickets,
  verificationFlags,
  verificationTokens,
  vcSessions,
  recentActivity,
}) {
  return {
    ticket_count: safeArray(recentTickets).length,
    activity_count: safeArray(recentActivity).length,
    verification_flag_count: safeArray(verificationFlags).length,
    verification_token_count: safeArray(verificationTokens).length,
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
      memberRowRaw,
      categories,
      verificationFlags,
      verificationTokens,
      rawVcSessionRows,
      joinHistory,
      memberEvents,
      rawTicketRows,
    ] = await Promise.all([
      loadMemberRow(supabase, guildId, viewer.discord_id),
      loadTicketCategories(supabase, guildId),
      loadVerificationFlags(supabase, guildId, viewer.discord_id),
      loadVerificationTokens(supabase, guildId, viewer.discord_id),
      loadRawVcSessions(supabase, viewer.discord_id),
      loadJoinHistory(supabase, guildId, viewer.discord_id),
      loadMemberEvents(supabase, guildId, viewer.discord_id),
      loadRecentTickets(supabase, guildId, viewer.discord_id),
    ]);

    const member = sanitizeMember(memberRowRaw, viewer);

    const staffIds = dedupeStrings([
      ...safeArray(rawTicketRows).map((row) => row?.claimed_by),
      ...safeArray(rawTicketRows).map((row) => row?.assigned_to),
      ...safeArray(rawTicketRows).map((row) => row?.closed_by),
      ...safeArray(rawVcSessionRows).map((row) => row?.accepted_by),
      ...safeArray(rawVcSessionRows).map((row) => row?.canceled_by),
    ]);

    const staffLookup = await loadMemberLookupByIds(supabase, guildId, staffIds);

    const vcSessions = safeArray(rawVcSessionRows).map((row) =>
      sanitizeVcSession(row, staffLookup)
    );

    const visibleTickets = safeArray(rawTicketRows)
      .map((ticket) => ({
        ...ticket,
        priority: ticket?.priority || derivePriority(ticket),
        channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      }))
      .filter((ticket) => !shouldHideStaleTicket(ticket))
      .map((ticket) => sanitizeUserTicket(ticket, staffLookup));

    const recentTickets = sortTickets(visibleTickets, "updated_desc");
    const openTicket =
      recentTickets.find((ticket) =>
        ["open", "claimed"].includes(normalizeString(ticket?.status).toLowerCase())
      ) || null;

    const ticketIds = recentTickets.map((ticket) => ticket?.id).filter(Boolean);
    const activityFeedRows = await loadActivityFeedEvents(
      supabase,
      guildId,
      viewer.discord_id,
      ticketIds
    );

    const usernameHistory = buildUsernameHistory({
      member,
      viewer,
      joinHistory,
      recentTickets,
    });

    const historicalUsernames = deriveHistoricalUsernames({
      member,
      viewer,
      usernameHistory,
    });

    const vouches = buildRecentVouches(member, joinHistory);

    const recentActivity = buildRecentActivity({
      tickets: recentTickets,
      verificationFlags,
      verificationTokens,
      vcSessions,
      joinHistory,
      memberEvents,
      activityFeedRows,
      limit: 25,
    });

    const entry = deriveEntry(joinHistory, member);
    const ticketSummary = buildTicketSummary(recentTickets);
    const verification = deriveVerificationSummary({
      member,
      verificationFlags,
      verificationTokens,
      vcSessions,
      openTicket,
    });
    const relationships = buildRelationshipSummary({
      member,
      joinHistory,
      vouches,
      recentTickets,
    });
    const stats = buildStats({
      recentTickets,
      verificationFlags,
      verificationTokens,
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
        verificationTokens,
        verification,
        vcSessions,
        joinHistory,
        memberEvents,
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
