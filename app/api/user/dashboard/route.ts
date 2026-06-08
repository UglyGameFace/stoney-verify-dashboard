import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRecord = Record<string, any>;

function clean(value: unknown): string {
  return String(value || "").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeObject(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function dateMs(value: unknown): number {
  const ms = new Date(String(value || 0)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function selectedGuildId(): string {
  return clean(getSelectedGuildId());
}

function errorCode(payload: AnyRecord, status: number): string {
  const explicit = clean(payload.error_code || payload.code);
  if (explicit) return explicit;
  if (status === 401) return "signed_out";
  if (status === 428) return "selected_server_required";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 400) return "invalid_request";
  return status >= 500 ? "server_error" : "request_failed";
}

function json(payload: AnyRecord, status = 200) {
  const code = status >= 400 ? errorCode(payload, status) : "";
  const body = status >= 400
    ? {
        ...payload,
        ok: payload.ok ?? false,
        error: payload.error || (status === 401 ? "Discord login required." : "Request failed."),
        error_code: code,
        needsServerSelection: payload.needsServerSelection ?? code === "selected_server_required",
        retryable: payload.retryable ?? false,
      }
    : payload;

  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
  });
}

function signedOutResponse() {
  return json({ ok: false, error: "Discord login required.", error_code: "signed_out" }, 401);
}

function viewerFromSession(session: AnyRecord, guildId: string) {
  const user = safeObject(session.user || session.discordUser);
  const discordId = clean(user.discord_id || user.id || session?.discordUser?.id);
  const username = clean(user.username || session?.discordUser?.username) || "Member";
  const globalName = clean(user.global_name || user.name || username) || username;
  const avatarUrl = clean(user.avatar_url || user.avatar || user.image || user.picture || session?.discordUser?.avatar_url || session?.discordUser?.avatar) || null;

  return {
    discord_id: discordId,
    username,
    global_name: globalName,
    avatar_url: avatarUrl,
    isStaff: Boolean(session.isStaff),
    guild_id: guildId || null,
  };
}

async function rows(supabase: any, table: string, build: (query: any) => any): Promise<AnyRecord[]> {
  try {
    const query = supabase.from(table).select("*");
    const { data } = await build(query);
    return safeArray<AnyRecord>(data);
  } catch {
    return [];
  }
}

async function single(supabase: any, table: string, build: (query: any) => any): Promise<AnyRecord | null> {
  try {
    const query = supabase.from(table).select("*");
    const { data } = await build(query);
    return data ? safeObject(data) : null;
  } catch {
    return null;
  }
}

function localPriority(row: AnyRecord): string {
  const explicit = lower(row.priority);
  if (["urgent", "high", "medium", "low"].includes(explicit)) return explicit;
  const status = lower(row.status);
  const category = lower(row.category || row.matched_category_slug || row.matched_intake_type);
  if (status === "open" && (category.includes("appeal") || category.includes("verification"))) return "high";
  if (status === "open" || status === "claimed") return "medium";
  return "low";
}

function sortRecentTickets(tickets: AnyRecord[]) {
  return [...tickets].sort((a, b) => dateMs(b.updated_at || b.created_at) - dateMs(a.updated_at || a.created_at));
}

function memberRow(row: AnyRecord | null, viewer: AnyRecord) {
  const member = safeObject(row);
  return {
    ...member,
    guild_id: clean(member.guild_id) || viewer.guild_id || null,
    user_id: clean(member.user_id) || viewer.discord_id || null,
    username: clean(member.username) || viewer.username || "Member",
    display_name: clean(member.display_name || member.nickname) || viewer.global_name || viewer.username || "Member",
    nickname: clean(member.nickname) || null,
    avatar_url: clean(member.avatar_url) || viewer.avatar_url || null,
    joined_at: clean(member.joined_at) || null,
    role_names: safeArray<string>(member.role_names),
    role_ids: safeArray<string>(member.role_ids),
    roles: safeArray(member.roles),
    has_unverified: Boolean(member.has_unverified),
    has_verified_role: Boolean(member.has_verified_role),
    has_staff_role: Boolean(member.has_staff_role),
    has_secondary_verified_role: Boolean(member.has_secondary_verified_role),
    has_cosmetic_only: Boolean(member.has_cosmetic_only),
    role_state: clean(member.role_state) || "unknown",
    role_state_reason: clean(member.role_state_reason) || "",
    top_role: clean(member.top_role || member.highest_role_name) || safeArray<string>(member.role_names)[0] || null,
    in_guild: member.in_guild !== false,
    invite_code: clean(member.invite_code) || null,
    invited_by: clean(member.invited_by) || null,
    invited_by_name: clean(member.invited_by_name) || null,
    vouched_by: clean(member.vouched_by) || null,
    vouched_by_name: clean(member.vouched_by_name) || null,
    approved_by: clean(member.approved_by) || null,
    approved_by_name: clean(member.approved_by_name) || null,
    entry_method: clean(member.entry_method) || null,
    verification_source: clean(member.verification_source) || null,
    join_source: clean(member.join_source || member.entry_source) || null,
    vanity_used: Boolean(member.vanity_used),
    entry_reason: clean(member.entry_reason) || null,
    approval_reason: clean(member.approval_reason) || null,
    verification_ticket_id: clean(member.verification_ticket_id) || null,
    source_ticket_id: clean(member.source_ticket_id) || null,
  };
}

function categoryRow(row: AnyRecord) {
  return {
    id: clean(row.id) || null,
    name: clean(row.name) || "Support",
    slug: clean(row.slug) || "support",
    color: clean(row.color) || "#45d483",
    description: clean(row.description),
    intake_type: clean(row.intake_type) || "general",
    button_label: clean(row.button_label) || `Open ${clean(row.name) || "Support"} Ticket`,
    is_default: Boolean(row.is_default),
    sort_order: row.sort_order ?? null,
    staff_role_ids: safeArray<string>(row.staff_role_ids),
    staff_role_names: safeArray<string>(row.staff_role_names),
    match_keywords: safeArray<string>(row.match_keywords),
  };
}

function ticketRow(row: AnyRecord) {
  return {
    id: clean(row.id) || null,
    title: clean(row.title || row.channel_name) || "Ticket",
    category: clean(row.category) || null,
    matched_category_name: clean(row.matched_category_name) || null,
    matched_category_slug: clean(row.matched_category_slug) || null,
    matched_intake_type: clean(row.matched_intake_type) || null,
    matched_category_reason: clean(row.matched_category_reason) || null,
    matched_category_score: Number(row.matched_category_score || 0),
    status: clean(row.status) || "open",
    priority: localPriority(row),
    claimed_by: clean(row.claimed_by) || null,
    claimed_by_name: clean(row.claimed_by_name) || null,
    assigned_to: clean(row.assigned_to) || null,
    assigned_to_name: clean(row.assigned_to_name) || null,
    closed_by: clean(row.closed_by) || null,
    closed_by_name: clean(row.closed_by_name) || null,
    closed_reason: clean(row.closed_reason) || null,
    created_at: clean(row.created_at) || null,
    updated_at: clean(row.updated_at) || null,
    closed_at: clean(row.closed_at) || null,
    deleted_at: clean(row.deleted_at) || null,
    reopened_at: clean(row.reopened_at) || null,
    sla_deadline: clean(row.sla_deadline) || null,
    channel_id: clean(row.channel_id || row.discord_thread_id) || null,
    channel_name: clean(row.channel_name) || null,
    transcript_url: clean(row.transcript_url) || null,
    source: clean(row.source) || null,
    initial_message: clean(row.initial_message),
    is_ghost: Boolean(row.is_ghost),
    ticket_number: Number.isFinite(Number(row.ticket_number)) ? Number(row.ticket_number) : null,
    username: clean(row.username) || null,
  };
}

function flagRow(row: AnyRecord) {
  return {
    id: clean(row.id) || null,
    created_at: clean(row.created_at) || null,
    score: Number(row.score || 0),
    flagged: Boolean(row.flagged),
    reasons: safeArray<string>(row.reasons),
    note: clean(row.note),
    raw: row,
  };
}

function joinRow(row: AnyRecord) {
  return {
    id: clean(row.id) || null,
    joined_at: clean(row.joined_at) || null,
    join_source: clean(row.join_source) || null,
    entry_method: clean(row.entry_method) || null,
    verification_source: clean(row.verification_source) || null,
    invite_code: clean(row.invite_code) || null,
    inviter_id: clean(row.invited_by || row.inviter_id) || null,
    inviter_name: clean(row.invited_by_name || row.inviter_name) || null,
    vouched_by: clean(row.vouched_by) || null,
    vouched_by_name: clean(row.vouched_by_name) || null,
    approved_by: clean(row.approved_by) || null,
    approved_by_name: clean(row.approved_by_name) || null,
    source_ticket_id: clean(row.source_ticket_id) || null,
    join_note: clean(row.join_note) || null,
    vanity_used: Boolean(row.vanity_used),
    username: clean(row.username) || null,
    display_name: clean(row.display_name) || null,
    raw: row,
  };
}

function memberEventRow(row: AnyRecord) {
  return {
    id: clean(row.id) || null,
    created_at: clean(row.created_at) || null,
    event_type: clean(row.event_type) || "member_event",
    title: clean(row.title) || "Member Event",
    reason: clean(row.reason),
    actor_id: clean(row.actor_id) || null,
    actor_name: clean(row.actor_name) || "System",
    metadata: safeObject(row.metadata),
    raw: row,
  };
}

function activityRow(row: AnyRecord) {
  return {
    id: clean(row.id) || null,
    title: clean(row.title) || "Activity",
    description: clean(row.description),
    reason: clean(row.reason),
    event_type: clean(row.event_type) || "activity",
    created_at: clean(row.created_at) || null,
    updated_at: clean(row.updated_at || row.created_at) || null,
    actor_id: clean(row.actor_user_id) || null,
    actor_name: clean(row.actor_name) || "System",
    ticket_id: clean(row.ticket_id) || null,
    metadata: safeObject(row.metadata),
    _source: clean(row.source) || "activity_feed_events",
  };
}

function ticketSummary(tickets: AnyRecord[]) {
  const status_counts: Record<string, number> = {};
  const priority_counts: Record<string, number> = {};
  const category_counts: Record<string, number> = {};

  for (const ticket of tickets) {
    const status = lower(ticket.status || "unknown") || "unknown";
    const priority = lower(ticket.priority || "medium") || "medium";
    const category = lower(ticket.matched_category_slug || ticket.category || "support") || "support";
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
    latest_ticket_at: tickets.map((ticket) => ticket.updated_at || ticket.created_at).sort((a, b) => dateMs(b) - dateMs(a))[0] || null,
  };
}

function entryInfo(member: AnyRecord, joins: AnyRecord[]) {
  const latestJoin = [...joins].sort((a, b) => dateMs(b.joined_at) - dateMs(a.joined_at))[0] || null;
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
  const hasSource = Boolean(vouchedBy || vouchedByName || vanityUsed || inviteCode || inviterId || inviterName);
  const hasPartial = Boolean(approvedBy || approvedByName || joinSource || entryMethod);

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
    source_confidence: hasSource ? "confirmed" : hasPartial ? "partial" : "unknown",
    source_truth_reason: hasSource ? "A tracked join, invite, vanity, or vouch trail exists for this member." : hasPartial ? "A partial entry path exists, but the detailed source trail is incomplete." : "The dashboard does not have enough join-source detail yet.",
    raw: latestJoin?.raw || latestJoin || null,
  };
}

function verificationInfo(member: AnyRecord, flags: AnyRecord[], openTicket: AnyRecord | null) {
  let status = "unknown";
  if (member.has_staff_role) status = "staff";
  else if (member.has_verified_role || member.has_secondary_verified_role) status = "verified";
  else if (flags.some((item) => item.flagged)) status = "needs_review";
  else if (member.has_unverified || openTicket) status = "pending";

  return {
    status,
    has_unverified: Boolean(member.has_unverified),
    has_verified_role: Boolean(member.has_verified_role),
    has_secondary_verified_role: Boolean(member.has_secondary_verified_role),
    has_staff_role: Boolean(member.has_staff_role),
    flag_count: flags.length,
    flagged_count: flags.filter((item) => item.flagged).length,
    latest_flag_at: flags.map((item) => item.created_at).sort((a, b) => dateMs(b) - dateMs(a))[0] || null,
    vc_request_count: 0,
    vc_completed_count: 0,
    vc_latest_status: null,
    token_count: 0,
    token_latest_status: null,
    token_latest_decision: null,
    token_submitted_count: 0,
    token_pending_count: 0,
    token_approved_count: 0,
    token_denied_count: 0,
    open_ticket_id: openTicket?.id || null,
  };
}

function recentActivity(events: AnyRecord[], tickets: AnyRecord[], flags: AnyRecord[], joins: AnyRecord[], memberEvents: AnyRecord[]) {
  const rowsOut: AnyRecord[] = [
    ...events.map(activityRow),
    ...tickets.map((ticket) => ({ id: `ticket-${ticket.id || ticket.created_at}`, title: ticket.status === "closed" ? "Ticket Closed" : "Ticket Opened", description: ticket.title || "Ticket activity", reason: ticket.initial_message || ticket.closed_reason || "", event_type: ticket.status === "closed" ? "ticket_closed" : "ticket_created", created_at: ticket.closed_at || ticket.created_at || ticket.updated_at || null, updated_at: ticket.updated_at || ticket.created_at || null, actor_id: ticket.closed_by || null, actor_name: ticket.closed_by_name || "System", ticket_id: ticket.id || null, metadata: { status: ticket.status, category: ticket.category || ticket.matched_category_slug || null }, _source: "tickets" })),
    ...flags.map((flag) => ({ id: `flag-${flag.id || flag.created_at}`, title: flag.flagged ? "Verification Flag Raised" : "Verification Reviewed", description: flag.flagged ? "Your verification was flagged for manual review." : "Verification review activity detected.", reason: safeArray(flag.reasons).join(" • "), event_type: "verification_flag", created_at: flag.created_at || null, updated_at: flag.created_at || null, actor_id: null, actor_name: "System", ticket_id: null, metadata: { score: flag.score, reasons: safeArray(flag.reasons) }, _source: "verification_flags" })),
    ...joins.map((join) => ({ id: `join-${join.id || join.joined_at}`, title: "Joined Server", description: "Your member profile was recorded in the server.", reason: join.join_note || join.join_source || join.entry_method || join.verification_source || "", event_type: "member_join", created_at: join.joined_at || null, updated_at: join.joined_at || null, actor_id: null, actor_name: "System", ticket_id: null, metadata: { invite_code: join.invite_code || null, inviter_id: join.inviter_id || null, inviter_name: join.inviter_name || null }, _source: "member_joins" })),
    ...memberEvents.map((event) => ({ id: `member-event-${event.id || event.created_at}`, title: event.title || "Member Event", description: event.reason || "", reason: event.reason || "", event_type: event.event_type || "member_event", created_at: event.created_at || null, updated_at: event.created_at || null, actor_id: event.actor_id || null, actor_name: event.actor_name || "System", ticket_id: null, metadata: event.metadata || {}, _source: "member_events" })),
  ];
  return rowsOut.filter((item) => item.created_at).sort((a, b) => dateMs(b.created_at) - dateMs(a.created_at)).slice(0, 25);
}

function usernameHistory(member: AnyRecord, viewer: AnyRecord, joins: AnyRecord[], tickets: AnyRecord[]) {
  const rowsOut: AnyRecord[] = [];
  const push = (source: string, created_at: string | null, username: unknown, display_name: unknown, nickname: unknown) => {
    const cleanUser = clean(username);
    const cleanDisplay = clean(display_name);
    const cleanNick = clean(nickname);
    if (!cleanUser && !cleanDisplay && !cleanNick) return;
    rowsOut.push({ id: `${source}:${created_at || cleanUser || cleanDisplay || cleanNick}`, created_at, username: cleanUser || null, display_name: cleanDisplay || null, nickname: cleanNick || null, source });
  };
  push("current_member", member.joined_at || null, member.username, member.display_name, member.nickname);
  push("viewer_session", null, viewer.username, viewer.global_name, null);
  for (const value of safeArray(member.previous_usernames)) push("guild_members_previous_username", null, value, null, null);
  for (const value of safeArray(member.previous_display_names)) push("guild_members_previous_display_name", null, null, value, null);
  for (const value of safeArray(member.previous_nicknames)) push("guild_members_previous_nickname", null, null, null, value);
  for (const row of joins) push("member_joins", row.joined_at, row.username, row.display_name, null);
  for (const ticket of tickets) push("tickets", ticket.created_at, ticket.username, null, null);
  const seen = new Set<string>();
  return rowsOut.sort((a, b) => dateMs(b.created_at) - dateMs(a.created_at)).filter((row) => { const key = `${lower(row.username)}|${lower(row.display_name)}|${lower(row.nickname)}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 30);
}

function vouchRows(member: AnyRecord, joins: AnyRecord[]) {
  const out: AnyRecord[] = [];
  if (member.vouched_by || member.vouched_by_name) out.push({ id: `member-vouch-${member.vouched_by || member.vouched_by_name}`, created_at: member.joined_at || null, actor_id: member.vouched_by || null, actor_name: member.vouched_by_name || member.vouched_by || null, target_user_id: member.user_id || null, reason: member.entry_reason || "Member was vouched into the server.", raw: null });
  for (const row of joins) if (row.vouched_by || row.vouched_by_name) out.push({ id: `join-vouch-${row.id || row.joined_at || row.vouched_by || row.vouched_by_name}`, created_at: row.joined_at || null, actor_id: row.vouched_by || null, actor_name: row.vouched_by_name || row.vouched_by || null, target_user_id: member.user_id || null, reason: row.join_note || "Member was vouched into the server.", raw: row.raw || row });
  return out.sort((a, b) => dateMs(b.created_at) - dateMs(a.created_at)).slice(0, 15);
}

export async function GET(): Promise<NextResponse> {
  try {
    const rawSession = (await getSession()) as AnyRecord | null;
    const session = safeObject(rawSession);
    if (!Object.keys(session).length) return signedOutResponse();

    const guildId = selectedGuildId();
    if (!guildId) return json({ ok: false, error: "Select a server before opening the user dashboard.", error_code: "selected_server_required", needsServerSelection: true }, 428);

    const viewer = viewerFromSession(session, guildId);
    if (!viewer.discord_id) return signedOutResponse();

    const supabase = createServerSupabase();
    const [memberRaw, categoriesRaw, flagsRaw, joinsRaw, memberEventsRaw, ticketsRaw] = await Promise.all([
      single(supabase, "guild_members", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).maybeSingle()),
      rows(supabase, "ticket_categories", (q) => q.eq("guild_id", guildId).order("sort_order", { ascending: true }).order("name", { ascending: true })),
      rows(supabase, "verification_flags", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("created_at", { ascending: false }).limit(20)),
      rows(supabase, "member_joins", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("joined_at", { ascending: false }).limit(10)),
      rows(supabase, "member_events", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("created_at", { ascending: false }).limit(20)),
      rows(supabase, "tickets", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("updated_at", { ascending: false }).limit(50)),
    ]);

    const member = memberRow(memberRaw, viewer);
    const categories = categoriesRaw.map(categoryRow);
    const verificationFlags = flagsRaw.map(flagRow);
    const joinHistory = joinsRaw.map(joinRow);
    const memberEvents = memberEventsRaw.map(memberEventRow);
    const visibleTickets = ticketsRaw.map(ticketRow);
    const recentTickets = sortRecentTickets(visibleTickets);
    const openTicket = recentTickets.find((ticket) => ["open", "claimed"].includes(lower(ticket.status))) || null;
    const ticketIds = recentTickets.map((ticket) => ticket.id).filter(Boolean);
    const feedRows = await rows(supabase, "activity_feed_events", (q) => q.eq("guild_id", guildId).or(`target_user_id.eq.${viewer.discord_id},actor_user_id.eq.${viewer.discord_id}`).order("created_at", { ascending: false }).limit(40));
    const ticketFeedRows = ticketIds.length ? await rows(supabase, "activity_feed_events", (q) => q.eq("guild_id", guildId).in("ticket_id", ticketIds).order("created_at", { ascending: false }).limit(40)) : [];

    const entry = entryInfo(member, joinHistory);
    const history = usernameHistory(member, viewer, joinHistory, recentTickets);
    const historicalUsernames = Array.from(new Set([member.username, member.display_name, member.nickname, viewer.username, viewer.global_name, ...safeArray(member.previous_usernames), ...safeArray(member.previous_display_names), ...safeArray(member.previous_nicknames), ...history.flatMap((row) => [row.username, row.display_name, row.nickname])].map(clean).filter(Boolean))).slice(0, 30);
    const vouches = vouchRows(member, joinHistory);
    const verification = verificationInfo(member, verificationFlags, openTicket);
    const recent = recentActivity([...feedRows, ...ticketFeedRows], recentTickets, verificationFlags, joinHistory, memberEvents);
    const relationships = { entry_method: entry.entry_method || member.entry_method || null, verification_source: entry.verification_source || member.verification_source || entry.join_source || null, join_source: entry.join_source || member.join_source || null, entry_reason: member.entry_reason || entry.join_note || null, approval_reason: member.approval_reason || null, invite_code: entry.invite_code || member.invite_code || null, inviter_id: entry.inviter_id || member.invited_by || null, inviter_name: entry.inviter_name || member.invited_by_name || null, vanity_used: Boolean(entry.vanity_used), vouched_by: entry.vouched_by || member.vouched_by || null, vouched_by_name: entry.vouched_by_name || member.vouched_by_name || null, approved_by: entry.approved_by || member.approved_by || null, approved_by_name: entry.approved_by_name || member.approved_by_name || null, verification_ticket_id: member.verification_ticket_id || null, source_ticket_id: entry.source_ticket_id || member.source_ticket_id || recentTickets[0]?.id || null, source_confidence: entry.source_confidence || "unknown", source_truth_reason: entry.source_truth_reason || null, vouch_count: vouches.length, latest_vouch_at: vouches.map((item) => item.created_at).sort((a, b) => dateMs(b) - dateMs(a))[0] || null };
    const stats = { ticket_count: recentTickets.length, activity_count: recent.length, verification_flag_count: verificationFlags.length, verification_token_count: 0, vc_session_count: 0, last_activity_at: recent.map((item) => item.created_at).sort((a, b) => dateMs(b) - dateMs(a))[0] || null };

    return json({ ok: true, selectedGuildId: guildId, viewer, member, profile: member, entry, categories, verificationFlags, verificationTokens: [], verification, vcSessions: [], joinHistory, memberEvents, usernameHistory: history, historicalUsernames, vouches, relationships, openTicket, recentTickets, ticketSummary: ticketSummary(recentTickets), recentActivity: recent, stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load user dashboard.";
    return json({ ok: false, error: message, error_code: "server_error" }, 500);
  }
}
