import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireDashboardStaffSession, dashboardAuthJson, dashboardAuthErrorJson, applyDashboardAuthCookies, type DashboardAuthSession } from "@/lib/dashboard-auth";
import { enrichTicketWithMatchedCategory } from "@/lib/ticketCategoryMatching";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: { id?: string } };
type Row = Record<string, any>;

type SessionLike = {
  user?: {
    discord_id?: string | null;
    id?: string | null;
    username?: string | null;
    name?: string | null;
  } | null;
  discordUser?: {
    id?: string | null;
    username?: string | null;
  } | null;
};

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseDateMs(value: unknown): number {
  const ms = new Date((value as string | number | Date) || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    return new Date(String(value)).toLocaleString();
  } catch {
    return "—";
  }
}

function escapeHtml(value: unknown): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFileBase(value: string): string {
  return normalizeString(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  session: DashboardAuthSession | null = null
) {
  return dashboardAuthJson(payload, status, session);
}

function buildAttachmentResponse(
  content: string,
  contentType: string,
  filename: string,
  session: DashboardAuthSession | null = null
) {
  const response = new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
  applyDashboardAuthCookies(response, session);
  return response;
}

function mapTicket(row: Row): Row {
  return {
    ...row,
    priority: row?.priority || "medium",
    channel_id: row?.channel_id || row?.discord_thread_id || null,
    channel_name: row?.channel_name || null,
    source: row?.source || "discord",
    is_ghost: Boolean(row?.is_ghost),
  };
}

function mapMessage(row: Row): Row {
  return {
    id: row?.id || null,
    ticket_id: row?.ticket_id || null,
    author_id: normalizeString(row?.author_id),
    author_name: row?.author_name || "",
    content: row?.content || "",
    message_type: normalizeLower(row?.message_type || "staff") || "staff",
    attachments: safeArray<Row>(row?.attachments),
    source: row?.source || null,
    created_at: row?.created_at || null,
  };
}

function mapNote(row: Row): Row {
  return {
    id: row?.id || null,
    ticket_id: normalizeString(row?.ticket_id),
    staff_id: normalizeString(row?.staff_id),
    staff_name: row?.staff_name || "",
    content: row?.content || "",
    created_at: row?.created_at || null,
  };
}

function mapMember(row: Row | null): Row | null {
  if (!row) return null;
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    username: row?.username || "",
    display_name: row?.display_name || "",
    nickname: row?.nickname || "",
    avatar_url: row?.avatar_url || null,
    role_ids: safeArray(row?.role_ids),
    role_names: safeArray(row?.role_names),
    roles: safeArray(row?.roles),
    in_guild: row?.in_guild !== false,
    has_unverified: Boolean(row?.has_unverified),
    has_verified_role: Boolean(row?.has_verified_role),
    has_staff_role: Boolean(row?.has_staff_role),
    has_secondary_verified_role: Boolean(row?.has_secondary_verified_role),
    role_state: row?.role_state || "unknown",
    role_state_reason: row?.role_state_reason || "",
  };
}

function latestBy(rows: Row[], ...fields: string[]): Row | null {
  return [...safeArray<Row>(rows)].sort((a, b) => {
    const aTs = Math.max(...fields.map((field) => parseDateMs(a?.[field])));
    const bTs = Math.max(...fields.map((field) => parseDateMs(b?.[field])));
    return bTs - aTs;
  })[0] || null;
}

function deriveVerificationLabel(args: {
  member: Row | null;
  latestToken: Row | null;
  latestVc: Row | null;
  flaggedCount: number;
  ticket: Row;
}): string {
  const { member, latestToken, latestVc, flaggedCount, ticket } = args;
  const tokenStatus = normalizeLower(latestToken?.status);
  const tokenDecision = normalizeString(latestToken?.decision).toUpperCase();
  const vcStatus = normalizeString(latestVc?.status).toUpperCase();
  if (member?.has_staff_role) return "Staff";
  if (member?.has_verified_role || member?.has_secondary_verified_role || tokenStatus === "approved" || tokenDecision === "APPROVED") return "Verified";
  if (tokenStatus === "denied" || tokenDecision === "DENIED") return "Denied";
  if (flaggedCount > 0) return "Needs Review";
  if (["PENDING", "ACCEPTED", "STAFF_ACCEPTED", "READY", "IN_VC", "STARTED"].includes(vcStatus)) return "VC In Progress";
  if (tokenStatus === "pending" || tokenStatus === "submitted" || tokenStatus === "resubmit" || member?.has_unverified || normalizeLower(ticket?.matched_intake_type) === "verification") return "Pending";
  return "Unknown";
}

function deriveRiskLevel(args: {
  ticket: Row;
  member: Row | null;
  flaggedCount: number;
  warnCount: number;
  maxFlagScore: number;
  noteCount: number;
}): string {
  const { ticket, member, flaggedCount, warnCount, maxFlagScore, noteCount } = args;
  const priority = normalizeLower(ticket?.priority);
  if (flaggedCount > 0 || maxFlagScore >= 5 || warnCount >= 3 || priority === "urgent") return "high";
  if (priority === "high" || warnCount >= 1 || maxFlagScore >= 2 || (member?.has_unverified && normalizeLower(ticket?.matched_intake_type) === "verification") || noteCount === 0) return "medium";
  return "low";
}

function transcriptFileName(ticket: Row): string {
  const base = normalizeString(ticket?.ticket_number)
    ? `ticket-${ticket.ticket_number}`
    : normalizeString(ticket?.id)
      ? `ticket-${ticket.id}`
      : "ticket-transcript";
  return safeFileBase(base) || "ticket-transcript";
}

function renderRowsText(title: string, rows: Row[], line: (row: Row, index: number) => string[]): string[] {
  const out = [title, "-".repeat(44)];
  if (!rows.length) {
    out.push(`No ${title.toLowerCase()} recorded.`);
    out.push("");
    return out;
  }
  rows.forEach((row, index) => {
    out.push(...line(row, index));
    out.push("");
  });
  return out;
}

function buildTextTranscript(payload: Row): string {
  const ticket = payload.ticket || {};
  const member = payload.member || null;
  const category = payload.category || null;
  const workspace = payload.workspace || {};
  const viewer = payload.viewer || {};
  const lines: string[] = [];

  lines.push("DANK SHIELD TICKET TRANSCRIPT");
  lines.push("=".repeat(44));
  lines.push("");
  lines.push(`Server ID: ${normalizeString(payload.selectedGuildId) || "—"}`);
  lines.push(`Ticket ID: ${normalizeString(ticket?.id) || "—"}`);
  lines.push(`Ticket Number: ${normalizeString(ticket?.ticket_number) || "—"}`);
  lines.push(`Title: ${normalizeString(ticket?.title) || "—"}`);
  lines.push(`Status: ${normalizeString(ticket?.status) || "—"}`);
  lines.push(`Priority: ${normalizeString(ticket?.priority) || "—"}`);
  lines.push(`Category: ${normalizeString(category?.name || ticket?.matched_category_name || ticket?.category) || "—"}`);
  lines.push(`Channel: ${normalizeString(ticket?.channel_name) || "—"}`);
  lines.push(`Channel ID: ${normalizeString(ticket?.channel_id || ticket?.discord_thread_id) || "—"}`);
  lines.push(`Created: ${formatDateTime(ticket?.created_at)}`);
  lines.push(`Updated: ${formatDateTime(ticket?.updated_at)}`);
  lines.push(`Closed: ${formatDateTime(ticket?.closed_at)}`);
  lines.push(`Exported By: ${normalizeString(viewer?.username) || "Staff"}`);
  lines.push(`Exported At: ${formatDateTime(payload.exportedAt)}`);
  lines.push("");
  lines.push("MEMBER CONTEXT");
  lines.push("-".repeat(44));
  lines.push(`Display Name: ${normalizeString(member?.display_name || ticket?.username) || "—"}`);
  lines.push(`Username: ${normalizeString(member?.username || ticket?.username) || "—"}`);
  lines.push(`User ID: ${normalizeString(member?.user_id || ticket?.user_id) || "—"}`);
  lines.push(`Verification: ${normalizeString(workspace?.verificationLabel) || "—"}`);
  lines.push(`Risk: ${normalizeString(workspace?.riskLevel) || "—"}`);
  lines.push(`Role State: ${normalizeString(member?.role_state) || "—"}`);
  lines.push("");

  if (ticket?.initial_message) {
    lines.push("INITIAL MESSAGE");
    lines.push("-".repeat(44));
    lines.push(String(ticket.initial_message));
    lines.push("");
  }

  lines.push(...renderRowsText("MESSAGES", safeArray<Row>(payload.messages), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.author_name || row?.author_id) || "Unknown"} • ${normalizeString(row?.message_type) || "message"}`,
    row?.content || "",
    ...safeArray<Row>(row?.attachments).map((a) => `Attachment: ${normalizeString(a?.name) || "attachment"} ${normalizeString(a?.url)}`),
  ]));

  lines.push(...renderRowsText("INTERNAL NOTES", safeArray<Row>(payload.notes), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.staff_name || row?.staff_id) || "Unknown Staff"}`,
    row?.content || "",
  ]));

  lines.push(...renderRowsText("VERIFICATION FLAGS", safeArray<Row>(payload.verificationFlags), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.created_at)} • score ${row?.score || 0} • flagged ${row?.flagged ? "yes" : "no"}`,
    safeArray<string>(row?.reasons).length ? safeArray<string>(row?.reasons).join(" • ") : "No reasons.",
  ]));

  lines.push(...renderRowsText("WARNS", safeArray<Row>(payload.warns), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.reason) || "No reason"}`,
  ]));

  lines.push(...renderRowsText("TOKEN HISTORY", safeArray<Row>(payload.verificationTokens), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.updated_at || row?.decided_at || row?.submitted_at || row?.created_at)} • status ${row?.status || "pending"} • decision ${row?.decision || "PENDING"}`,
  ]));

  lines.push(...renderRowsText("VC SESSIONS", safeArray<Row>(payload.vcSessions), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.completed_at || row?.started_at || row?.accepted_at || row?.canceled_at || row?.created_at)} • ${row?.status || "PENDING"} • ${row?.access_minutes || 0} min`,
  ]));

  lines.push(...renderRowsText("ACTIVITY", safeArray<Row>(payload.activity), (row, index) => [
    `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.title || row?.event_type) || "Activity"}`,
    normalizeString(row?.description || row?.reason),
  ]));

  return lines.join("\n");
}

function renderSimpleList(rows: Row[], emptyText: string, render: (row: Row) => string): string {
  if (!rows.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  return rows.map(render).join("\n");
}

function buildHtmlTranscript(payload: Row): string {
  const ticket = payload.ticket || {};
  const member = payload.member || null;
  const category = payload.category || null;
  const workspace = payload.workspace || {};
  const ownerName = normalizeString(member?.display_name || member?.nickname || member?.username || ticket?.username || ticket?.user_id) || "Unknown User";
  const categoryName = normalizeString(category?.name || ticket?.matched_category_name || ticket?.category) || "Uncategorized";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket Transcript ${escapeHtml(ticket?.ticket_number || ticket?.id || "")}</title>
<style>
  body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:#08110d; color:#e5f7ec; }
  .wrap { max-width:1100px; margin:0 auto; padding:32px; }
  .hero,.card { border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.045); border-radius:22px; padding:22px; margin-bottom:16px; }
  .muted,.label { color:#9fb7aa; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .meta { border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:12px; background:rgba(0,0,0,.16); }
  .label { display:block; font-size:12px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px; }
  .entry { border-top:1px solid rgba(255,255,255,.08); padding:12px 0; }
  .entry-top { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; color:#dfffe8; }
  .entry-body { white-space:pre-wrap; color:#cfe6d7; margin-top:8px; }
  .empty { color:#9fb7aa; padding:8px 0; }
</style>
</head>
<body>
<div class="wrap">
  <section class="hero">
    <div class="muted">Dank Shield Ticket Transcript</div>
    <h1>${escapeHtml(ticket?.title || `Ticket ${ticket?.ticket_number || ticket?.id || ""}`)}</h1>
    <p class="muted">Exported ${escapeHtml(formatDateTime(payload.exportedAt))} by ${escapeHtml(payload.viewer?.username || "Staff")}</p>
  </section>

  <section class="card">
    <h2>Ticket</h2>
    <div class="grid">
      <div class="meta"><span class="label">Server ID</span>${escapeHtml(payload.selectedGuildId || "—")}</div>
      <div class="meta"><span class="label">Ticket ID</span>${escapeHtml(ticket?.id || "—")}</div>
      <div class="meta"><span class="label">Ticket Number</span>${escapeHtml(ticket?.ticket_number || "—")}</div>
      <div class="meta"><span class="label">Category</span>${escapeHtml(categoryName)}</div>
      <div class="meta"><span class="label">Status</span>${escapeHtml(ticket?.status || "—")}</div>
      <div class="meta"><span class="label">Priority</span>${escapeHtml(ticket?.priority || "—")}</div>
      <div class="meta"><span class="label">Verification</span>${escapeHtml(workspace?.verificationLabel || "Unknown")}</div>
      <div class="meta"><span class="label">Risk</span>${escapeHtml(workspace?.riskLevel || "unknown")}</div>
      <div class="meta"><span class="label">Channel</span>${escapeHtml(ticket?.channel_name || "—")}</div>
      <div class="meta"><span class="label">Created</span>${escapeHtml(formatDateTime(ticket?.created_at))}</div>
      <div class="meta"><span class="label">Updated</span>${escapeHtml(formatDateTime(ticket?.updated_at))}</div>
      <div class="meta"><span class="label">Closed</span>${escapeHtml(formatDateTime(ticket?.closed_at))}</div>
    </div>
  </section>

  <section class="card">
    <h2>Member</h2>
    <div class="grid">
      <div class="meta"><span class="label">Display Name</span>${escapeHtml(ownerName)}</div>
      <div class="meta"><span class="label">Username</span>${escapeHtml(member?.username || ticket?.username || "—")}</div>
      <div class="meta"><span class="label">User ID</span>${escapeHtml(member?.user_id || ticket?.user_id || "—")}</div>
      <div class="meta"><span class="label">Role State</span>${escapeHtml(member?.role_state || "—")}</div>
      <div class="meta"><span class="label">Entry Method</span>${escapeHtml(member?.entry_method || payload.joins?.[0]?.entry_method || "—")}</div>
      <div class="meta"><span class="label">Invited By</span>${escapeHtml(member?.invited_by_name || payload.joins?.[0]?.invited_by_name || "—")}</div>
    </div>
  </section>

  ${ticket?.initial_message ? `<section class="card"><h2>Initial Message</h2><div class="entry-body">${escapeHtml(ticket.initial_message)}</div></section>` : ""}

  <section class="card"><h2>Messages</h2>${renderSimpleList(safeArray<Row>(payload.messages), "No ticket messages recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>${escapeHtml(row?.author_name || row?.author_id || "Unknown")}</strong><span>${escapeHtml(formatDateTime(row?.created_at))}</span></div><div class="entry-body">${escapeHtml(row?.content || "")}</div></div>`)}</section>
  <section class="card"><h2>Internal Notes</h2>${renderSimpleList(safeArray<Row>(payload.notes), "No internal notes recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>${escapeHtml(row?.staff_name || row?.staff_id || "Staff")}</strong><span>${escapeHtml(formatDateTime(row?.created_at))}</span></div><div class="entry-body">${escapeHtml(row?.content || "")}</div></div>`)}</section>
  <section class="card"><h2>Verification Flags</h2>${renderSimpleList(safeArray<Row>(payload.verificationFlags), "No verification flags recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>Score ${escapeHtml(row?.score || 0)}</strong><span>${escapeHtml(formatDateTime(row?.created_at))}</span></div><div class="entry-body">${escapeHtml(safeArray<string>(row?.reasons).join(" • ") || "No reasons recorded.")}</div></div>`)}</section>
  <section class="card"><h2>Warn History</h2>${renderSimpleList(safeArray<Row>(payload.warns), "No warns recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>Warn</strong><span>${escapeHtml(formatDateTime(row?.created_at))}</span></div><div class="entry-body">${escapeHtml(row?.reason || "No reason recorded.")}</div></div>`)}</section>
  <section class="card"><h2>Verification Tokens</h2>${renderSimpleList(safeArray<Row>(payload.verificationTokens), "No verification tokens recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>${escapeHtml(row?.status || "pending")} • ${escapeHtml(row?.decision || "PENDING")}</strong><span>${escapeHtml(formatDateTime(row?.updated_at || row?.decided_at || row?.submitted_at || row?.created_at))}</span></div><div class="entry-body">${escapeHtml(row?.role_sync_reason || row?.ai_status || "No extra token notes.")}</div></div>`)}</section>
  <section class="card"><h2>VC Sessions</h2>${renderSimpleList(safeArray<Row>(payload.vcSessions), "No VC sessions recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>${escapeHtml(row?.status || "PENDING")}</strong><span>${escapeHtml(formatDateTime(row?.completed_at || row?.started_at || row?.accepted_at || row?.canceled_at || row?.created_at))}</span></div><div class="entry-body">Access Minutes: ${escapeHtml(row?.access_minutes || 0)}</div></div>`)}</section>
  <section class="card"><h2>Activity Timeline</h2>${renderSimpleList(safeArray<Row>(payload.activity), "No activity rows recorded.", (row) => `<div class="entry"><div class="entry-top"><strong>${escapeHtml(row?.title || row?.event_type || "Activity")}</strong><span>${escapeHtml(formatDateTime(row?.created_at))}</span></div><div class="entry-body">${escapeHtml(row?.description || row?.reason || "No description.")}</div></div>`)}</section>
</div>
</body>
</html>`;
}

export async function GET(request: Request, context: RouteContext) {
  let session: DashboardAuthSession | null = null;

  try {
    session = await requireDashboardStaffSession();
    const typedSession = session as SessionLike;
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const guildId = normalizeString(session.selectedGuildId);
    const url = new URL(request.url);
    const format = normalizeLower(url.searchParams.get("format") || "html");

    if (!guildId) {
      return buildJsonResponse(
        { ok: false, error: "Select a server before exporting a transcript.", error_code: "selected_server_required", needsServerSelection: true },
        428,
        session
      );
    }

    if (!ticketId) {
      return buildJsonResponse({ ok: false, error: "Missing ticket id.", error_code: "invalid_request", selectedGuildId: guildId }, 400, session);
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .eq("guild_id", guildId)
      .single();

    if (ticketError || !ticketData) {
      return buildJsonResponse(
        { ok: false, error: ticketError?.message || "Ticket not found.", selectedGuildId: guildId },
        404,
        session
      );
    }

    const [messagesRes, notesRes, categoriesRes] = await Promise.all([
      supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      supabase.from("ticket_notes").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }),
      supabase.from("ticket_categories").select("*").eq("guild_id", guildId),
    ]);

    const categories = safeArray<Row>(categoriesRes.data || []);
    const ticket = enrichTicketWithMatchedCategory(mapTicket(ticketData as Row), categories) as Row;
    const ticketUserId = normalizeString(ticket?.user_id);
    const ticketChannelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);

    const [memberRowsRes, joinsRes, flagsRes, tokensRes, vcRes, warnsRes, activityRes] = await Promise.all([
      ticketUserId ? supabase.from("guild_members").select("*").eq("guild_id", guildId).eq("user_id", ticketUserId).limit(1) : Promise.resolve({ data: [], error: null }),
      ticketUserId ? supabase.from("member_joins").select("*").eq("guild_id", guildId).eq("user_id", ticketUserId).order("joined_at", { ascending: false }).limit(20) : Promise.resolve({ data: [], error: null }),
      ticketUserId ? supabase.from("verification_flags").select("*").eq("guild_id", guildId).eq("user_id", ticketUserId).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
      ticketUserId ? supabase.from("verification_tokens").select("*").eq("guild_id", guildId).or(`requester_id.eq.${ticketUserId},user_id.eq.${ticketUserId},approved_user_id.eq.${ticketUserId}`).order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [], error: null }),
      ticketUserId ? supabase.from("vc_verify_sessions").select("*").eq("guild_id", guildId).or(`owner_id.eq.${ticketUserId},requester_id.eq.${ticketUserId}`).order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [], error: null }),
      ticketUserId ? supabase.from("warns").select("*").eq("guild_id", guildId).eq("user_id", ticketUserId).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase
            .from("activity_feed_events")
            .select("*")
            .eq("guild_id", guildId)
            .or(ticketChannelId ? `ticket_id.eq.${ticketId},channel_id.eq.${ticketChannelId},target_user_id.eq.${ticketUserId}` : `ticket_id.eq.${ticketId},target_user_id.eq.${ticketUserId}`)
            .order("created_at", { ascending: false })
            .limit(100)
        : supabase.from("activity_feed_events").select("*").eq("guild_id", guildId).eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(100),
    ]);

    const member = mapMember((safeArray<Row>(memberRowsRes.data || [])[0] || null) as Row | null);
    const messages = safeArray<Row>(messagesRes.data).map(mapMessage);
    const notes = safeArray<Row>(notesRes.data).map(mapNote);
    const joins = safeArray<Row>(joinsRes.data);
    const verificationFlags = safeArray<Row>(flagsRes.data);
    const verificationTokens = safeArray<Row>(tokensRes.data);
    const vcSessions = safeArray<Row>(vcRes.data);
    const warns = safeArray<Row>(warnsRes.data);
    const activity = safeArray<Row>(activityRes.data).sort((a, b) => parseDateMs(a.created_at) - parseDateMs(b.created_at));

    const category = categories.find((row) => {
      return (
        normalizeString(row?.id) === normalizeString(ticket?.category_id || ticket?.matched_category_id) ||
        normalizeLower(row?.slug) === normalizeLower(ticket?.matched_category_slug || ticket?.category || ticket?.matched_intake_type)
      );
    }) || null;

    const latestFlag = latestBy(verificationFlags, "created_at");
    const latestToken = latestBy(verificationTokens, "updated_at", "decided_at", "submitted_at", "created_at");
    const latestVc = latestBy(vcSessions, "completed_at", "started_at", "accepted_at", "canceled_at", "created_at");
    const flaggedCount = verificationFlags.filter((row) => row.flagged).length;
    const maxFlagScore = Math.max(0, ...verificationFlags.map((row) => Number(row.score || 0)));
    const warnCount = warns.length;
    const noteCount = notes.length;

    const viewer = {
      id: typedSession?.user?.discord_id || typedSession?.user?.id || typedSession?.discordUser?.id || "",
      username: typedSession?.user?.username || typedSession?.discordUser?.username || typedSession?.user?.name || "Staff",
    };

    const workspace = {
      verificationLabel: deriveVerificationLabel({ member, latestToken, latestVc, flaggedCount, ticket }),
      riskLevel: deriveRiskLevel({ ticket, member, flaggedCount, warnCount, maxFlagScore, noteCount }),
      recommendedActions: [
        !normalizeString(ticket?.claimed_by) && !normalizeString(ticket?.assigned_to) ? "Claim this ticket." : "",
        flaggedCount > 0 ? "Review verification flags before resolving." : "",
        noteCount === 0 ? "Add an internal note for staff continuity." : "",
        normalizeLower(ticket?.matched_intake_type) === "verification" && member?.has_unverified ? "Confirm verification path and final role state." : "",
      ].filter(Boolean),
      latestFlag: latestFlag || null,
      latestToken: latestToken || null,
      latestVc: latestVc || null,
    };

    const transcriptPayload = {
      ok: true,
      selectedGuildId: guildId,
      ticket,
      member,
      category,
      joins,
      warns,
      verificationFlags,
      verificationTokens,
      vcSessions,
      notes,
      messages,
      activity,
      workspace,
      viewer,
      exportedAt: new Date().toISOString(),
    };

    const fileBase = transcriptFileName(ticket);

    if (format === "json") {
      return buildAttachmentResponse(
        JSON.stringify(transcriptPayload, null, 2),
        "application/json; charset=utf-8",
        `${fileBase}.json`,
        session
      );
    }

    if (format === "txt" || format === "text") {
      return buildAttachmentResponse(
        buildTextTranscript(transcriptPayload),
        "text/plain; charset=utf-8",
        `${fileBase}.txt`,
        session
      );
    }

    return buildAttachmentResponse(
      buildHtmlTranscript(transcriptPayload),
      "text/html; charset=utf-8",
      `${fileBase}.html`,
      session
    );
  } catch (error) {
    return dashboardAuthErrorJson(error, session, 500);
  }
}
