import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";
import { derivePriority, sortTickets } from "@/lib/priority";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRecord = Record<string, any>;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function parseDateMs(value: unknown): number {
  const ms = new Date(String(value || 0)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function selectedGuildId(): string {
  return normalizeString(getSelectedGuildId());
}

function json(payload: AnyRecord, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function getSessionUser(session: AnyRecord): AnyRecord {
  return safeObject(session?.user || session?.discordUser || {});
}

function getViewerFromSession(session: AnyRecord, guildId: string) {
  const user = getSessionUser(session);
  const discordId =
    normalizeString(user.discord_id) ||
    normalizeString(user.id) ||
    normalizeString(session?.discordUser?.id);

  return {
    discord_id: discordId,
    username:
      normalizeString(user.username) ||
      normalizeString(session?.discordUser?.username) ||
      "Member",
    global_name:
      normalizeString(user.global_name) ||
      normalizeString(user.name) ||
      normalizeString(user.username) ||
      "Member",
    avatar_url:
      normalizeString(user.avatar_url) ||
      normalizeString(user.avatar) ||
      normalizeString(user.image) ||
      null,
    isStaff: Boolean(session?.isStaff),
    guild_id: guildId || null,
  };
}

async function safeRows(supabase: any, table: string, build: (query: any) => any): Promise<AnyRecord[]> {
  try {
    const query = supabase.from(table).select("*");
    const { data } = await build(query);
    return safeArray<AnyRecord>(data);
  } catch {
    return [];
  }
}

async function safeSingle(supabase: any, table: string, build: (query: any) => any): Promise<AnyRecord | null> {
  try {
    const query = supabase.from(table).select("*");
    const { data } = await build(query);
    return data ? safeObject(data) : null;
  } catch {
    return null;
  }
}

function sanitizeMember(row: AnyRecord | null, viewer: AnyRecord) {
  const member = safeObject(row);
  return {
    ...member,
    guild_id: normalizeString(member.guild_id) || viewer.guild_id || null,
    user_id: normalizeString(member.user_id) || viewer.discord_id || null,
    username: normalizeString(member.username) || viewer.username || "Member",
    display_name:
      normalizeString(member.display_name) ||
      normalizeString(member.nickname) ||
      viewer.global_name ||
      viewer.username ||
      "Member",
    nickname: normalizeString(member.nickname) || null,
    avatar_url: normalizeString(member.avatar_url) || viewer.avatar_url || null,
    joined_at: normalizeString(member.joined_at) || null,
    role_names: safeArray<string>(member.role_names),
    role_ids: safeArray<string>(member.role_ids),
    roles: safeArray(member.roles),
    has_unverified: Boolean(member.has_unverified),
    has_verified_role: Boolean(member.has_verified_role),
    has_staff_role: Boolean(member.has_staff_role),
    has_secondary_verified_role: Boolean(member.has_secondary_verified_role),
    has_cosmetic_only: Boolean(member.has_cosmetic_only),
    role_state: normalizeString(member.role_state) || "unknown",
    role_state_reason: normalizeString(member.role_state_reason) || "",
    previous_usernames: safeArray<string>(member.previous_usernames),
    previous_display_names: safeArray<string>(member.previous_display_names),
    previous_nicknames: safeArray<string>(member.previous_nicknames),
    last_seen_username: normalizeString(member.last_seen_username) || null,
    last_seen_display_name: normalizeString(member.last_seen_display_name) || null,
    last_seen_nickname: normalizeString(member.last_seen_nickname) || null,
    invited_by: normalizeString(member.invited_by) || null,
    invited_by_name: normalizeString(member.invited_by_name) || null,
    invite_code: normalizeString(member.invite_code) || null,
    vouched_by: normalizeString(member.vouched_by) || null,
    vouched_by_name: normalizeString(member.vouched_by_name) || null,
    approved_by: normalizeString(member.approved_by) || null,
    approved_by_name: normalizeString(member.approved_by_name) || null,
    verification_ticket_id: normalizeString(member.verification_ticket_id) || null,
    source_ticket_id: normalizeString(member.source_ticket_id) || null,
    entry_method: normalizeString(member.entry_method) || null,
    verification_source: normalizeString(member.verification_source) || null,
    join_source: normalizeString(member.join_source || member.entry_source) || null,
    vanity_used: Boolean(member.vanity_used),
    entry_reason: normalizeString(member.entry_reason) || null,
    approval_reason: normalizeString(member.approval_reason) || null,
    top_role:
      normalizeString(member.top_role) ||
      normalizeString(member.highest_role_name) ||
      safeArray<string>(member.role_names)[0] ||
      null,
    in_guild: member.in_guild !== false,
    times_joined: normalizeNumber(member.times_joined, 0),
    times_left: normalizeNumber(member.times_left, 0),
  };
}

function sanitizeCategory(row: AnyRecord) {
  return {
    id: normalizeString(row.id) || null,
    name: normalizeString(row.name) || "Support",
    slug: normalizeString(row.slug) || "support",
    color: normalizeString(row.color) || "#45d483",
    description: normalizeString(row.description),
    intake_type: normalizeString(row.intake_type) || "general",
    button_label: normalizeString(row.button_label) || `Open ${normalizeString(row.name) || "Support"} Ticket`,
    is_default: Boolean(row.is_default),
    sort_order: row.sort_order ?? null,
    staff_role_ids: safeArray<string>(row.staff_role_ids),
    staff_role_names: safeArray<string>(row.staff_role_names),
    match_keywords: safeArray<string>(row.match_keywords),
  };
}

function sanitizeTicket(row: AnyRecord) {
  return {
    id: normalizeString(row.id) || null,
    title: normalizeString(row.title || row.channel_name) || "Ticket",
    category: normalizeString(row.category) || null,
    matched_category_name: normalizeString(row.matched_category_name) || null,
    matched_category_slug: normalizeString(row.matched_category_slug) || null,
    matched_intake_type: normalizeString(row.matched_intake_type) || null,
    matched_category_reason: normalizeString(row.matched_category_reason) || null,
    matched_category_score: normalizeNumber(row.matched_category_score, 0),
    status: normalizeString(row.status) || "open",
    priority: normalizeString(row.priority) || derivePriority(row as never) || "medium",
    claimed_by: normalizeString(row.claimed_by) || null,
    claimed_by_name: normalizeString(row.claimed_by_name) || null,
    assigned_to: normalizeString(row.assigned_to) || null,
    assigned_to_name: normalizeString(row.assigned_to_name) || null,
    closed_by: normalizeString(row.closed_by) || null,
    closed_by_name: normalizeString(row.closed_by_name) || null,
    closed_reason: normalizeString(row.closed_reason) || null,
    created_at: normalizeString(row.created_at) || null,
    updated_at: normalizeString(row.updated_at) || null,
    closed_at: normalizeString(row.closed_at) || null,
    deleted_at: normalizeString(row.deleted_at) || null,
    reopened_at: normalizeString(row.reopened_at) || null,
    sla_deadline: normalizeString(row.sla_deadline) || null,
    channel_id: normalizeString(row.channel_id || row.discord_thread_id) || null,
    channel_name: normalizeString(row.channel_name) || null,
    transcript_url: normalizeString(row.transcript_url) || null,
    source: normalizeString(row.source) || null,
    initial_message: normalizeString(row.initial_message),
    is_ghost: Boolean(row.is_ghost),
    ticket_number: Number.isFinite(Number(row.ticket_number)) ? Number(row.ticket_number) : null,
    username: normalizeString(row.username) || null,
  };
}

function sanitizeFlag(row: AnyRecord) {
  return {
    id: normalizeString(row.id) || null,
    created_at: normalizeString(row.created_at) || null,
    score: normalizeNumber(row.score, 0),
    flagged: Boolean(row.flagged),
    reasons: safeArray<string>(row.reasons),
    note: normalizeString(row.note),
    raw: row,
  };
}

function sanitizeToken(row: AnyRecord) {
  return {
    token: normalizeString(row.token) || null,
    status: normalizeString(row.status) || "pending",
    decision: normalizeString(row.decision || "PENDING").toUpperCase(),
    used: Boolean(row.used),
    submitted: Boolean(row.submitted || row.submitted_at),
    created_at: normalizeString(row.created_at) || null,
    updated_at: normalizeString(row.updated_at) || null,
    submitted_at: normalizeString(row.submitted_at) || null,
    decided_at: normalizeString(row.decided_at) || null,
    expires_at: normalizeString(row.expires_at) || null,
    requester_id: normalizeString(row.requester_id) || null,
    approved_user_id: normalizeString(row.approved_user_id) || null,
    decided_by: normalizeString(row.decided_by) || null,
    decided_by_display_name: normalizeString(row.decided_by_display_name) || null,
    decided_by_username: normalizeString(row.decided_by_username) || null,
    role_sync_ok: Boolean(row.role_sync_ok),
    role_sync_reason: normalizeString(row.role_sync_reason) || null,
    ai_status: normalizeString(row.ai_status) || null,
    expected_role_state: normalizeString(row.expected_role_state) || null,
    actual_role_state: normalizeString(row.actual_role_state) || null,
    channel_id: normalizeString(row.channel_id) || null,
    raw: row,
  };
}

function sanitizeVcSession(row: AnyRecord) {
  const meta = safeObject(row.meta);
  return {
    token: normalizeString(row.token) || null,
    status: normalizeString(row.status || "PENDING").toUpperCase(),
    created_at: normalizeString(row.created_at) || null,
    accepted_at: normalizeString(row.accepted_at) || null,
    started_at: normalizeString(row.started_at) || null,
    completed_at: normalizeString(row.completed_at) || null,
    canceled_at: normalizeString(row.canceled_at) || null,
    access_minutes: normalizeNumber(row.access_minutes, 0),
    requester_id: normalizeString(row.requester_id) || null,
    owner_id: normalizeString(row.owner_id) || null,
    accepted_by: normalizeString(row.accepted_by) || null,
    canceled_by: normalizeString(row.canceled_by) || null,
    staff_id: normalizeString(row.accepted_by || row.staff_id) || null,
    staff_name: normalizeString(row.staff_name || meta.staff_name) || null,
    ticket_id: normalizeString(row.ticket_id) || null,
    ticket_channel_id: normalizeString(row.ticket_channel_id) || null,
    vc_channel_id: normalizeString(row.vc_channel_id) || null,
    queue_channel_id: normalizeString(row.queue_channel_id) || null,
    queue_message_id: normalizeString(row.queue_message_id) || null,
    revoke_at: normalizeString(row.revoke_at) || null,
    last_watchdog_at: normalizeString(row.last_watchdog_at) || null,
    meta,
    raw: row,
  };
}

function sanitizeJoin(row: AnyRecord) {
  return {
    id: normalizeString(row.id) || null,
    joined_at: normalizeString(row.joined_at) || null,
    join_source: normalizeString(row.join_source) || null,
    entry_method: normalizeString(row.entry_method) || null,
    verification_source: normalizeString(row.verification_source) || null,
    invite_code: normalizeString(row.invite_code) || null,
    inviter_id: normalizeString(row.invited_by || row.inviter_id) || null,
    inviter_name: normalizeString(row.invited_by_name || row.inviter_name) || null,
    vouched_by: normalizeString(row.vouched_by) || null,
    vouched_by_name: normalizeString(row.vouched_by_name) || null,
    approved_by: normalizeString(row.approved_by) || null,
    approved_by_name: normalizeString(row.approved_by_name) || null,
    source_ticket_id: normalizeString(row.source_ticket_id) || null,
    join_note: normalizeString(row.join_note) || null,
    vanity_used: Boolean(row.vanity_used),
    username: normalizeString(row.username) || null,
    display_name: normalizeString(row.display_name) || null,
    raw: row,
  };
}

function sanitizeMemberEvent(row: AnyRecord) {
  return {
    id: normalizeString(row.id) || null,
    created_at: normalizeString(row.created_at) || null,
    event_type: normalizeString(row.event_type) || "member_event",
    title: normalizeString(row.title) || "Member Event",
    reason: normalizeString(row.reason),
    actor_id: normalizeString(row.actor_id) || null,
    actor_name: normalizeString(row.actor_name) || "System",
    metadata: safeObject(row.metadata),
    raw: row,
  };
}

function sanitizeActivity(row: AnyRecord) {
  return {
    id: normalizeString(row.id) || null,
    title: normalizeString(row.title) || "Activity",
    description: normalizeString(row.description),
    reason: normalizeString(row.reason),
    event_type: normalizeString(row.event_type) || "activity",
    created_at: normalizeString(row.created_at) || null,
    updated_at: normalizeString(row.updated_at || row.created_at) || null,
    actor_id: normalizeString(row.actor_user_id) || null,
    actor_name: normalizeString(row.actor_name) || "System",
    ticket_id: normalizeString(row.ticket_id) || null,
    metadata: safeObject(row.metadata),
    _source: normalizeString(row.source) || "activity_feed_events",
  };
}

function sortNewest(rows: AnyRecord[], ...fields: string[]) {
  return [...safeArray<AnyRecord>(rows)].sort((a, b) => {
    const aMs = Math.max(...fields.map((field) => parseDateMs(a?.[field])));
    const bMs = Math.max(...fields.map((field) => parseDateMs(b?.[field])));
    return bMs - aMs;
  });
}

function buildTicketSummary(tickets: AnyRecord[]) {
  const status_counts: Record<string, number> = {};
  const priority_counts: Record<string, number> = {};
  const category_counts: Record<string, number> = {};

  for (const ticket of safeArray<AnyRecord>(tickets)) {
    const status = normalizeLower(ticket.status || "unknown") || "unknown";
    const priority = normalizeLower(ticket.priority || "medium") || "medium";
    const category = normalizeLower(ticket.matched_category_slug || ticket.category || "support") || "support";
    status_counts[status] = (status_counts[status] || 0) + 1;
    priority_counts[priority] = (priority_counts[priority] || 0) + 1;
    category_counts[category] = (category_counts[category] || 0) + 1;
  }

  return {
    total: tickets.length,
    open: (status_counts.open || 0) + (status_counts.claimed || 0),
    closed: status_counts.closed || 0,
    deleted: status_counts.deleted || 0,
    claimed: status_counts.claimed || 0,
    status_counts,
    priority_counts,
    category_counts,
    latest_ticket_at:
      tickets
        .map((ticket) => ticket.updated_at || ticket.created_at)
        .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
  };
}

function buildEntry(member: AnyRecord, joinHistory: AnyRecord[]) {
  const latestJoin = sortNewest(joinHistory, "joined_at")[0] || null;
  const joinSource = latestJoin?.join_source || latestJoin?.verification_source || latestJoin?.entry_method || member.join_source || member.verification_source || member.entry_method || null;
  const entryMethod = latestJoin?.entry_method || member.entry_method || latestJoin?.join_source || member.join_source || latestJoin?.verification_source || member.verification_source || null;
  const inviteCode = latestJoin?.invite_code || member.invite_code || null;
  const inviterId = latestJoin?.inviter_id || member.invited_by || null;
  const inviterName = latestJoin?.inviter_name || member.invited_by_name || null;
  const vouchedBy = latestJoin?.vouched_by || member.vouched_by || null;
  const vouchedByName = latestJoin?.vouched_by_name || member.vouched_by_name || null;
  const approvedBy = latestJoin?.approved_by || member.approved_by || null;
  const approvedByName = latestJoin?.approved_by_name || member.approved_by_name || null;
  const vanityUsed = Boolean(latestJoin?.vanity_used || member.vanity_used);

  let source_confidence = "unknown";
  let source_truth_reason = "The dashboard does not have enough join-source detail yet.";
  if (vouchedBy || vouchedByName || vanityUsed || inviteCode || inviterId || inviterName) {
    source_confidence = "confirmed";
    source_truth_reason = "A tracked join, invite, vanity, or vouch trail exists for this member.";
  } else if (approvedBy || approvedByName || joinSource || entryMethod) {
    source_confidence = "partial";
    source_truth_reason = "A partial entry path exists, but the detailed source trail is incomplete.";
  }

  return {
    joined_at: latestJoin?.joined_at || member.joined_at || null,
    join_source: joinSource,
    entry_method: entryMethod,
    verification_source: latestJoin?.verification_source || member.verification_source || null,
    invite_code: inviteCode,
    inviter_id: inviterId,
    inviter_name: inviterName,
    vouched_by: vouchedBy,
    vouched_by_name: vouchedByName,
    approved_by: approvedBy,
    approved_by_name: approvedByName,
    source_ticket_id: latestJoin?.source_ticket_id || member.source_ticket_id || null,
    join_note: latestJoin?.join_note || null,
    vanity_used: vanityUsed,
    source_confidence,
    source_truth_reason,
    raw: latestJoin?.raw || latestJoin || null,
  };
}

function buildVerification(member: AnyRecord, flags: AnyRecord[], tokens: AnyRecord[], vcSessions: AnyRecord[], openTicket: AnyRecord | null) {
  const latestToken = sortNewest(tokens, "created_at", "updated_at", "decided_at")[0] || null;
  const latestVc = sortNewest(vcSessions, "created_at", "accepted_at", "started_at", "completed_at", "canceled_at")[0] || null;
  let status = "unknown";

  if (member.has_staff_role) status = "staff";
  else if (member.has_verified_role || member.has_secondary_verified_role || normalizeLower(latestToken?.status) === "approved" || normalizeString(latestToken?.decision).toUpperCase() === "APPROVED") status = "verified";
  else if (normalizeLower(latestToken?.status) === "denied" || normalizeString(latestToken?.decision).toUpperCase() === "DENIED") status = "denied";
  else if (flags.some((item) => item.flagged)) status = "needs_review";
  else if (["PENDING", "ACCEPTED", "READY", "STARTED", "IN_VC", "STAFF_ACCEPTED"].includes(normalizeString(latestVc?.status).toUpperCase())) status = "vc_in_progress";
  else if (member.has_unverified || openTicket) status = "pending";

  return {
    status,
    has_unverified: Boolean(member.has_unverified),
    has_verified_role: Boolean(member.has_verified_role),
    has_secondary_verified_role: Boolean(member.has_secondary_verified_role),
    has_staff_role: Boolean(member.has_staff_role),
    flag_count: flags.length,
    flagged_count: flags.filter((item) => item.flagged).length,
    latest_flag_at: flags.map((item) => item.created_at).sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
    vc_request_count: vcSessions.length,
    vc_completed_count: vcSessions.filter((item) => item.completed_at).length,
    vc_latest_status: latestVc?.status || null,
    token_count: tokens.length,
    token_latest_status: latestToken?.status || null,
    token_latest_decision: latestToken?.decision || null,
    token_submitted_count: tokens.filter((item) => normalizeLower(item.status) === "submitted").length,
    token_pending_count: tokens.filter((item) => normalizeLower(item.status) === "pending").length,
    token_approved_count: tokens.filter((item) => normalizeLower(item.status) === "approved" || normalizeString(item.decision).toUpperCase() === "APPROVED").length,
    token_denied_count: tokens.filter((item) => normalizeLower(item.status) === "denied" || normalizeString(item.decision).toUpperCase() === "DENIED").length,
    open_ticket_id: openTicket?.id || null,
  };
}

function buildRecentActivity(args: {
  tickets: AnyRecord[];
  flags: AnyRecord[];
  tokens: AnyRecord[];
  vcSessions: AnyRecord[];
  joins: AnyRecord[];
  memberEvents: AnyRecord[];
  activityFeed: AnyRecord[];
}) {
  const events: AnyRecord[] = [
    ...args.activityFeed.map(sanitizeActivity),
    ...args.tickets.map((ticket) => ({
      id: `ticket-${ticket.id || ticket.created_at}`,
      title: ticket.status === "closed" ? "Ticket Closed" : "Ticket Opened",
      description: ticket.title || "Ticket activity",
      reason: ticket.initial_message || ticket.closed_reason || "",
      event_type: ticket.status === "closed" ? "ticket_closed" : "ticket_created",
      created_at: ticket.closed_at || ticket.created_at || ticket.updated_at || null,
      updated_at: ticket.updated_at || ticket.created_at || null,
      actor_id: ticket.closed_by || null,
      actor_name: ticket.closed_by_name || "System",
      ticket_id: ticket.id || null,
      metadata: { status: ticket.status, category: ticket.category || ticket.matched_category_slug || null },
      _source: "tickets",
    })),
    ...args.flags.map((flag) => ({
      id: `flag-${flag.id || flag.created_at}`,
      title: flag.flagged ? "Verification Flag Raised" : "Verification Reviewed",
      description: flag.flagged ? "Your verification was flagged for manual review." : "Verification review activity detected.",
      reason: safeArray(flag.reasons).join(" • "),
      event_type: "verification_flag",
      created_at: flag.created_at || null,
      updated_at: flag.created_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: { score: flag.score, reasons: safeArray(flag.reasons) },
      _source: "verification_flags",
    })),
    ...args.tokens.map((token) => ({
      id: `token-${token.token || token.created_at}`,
      title: "Verification Token Activity",
      description: `Verification token status: ${token.status || "pending"}.`,
      reason: token.role_sync_reason || "",
      event_type: "verification_token",
      created_at: token.updated_at || token.decided_at || token.submitted_at || token.created_at || null,
      updated_at: token.updated_at || token.created_at || null,
      actor_id: token.decided_by || null,
      actor_name: token.decided_by_display_name || token.decided_by_username || token.decided_by || "System",
      ticket_id: null,
      metadata: { token: token.token || null, status: token.status || null, decision: token.decision || null },
      _source: "verification_tokens",
    })),
    ...args.vcSessions.map((vc) => ({
      id: `vc-${vc.token || vc.created_at}`,
      title: "VC Verification Activity",
      description: `VC verification status: ${vc.status || "PENDING"}`,
      reason: "",
      event_type: "vc_verify",
      created_at: vc.completed_at || vc.started_at || vc.accepted_at || vc.canceled_at || vc.created_at || null,
      updated_at: vc.completed_at || vc.started_at || vc.accepted_at || vc.canceled_at || vc.created_at || null,
      actor_id: vc.staff_id || null,
      actor_name: vc.staff_name || vc.staff_id || "System",
      ticket_id: vc.ticket_id || null,
      metadata: { status: vc.status || null, ticket_channel_id: vc.ticket_channel_id || null },
      _source: "vc_verify_sessions",
    })),
    ...args.joins.map((join) => ({
      id: `join-${join.id || join.joined_at}`,
      title: "Joined Server",
      description: "Your member profile was recorded in the server.",
      reason: join.join_note || join.join_source || join.entry_method || join.verification_source || "",
      event_type: "member_join",
      created_at: join.joined_at || null,
      updated_at: join.joined_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: { invite_code: join.invite_code || null, inviter_id: join.inviter_id || null, inviter_name: join.inviter_name || null },
      _source: "member_joins",
    })),
    ...args.memberEvents.map((event) => ({
      id: `member-event-${event.id || event.created_at}`,
      title: event.title || "Member Event",
      description: event.reason || "",
      reason: event.reason || "",
      event_type: event.event_type || "member_event",
      created_at: event.created_at || null,
      updated_at: event.created_at || null,
      actor_id: event.actor_id || null,
      actor_name: event.actor_name || "System",
      ticket_id: null,
      metadata: event.metadata || {},
      _source: "member_events",
    })),
  ];

  return sortNewest(events.filter((item) => item.created_at), "created_at").slice(0, 25);
}

function buildUsernameHistory(member: AnyRecord, viewer: AnyRecord, joinHistory: AnyRecord[], tickets: AnyRecord[]) {
  const rows: AnyRecord[] = [];
  const push = (source: string, created_at: string | null, username: unknown, display_name: unknown, nickname: unknown) => {
    const cleanUser = normalizeString(username);
    const cleanDisplay = normalizeString(display_name);
    const cleanNick = normalizeString(nickname);
    if (!cleanUser && !cleanDisplay && !cleanNick) return;
    rows.push({ id: `${source}:${created_at || cleanUser || cleanDisplay || cleanNick}`, created_at, username: cleanUser || null, display_name: cleanDisplay || null, nickname: cleanNick || null, source });
  };

  push("current_member", member.joined_at || null, member.username, member.display_name, member.nickname);
  push("viewer_session", null, viewer.username, viewer.global_name, null);
  for (const value of safeArray(member.previous_usernames)) push("guild_members_previous_username", null, value, null, null);
  for (const value of safeArray(member.previous_display_names)) push("guild_members_previous_display_name", null, null, value, null);
  for (const value of safeArray(member.previous_nicknames)) push("guild_members_previous_nickname", null, null, null, value);
  push("guild_members_last_seen", null, member.last_seen_username, member.last_seen_display_name, member.last_seen_nickname);
  for (const row of joinHistory) push("member_joins", row.joined_at, row.username, row.display_name, null);
  for (const ticket of tickets) push("tickets", ticket.created_at, ticket.username, null, null);

  const seen = new Set<string>();
  return sortNewest(rows, "created_at")
    .filter((row) => {
      const key = `${normalizeLower(row.username)}|${normalizeLower(row.display_name)}|${normalizeLower(row.nickname)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

function buildVouches(member: AnyRecord, joinHistory: AnyRecord[]) {
  const rows: AnyRecord[] = [];
  if (member.vouched_by || member.vouched_by_name) {
    rows.push({
      id: `member-vouch-${member.vouched_by || member.vouched_by_name}`,
      created_at: member.joined_at || null,
      actor_id: member.vouched_by || null,
      actor_name: member.vouched_by_name || member.vouched_by || null,
      target_user_id: member.user_id || null,
      reason: member.entry_reason || "Member was vouched into the server.",
      raw: null,
    });
  }
  for (const row of joinHistory) {
    if (!row.vouched_by && !row.vouched_by_name) continue;
    rows.push({
      id: `join-vouch-${row.id || row.joined_at || row.vouched_by || row.vouched_by_name}`,
      created_at: row.joined_at || null,
      actor_id: row.vouched_by || null,
      actor_name: row.vouched_by_name || row.vouched_by || null,
      target_user_id: member.user_id || null,
      reason: row.join_note || "Member was vouched into the server.",
      raw: row.raw || row,
    });
  }
  return sortNewest(rows, "created_at").slice(0, 15);
}

export async function GET(): Promise<NextResponse> {
  try {
    const rawSession = (await getSession()) as AnyRecord | null;
    const session = safeObject(rawSession);

    if (!Object.keys(session).length) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const guildId = selectedGuildId();
    if (!guildId) {
      return json(
        {
          ok: false,
          error: "Select a server before opening the user dashboard.",
          needsServerSelection: true,
        },
        428
      );
    }

    const viewer = getViewerFromSession(session, guildId);
    if (!viewer.discord_id) return json({ ok: false, error: "Unauthorized" }, 401);

    const supabase = createServerSupabase();

    const [
      memberRow,
      categoryRows,
      flagRows,
      tokenRows,
      vcRows,
      joinRows,
      memberEventRows,
      ticketRows,
    ] = await Promise.all([
      safeSingle(supabase, "guild_members", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).maybeSingle()),
      safeRows(supabase, "ticket_categories", (q) => q.eq("guild_id", guildId).order("sort_order", { ascending: true }).order("name", { ascending: true })),
      safeRows(supabase, "verification_flags", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("created_at", { ascending: false }).limit(20)),
      safeRows(supabase, "verification_tokens", (q) => q.eq("guild_id", guildId).or(`requester_id.eq.${viewer.discord_id},user_id.eq.${viewer.discord_id},approved_user_id.eq.${viewer.discord_id}`).order("created_at", { ascending: false }).limit(25)),
      safeRows(supabase, "vc_verify_sessions", (q) => q.eq("guild_id", guildId).or(`owner_id.eq.${viewer.discord_id},requester_id.eq.${viewer.discord_id}`).order("created_at", { ascending: false }).limit(20)),
      safeRows(supabase, "member_joins", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("joined_at", { ascending: false }).limit(10)),
      safeRows(supabase, "member_events", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("created_at", { ascending: false }).limit(20)),
      safeRows(supabase, "tickets", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("updated_at", { ascending: false }).limit(50)),
    ]);

    const member = sanitizeMember(memberRow, viewer);
    const categories = categoryRows.map(sanitizeCategory);
    const verificationFlags = flagRows.map(sanitizeFlag);
    const verificationTokens = tokenRows.map(sanitizeToken);
    const vcSessions = vcRows.map(sanitizeVcSession);
    const joinHistory = joinRows.map(sanitizeJoin);
    const memberEvents = memberEventRows.map(sanitizeMemberEvent);
    const visibleTickets = ticketRows.map(sanitizeTicket);
    const recentTickets = sortTickets(visibleTickets as never, "updated_desc") as AnyRecord[];
    const openTicket = recentTickets.find((ticket) => ["open", "claimed"].includes(normalizeLower(ticket.status))) || null;
    const ticketIds = recentTickets.map((ticket) => ticket.id).filter(Boolean);
    const activityFeedRows = await safeRows(supabase, "activity_feed_events", (q) => {
      let query = q.eq("guild_id", guildId).or(`target_user_id.eq.${viewer.discord_id},actor_user_id.eq.${viewer.discord_id}`).order("created_at", { ascending: false }).limit(40);
      return query;
    });
    const ticketActivityRows = ticketIds.length
      ? await safeRows(supabase, "activity_feed_events", (q) => q.eq("guild_id", guildId).in("ticket_id", ticketIds).order("created_at", { ascending: false }).limit(40))
      : [];

    const recentActivity = buildRecentActivity({
      tickets: recentTickets,
      flags: verificationFlags,
      tokens: verificationTokens,
      vcSessions,
      joins: joinHistory,
      memberEvents,
      activityFeed: [...activityFeedRows, ...ticketActivityRows],
    });

    const entry = buildEntry(member, joinHistory);
    const usernameHistory = buildUsernameHistory(member, viewer, joinHistory, recentTickets);
    const historicalUsernames = Array.from(
      new Set(
        [
          member.username,
          member.display_name,
          member.nickname,
          member.last_seen_username,
          member.last_seen_display_name,
          member.last_seen_nickname,
          viewer.username,
          viewer.global_name,
          ...safeArray(member.previous_usernames),
          ...safeArray(member.previous_display_names),
          ...safeArray(member.previous_nicknames),
          ...usernameHistory.flatMap((row) => [row.username, row.display_name, row.nickname]),
        ]
          .map(normalizeString)
          .filter(Boolean)
      )
    ).slice(0, 30);
    const vouches = buildVouches(member, joinHistory);
    const verification = buildVerification(member, verificationFlags, verificationTokens, vcSessions, openTicket);
    const ticketSummary = buildTicketSummary(recentTickets);
    const relationships = {
      entry_method: entry.entry_method || member.entry_method || null,
      verification_source: entry.verification_source || member.verification_source || entry.join_source || null,
      join_source: entry.join_source || member.join_source || null,
      entry_reason: member.entry_reason || entry.join_note || null,
      approval_reason: member.approval_reason || null,
      invite_code: entry.invite_code || member.invite_code || null,
      inviter_id: entry.inviter_id || member.invited_by || null,
      inviter_name: entry.inviter_name || member.invited_by_name || null,
      vanity_used: Boolean(entry.vanity_used),
      vouched_by: entry.vouched_by || member.vouched_by || null,
      vouched_by_name: entry.vouched_by_name || member.vouched_by_name || null,
      approved_by: entry.approved_by || member.approved_by || null,
      approved_by_name: entry.approved_by_name || member.approved_by_name || null,
      verification_ticket_id: member.verification_ticket_id || null,
      source_ticket_id: entry.source_ticket_id || member.source_ticket_id || recentTickets[0]?.id || null,
      source_confidence: entry.source_confidence || "unknown",
      source_truth_reason: entry.source_truth_reason || null,
      vouch_count: vouches.length,
      latest_vouch_at: vouches.map((item) => item.created_at).sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
    };
    const stats = {
      ticket_count: recentTickets.length,
      activity_count: recentActivity.length,
      verification_flag_count: verificationFlags.length,
      verification_token_count: verificationTokens.length,
      vc_session_count: vcSessions.length,
      last_activity_at: recentActivity.map((item) => item.created_at).sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || null,
    };

    return json({
      ok: true,
      selectedGuildId: guildId,
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load user dashboard.";
    return json({ ok: false, error: message }, 500);
  }
}
