import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth-server";
import { getSelectedGuildId } from "@/lib/guild-selection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value) {
  return String(value || "").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function stamp(value) {
  const time = new Date(String(value || 0)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function json(payload, status = 200) {
  const code = clean(payload.error_code) || (status === 401 ? "signed_out" : status === 428 ? "selected_server_required" : status >= 500 ? "server_error" : "invalid_request");
  const body = status >= 400
    ? { ...payload, ok: false, error: payload.error || "Request failed.", error_code: code, needsServerSelection: payload.needsServerSelection ?? code === "selected_server_required", retryable: payload.retryable ?? false }
    : payload;
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
}

function signedOut() {
  return json({ error: "Discord login required.", error_code: "signed_out" }, 401);
}

async function fetchRows(supabase, table, build) {
  try {
    const { data } = await build(supabase.from(table).select("*"));
    return list(data).map(obj);
  } catch {
    return [];
  }
}

async function fetchOne(supabase, table, build) {
  try {
    const { data } = await build(supabase.from(table).select("*"));
    return data ? obj(data) : null;
  } catch {
    return null;
  }
}

function viewerFromSession(session, guildId) {
  const user = obj(session.user || session.discordUser);
  return {
    discord_id: clean(user.discord_id || user.id || session?.discordUser?.id),
    username: clean(user.username || session?.discordUser?.username) || "Member",
    global_name: clean(user.global_name || user.name || user.username) || "Member",
    avatar_url: clean(user.avatar_url || user.avatar || user.image || user.picture || session?.discordUser?.avatar_url || session?.discordUser?.avatar) || null,
    isStaff: Boolean(session.isStaff),
    guild_id: guildId,
  };
}

function memberOut(row, viewer) {
  const member = obj(row);
  return {
    ...member,
    guild_id: clean(member.guild_id) || viewer.guild_id || null,
    user_id: clean(member.user_id) || viewer.discord_id || null,
    username: clean(member.username) || viewer.username || "Member",
    display_name: clean(member.display_name || member.nickname) || viewer.global_name || viewer.username || "Member",
    nickname: clean(member.nickname) || null,
    avatar_url: clean(member.avatar_url) || viewer.avatar_url || null,
    joined_at: clean(member.joined_at) || null,
    role_names: list(member.role_names),
    role_ids: list(member.role_ids),
    roles: list(member.roles),
    has_unverified: Boolean(member.has_unverified),
    has_verified_role: Boolean(member.has_verified_role),
    has_staff_role: Boolean(member.has_staff_role),
    has_secondary_verified_role: Boolean(member.has_secondary_verified_role),
    role_state: clean(member.role_state) || "unknown",
    role_state_reason: clean(member.role_state_reason) || "",
    top_role: clean(member.top_role || member.highest_role_name) || list(member.role_names)[0] || null,
    in_guild: member.in_guild !== false,
    join_source: clean(member.join_source || member.entry_source) || null,
    entry_method: clean(member.entry_method) || null,
    verification_source: clean(member.verification_source) || null,
    invite_code: clean(member.invite_code) || null,
    invited_by: clean(member.invited_by) || null,
    invited_by_name: clean(member.invited_by_name) || null,
    vouched_by: clean(member.vouched_by) || null,
    vouched_by_name: clean(member.vouched_by_name) || null,
    approved_by: clean(member.approved_by) || null,
    approved_by_name: clean(member.approved_by_name) || null,
    verification_ticket_id: clean(member.verification_ticket_id) || null,
    source_ticket_id: clean(member.source_ticket_id) || null,
    vanity_used: Boolean(member.vanity_used),
  };
}

function categoryOut(row) {
  return { id: clean(row.id) || null, name: clean(row.name) || "Support", slug: clean(row.slug) || "support", color: clean(row.color) || "#45d483", description: clean(row.description), intake_type: clean(row.intake_type) || "general", button_label: clean(row.button_label) || `Open ${clean(row.name) || "Support"} Ticket`, is_default: Boolean(row.is_default), sort_order: row.sort_order ?? null, match_keywords: list(row.match_keywords) };
}

function ticketOut(row) {
  return { id: clean(row.id) || null, title: clean(row.title || row.channel_name) || "Ticket", category: clean(row.category) || null, matched_category_name: clean(row.matched_category_name) || null, matched_category_slug: clean(row.matched_category_slug) || null, matched_intake_type: clean(row.matched_intake_type) || null, status: clean(row.status) || "open", priority: clean(row.priority) || "medium", claimed_by: clean(row.claimed_by) || null, claimed_by_name: clean(row.claimed_by_name) || null, assigned_to: clean(row.assigned_to) || null, assigned_to_name: clean(row.assigned_to_name) || null, closed_reason: clean(row.closed_reason) || null, created_at: clean(row.created_at) || null, updated_at: clean(row.updated_at) || null, closed_at: clean(row.closed_at) || null, channel_id: clean(row.channel_id || row.discord_thread_id) || null, channel_name: clean(row.channel_name) || null, transcript_url: clean(row.transcript_url) || null, initial_message: clean(row.initial_message), ticket_number: Number.isFinite(Number(row.ticket_number)) ? Number(row.ticket_number) : null, username: clean(row.username) || null };
}

function flagOut(row) {
  return { id: clean(row.id) || null, created_at: clean(row.created_at) || null, score: Number(row.score || 0), flagged: Boolean(row.flagged), reasons: list(row.reasons), note: clean(row.note), raw: row };
}

function eventOut(row) {
  return { id: clean(row.id) || null, created_at: clean(row.created_at || row.joined_at) || null, title: clean(row.title || row.event_type) || "Activity", description: clean(row.description || row.reason), reason: clean(row.reason || row.join_source || row.entry_method), event_type: clean(row.event_type) || "activity", actor_id: clean(row.actor_user_id || row.actor_id) || null, actor_name: clean(row.actor_name) || "System", ticket_id: clean(row.ticket_id) || null, metadata: obj(row.metadata), raw: row };
}

function sortNewest(items) {
  return [...items].sort((a, b) => stamp(b.updated_at || b.created_at || b.joined_at) - stamp(a.updated_at || a.created_at || a.joined_at));
}

function ticketSummary(tickets) {
  const status_counts = {};
  for (const ticket of tickets) {
    const status = lower(ticket.status || "unknown") || "unknown";
    status_counts[status] = (status_counts[status] || 0) + 1;
  }
  return { total: tickets.length, open: (status_counts.open || 0) + (status_counts.claimed || 0), closed: status_counts.closed || 0, deleted: status_counts.deleted || 0, claimed: status_counts.claimed || 0, status_counts, priority_counts: {}, category_counts: {}, latest_ticket_at: tickets.map((ticket) => ticket.updated_at || ticket.created_at).sort((a, b) => stamp(b) - stamp(a))[0] || null };
}

export async function GET() {
  try {
    const session = obj(await getSession());
    if (!Object.keys(session).length) return signedOut();

    const guildId = clean(getSelectedGuildId());
    if (!guildId) return json({ error: "Select a server before opening the user dashboard.", error_code: "selected_server_required", needsServerSelection: true }, 428);

    const viewer = viewerFromSession(session, guildId);
    if (!viewer.discord_id) return signedOut();

    const supabase = createServerSupabase();
    const [memberRow, categoryRows, flagRows, joinRows, memberEventRows, ticketRows] = await Promise.all([
      fetchOne(supabase, "guild_members", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).maybeSingle()),
      fetchRows(supabase, "ticket_categories", (q) => q.eq("guild_id", guildId).order("sort_order", { ascending: true }).order("name", { ascending: true })),
      fetchRows(supabase, "verification_flags", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("created_at", { ascending: false }).limit(20)),
      fetchRows(supabase, "member_joins", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("joined_at", { ascending: false }).limit(10)),
      fetchRows(supabase, "member_events", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("created_at", { ascending: false }).limit(20)),
      fetchRows(supabase, "tickets", (q) => q.eq("guild_id", guildId).eq("user_id", viewer.discord_id).order("updated_at", { ascending: false }).limit(50)),
    ]);

    const member = memberOut(memberRow, viewer);
    const categories = categoryRows.map(categoryOut);
    const verificationFlags = flagRows.map(flagOut);
    const joinHistory = joinRows.map(eventOut);
    const memberEvents = memberEventRows.map(eventOut);
    const recentTickets = sortNewest(ticketRows.map(ticketOut));
    const openTicket = recentTickets.find((ticket) => ["open", "claimed"].includes(lower(ticket.status))) || null;
    const ticketIds = recentTickets.map((ticket) => ticket.id).filter(Boolean);
    const feedRows = await fetchRows(supabase, "activity_feed_events", (q) => q.eq("guild_id", guildId).or(`target_user_id.eq.${viewer.discord_id},actor_user_id.eq.${viewer.discord_id}`).order("created_at", { ascending: false }).limit(40));
    const ticketFeedRows = ticketIds.length ? await fetchRows(supabase, "activity_feed_events", (q) => q.eq("guild_id", guildId).in("ticket_id", ticketIds).order("created_at", { ascending: false }).limit(40)) : [];
    const recentActivity = sortNewest([...feedRows, ...ticketFeedRows].map(eventOut)).slice(0, 25);
    const entry = { joined_at: member.joined_at, join_source: member.join_source, entry_method: member.entry_method, verification_source: member.verification_source, invite_code: member.invite_code, inviter_id: member.invited_by, inviter_name: member.invited_by_name, vouched_by: member.vouched_by, vouched_by_name: member.vouched_by_name, approved_by: member.approved_by, approved_by_name: member.approved_by_name, source_ticket_id: member.source_ticket_id, vanity_used: member.vanity_used, source_confidence: member.join_source || member.invite_code ? "partial" : "unknown", source_truth_reason: member.join_source || member.invite_code ? "A partial entry path exists." : "The dashboard does not have enough join-source detail yet." };
    const verification = { status: member.has_staff_role ? "staff" : member.has_verified_role ? "verified" : verificationFlags.some((flag) => flag.flagged) ? "needs_review" : member.has_unverified || openTicket ? "pending" : "unknown", has_unverified: member.has_unverified, has_verified_role: member.has_verified_role, has_secondary_verified_role: member.has_secondary_verified_role, has_staff_role: member.has_staff_role, flag_count: verificationFlags.length, flagged_count: verificationFlags.filter((flag) => flag.flagged).length, open_ticket_id: openTicket?.id || null };
    const usernameHistory = [{ id: "viewer", created_at: null, username: viewer.username, display_name: viewer.global_name, nickname: null, source: "viewer_session" }];
    const relationships = { ...entry, entry_reason: member.entry_reason || null, approval_reason: member.approval_reason || null, verification_ticket_id: member.verification_ticket_id || null, vouch_count: 0, latest_vouch_at: null };
    const stats = { ticket_count: recentTickets.length, activity_count: recentActivity.length, verification_flag_count: verificationFlags.length, verification_token_count: 0, vc_session_count: 0, last_activity_at: recentActivity.map((item) => item.created_at).sort((a, b) => stamp(b) - stamp(a))[0] || null };

    return json({ ok: true, selectedGuildId: guildId, viewer, member, profile: member, entry, categories, verificationFlags, verificationTokens: [], verification, vcSessions: [], joinHistory, memberEvents, usernameHistory, historicalUsernames: [viewer.username, viewer.global_name].filter(Boolean), vouches: [], relationships, openTicket, recentTickets, ticketSummary: ticketSummary(recentTickets), recentActivity, stats });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to load user dashboard.", error_code: "server_error" }, 500);
  }
}
