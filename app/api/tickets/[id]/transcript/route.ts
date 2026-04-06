import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { enrichTicketWithMatchedCategory } from "@/lib/ticketCategoryMatching";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RefreshedTokens = unknown;

type RouteContext = {
  params: {
    id?: string;
  };
};

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

type TicketCategoryRow = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  description?: string | null;
  button_label?: string | null;
  guild_id?: string | null;
};

type TicketRow = {
  id?: string | null;
  guild_id?: string | null;
  user_id?: string | null;
  username?: string | null;
  title?: string | null;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  claimed_by?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  initial_message?: string | null;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  source?: string | null;
  is_ghost?: boolean | null;
  ticket_number?: number | null;
  category_id?: string | null;
  matched_category_id?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  matched_intake_type?: string | null;
};

type GuildMemberRow = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  role_ids?: string[] | null;
  role_names?: string[] | null;
  roles?: Array<Record<string, unknown>> | null;
  in_guild?: boolean | null;
  has_unverified?: boolean | null;
  has_verified_role?: boolean | null;
  has_staff_role?: boolean | null;
  has_secondary_verified_role?: boolean | null;
  role_state?: string | null;
  role_state_reason?: string | null;
  entry_method?: string | null;
  verification_source?: string | null;
  invited_by_name?: string | null;
  vouched_by_name?: string | null;
  approved_by_name?: string | null;
};

type TicketMessageRow = {
  id?: string | null;
  ticket_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  content?: string | null;
  message_type?: string | null;
  attachments?: Array<{ name?: string | null; url?: string | null }> | null;
  source?: string | null;
  created_at?: string | null;
};

type TicketNoteRow = {
  id?: string | null;
  ticket_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  content?: string | null;
  created_at?: string | null;
};

type VerificationFlagRow = {
  id?: string | null;
  user_id?: string | null;
  score?: number | null;
  flagged?: boolean | null;
  reasons?: string[] | null;
  created_at?: string | null;
};

type VerificationTokenRow = {
  requester_id?: string | null;
  user_id?: string | null;
  approved_user_id?: string | null;
  status?: string | null;
  decision?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  expires_at?: string | null;
  role_sync_ok?: boolean | null;
  role_sync_reason?: string | null;
  ai_status?: string | null;
};

type VcSessionRow = {
  token?: string | null;
  guild_id?: string | number | null;
  ticket_channel_id?: string | number | null;
  requester_id?: string | number | null;
  owner_id?: string | number | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  access_minutes?: number | null;
  meta?: Record<string, unknown> | null;
};

type WarnRow = {
  user_id?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

type JoinRow = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  joined_at?: string | null;
  entry_method?: string | null;
  verification_source?: string | null;
  invite_code?: string | null;
  invited_by?: string | null;
  invited_by_name?: string | null;
  vouched_by?: string | null;
  vouched_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  join_note?: string | null;
  source_ticket_id?: string | null;
};

type ActivityFeedRow = {
  id?: string | null;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  event_family?: string | null;
  event_type?: string | null;
  source?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  target_user_id?: string | null;
  target_name?: string | null;
  channel_id?: string | null;
  channel_name?: string | null;
  ticket_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

type TranscriptPayload = {
  ok: true;
  ticket: TicketRow;
  member: GuildMemberRow | null;
  category: TicketCategoryRow | null;
  joins: JoinRow[];
  warns: WarnRow[];
  verificationFlags: VerificationFlagRow[];
  verificationTokens: VerificationTokenRow[];
  vcSessions: VcSessionRow[];
  notes: TicketNoteRow[];
  messages: TicketMessageRow[];
  activity: ActivityFeedRow[];
  workspace: {
    verificationLabel: string;
    riskLevel: string;
    recommendedActions: string[];
    latestFlag: VerificationFlagRow | null;
    latestToken: VerificationTokenRow | null;
    latestVc: VcSessionRow | null;
  };
  viewer: {
    id: string;
    username: string;
  };
  exportedAt: string;
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

function safeObject<T extends object = Record<string, unknown>>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

function parseDateMs(value: unknown): number {
  const ms = new Date(value || 0).getTime();
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

function buildJsonResponse(
  payload: Record<string, unknown>,
  status = 200,
  refreshedTokens: RefreshedTokens | null = null
) {
  const response = NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  applyAuthCookies(response, refreshedTokens);
  return response;
}

function mapTicket(row: TicketRow): TicketRow {
  return {
    ...row,
    priority: row?.priority || "medium",
    channel_id: row?.channel_id || row?.discord_thread_id || null,
    channel_name: row?.channel_name || null,
    source: row?.source || "discord",
    is_ghost: Boolean(row?.is_ghost),
  };
}

function mapGuildMember(row: GuildMemberRow | null): GuildMemberRow | null {
  if (!row) return null;

  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    username: row?.username || "",
    display_name: row?.display_name || "",
    nickname: row?.nickname || "",
    avatar_url: row?.avatar_url || null,
    role_ids: Array.isArray(row?.role_ids) ? row.role_ids : [],
    role_names: Array.isArray(row?.role_names) ? row.role_names : [],
    roles: Array.isArray(row?.roles) ? row.roles : [],
    in_guild: row?.in_guild !== false,
    has_unverified: Boolean(row?.has_unverified),
    has_verified_role: Boolean(row?.has_verified_role),
    has_staff_role: Boolean(row?.has_staff_role),
    has_secondary_verified_role: Boolean(row?.has_secondary_verified_role),
    role_state: row?.role_state || "unknown",
    role_state_reason: row?.role_state_reason || "",
  };
}

function mapTicketMessage(row: TicketMessageRow): TicketMessageRow {
  return {
    id: row?.id || null,
    ticket_id: row?.ticket_id || null,
    author_id: normalizeString(row?.author_id),
    author_name: row?.author_name || "",
    content: row?.content || "",
    message_type: normalizeLower(row?.message_type || "staff") || "staff",
    attachments: safeArray(row?.attachments),
    source: row?.source || null,
    created_at: row?.created_at || null,
  };
}

function mapTicketNote(row: TicketNoteRow): TicketNoteRow {
  return {
    id: row?.id || null,
    ticket_id: normalizeString(row?.ticket_id),
    staff_id: normalizeString(row?.staff_id),
    staff_name: row?.staff_name || "",
    content: row?.content || "",
    created_at: row?.created_at || null,
  };
}

function mapVerificationFlag(row: VerificationFlagRow): VerificationFlagRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    score: Number(row?.score || 0),
    flagged: Boolean(row?.flagged),
    reasons: Array.isArray(row?.reasons) ? row.reasons : [],
    created_at: row?.created_at || null,
  };
}

function mapVerificationToken(row: VerificationTokenRow): VerificationTokenRow {
  return {
    ...row,
    requester_id: normalizeString(row?.requester_id),
    user_id: normalizeString(row?.user_id),
    approved_user_id: normalizeString(row?.approved_user_id),
    status: normalizeLower(row?.status || "pending") || "pending",
    decision: normalizeString(row?.decision || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    submitted_at: row?.submitted_at || null,
    decided_at: row?.decided_at || null,
    expires_at: row?.expires_at || null,
    role_sync_ok: Boolean(row?.role_sync_ok),
    role_sync_reason: row?.role_sync_reason || null,
    ai_status: row?.ai_status || null,
  };
}

function mapVcSession(row: VcSessionRow): VcSessionRow {
  return {
    ...row,
    token: row?.token || null,
    guild_id: normalizeString(row?.guild_id),
    ticket_channel_id: normalizeString(row?.ticket_channel_id),
    requester_id: normalizeString(row?.requester_id),
    owner_id: normalizeString(row?.owner_id),
    status: normalizeString(row?.status || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    accepted_at: row?.accepted_at || null,
    started_at: row?.started_at || null,
    completed_at: row?.completed_at || null,
    canceled_at: row?.canceled_at || null,
    access_minutes: Number(row?.access_minutes || 0),
    meta: safeObject(row?.meta),
  };
}

function mapWarn(row: WarnRow): WarnRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    reason: row?.reason || "",
    created_at: row?.created_at || null,
  };
}

function mapJoin(row: JoinRow): JoinRow {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    username: row?.username || "",
    display_name: row?.display_name || "",
    avatar_url: row?.avatar_url || null,
    joined_at: row?.joined_at || null,
    entry_method: row?.entry_method || null,
    verification_source: row?.verification_source || null,
    invite_code: row?.invite_code || null,
    invited_by: row?.invited_by || null,
    invited_by_name: row?.invited_by_name || null,
    vouched_by: row?.vouched_by || null,
    vouched_by_name: row?.vouched_by_name || null,
    approved_by: row?.approved_by || null,
    approved_by_name: row?.approved_by_name || null,
    join_note: row?.join_note || null,
    source_ticket_id: row?.source_ticket_id || null,
  };
}

function mapActivityRow(row: ActivityFeedRow): ActivityFeedRow {
  const meta = safeObject(row?.metadata);

  return {
    id: row?.id || null,
    created_at: row?.created_at || null,
    title: row?.title || row?.event_type || "Activity",
    description: row?.description || row?.reason || "",
    reason: row?.reason || "",
    event_family: row?.event_family || "activity",
    event_type: row?.event_type || "activity",
    source: row?.source || "system",
    actor_user_id: normalizeString(row?.actor_user_id),
    actor_name: row?.actor_name || "",
    target_user_id: normalizeString(row?.target_user_id),
    target_name: row?.target_name || "",
    channel_id: row?.channel_id || normalizeString(meta?.channel_id) || null,
    channel_name: row?.channel_name || normalizeString(meta?.channel_name) || null,
    ticket_id: row?.ticket_id || normalizeString(meta?.ticket_id) || null,
    metadata: meta,
  };
}

function deriveVerificationLabel(args: {
  member: GuildMemberRow | null;
  latestToken: VerificationTokenRow | null;
  latestVc: VcSessionRow | null;
  flaggedCount: number;
  ticket: TicketRow;
}): string {
  const { member, latestToken, latestVc, flaggedCount, ticket } = args;
  const tokenStatus = normalizeLower(latestToken?.status);
  const tokenDecision = normalizeString(latestToken?.decision).toUpperCase();
  const vcStatus = normalizeString(latestVc?.status).toUpperCase();

  if (member?.has_staff_role) return "Staff";
  if (
    member?.has_verified_role ||
    member?.has_secondary_verified_role ||
    tokenStatus === "approved" ||
    tokenDecision === "APPROVED"
  ) {
    return "Verified";
  }

  if (tokenStatus === "denied" || tokenDecision === "DENIED") {
    return "Denied";
  }

  if (flaggedCount > 0) {
    return "Needs Review";
  }

  if (["PENDING", "ACCEPTED", "STAFF_ACCEPTED", "READY", "IN_VC", "STARTED"].includes(vcStatus)) {
    return "VC In Progress";
  }

  if (
    tokenStatus === "pending" ||
    tokenStatus === "submitted" ||
    tokenStatus === "resubmit" ||
    member?.has_unverified ||
    normalizeLower(ticket?.matched_intake_type) === "verification"
  ) {
    return "Pending";
  }

  return "Unknown";
}

function deriveRiskLevel(args: {
  ticket: TicketRow;
  member: GuildMemberRow | null;
  flaggedCount: number;
  warnCount: number;
  maxFlagScore: number;
  noteCount: number;
}): string {
  const { ticket, member, flaggedCount, warnCount, maxFlagScore, noteCount } = args;
  const priority = normalizeLower(ticket?.priority);

  if (
    flaggedCount > 0 ||
    maxFlagScore >= 5 ||
    warnCount >= 3 ||
    priority === "urgent"
  ) {
    return "high";
  }

  if (
    priority === "high" ||
    warnCount >= 1 ||
    maxFlagScore >= 2 ||
    (member?.has_unverified && normalizeLower(ticket?.matched_intake_type) === "verification") ||
    noteCount === 0
  ) {
    return "medium";
  }

  return "low";
}

function latestBy<T extends Record<string, unknown>>(rows: T[], ...fields: string[]): T | null {
  return [...safeArray<T>(rows)].sort((a, b) => {
    const aTs = Math.max(...fields.map((field) => parseDateMs(a?.[field])));
    const bTs = Math.max(...fields.map((field) => parseDateMs(b?.[field])));
    return bTs - aTs;
  })[0] || null;
}

function transcriptFileName(ticket: TicketRow): string {
  const base = normalizeString(ticket?.ticket_number)
    ? `ticket-${ticket.ticket_number}`
    : normalizeString(ticket?.id)
      ? `ticket-${ticket.id}`
      : "ticket-transcript";

  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

function buildTextTranscript(payload: TranscriptPayload): string {
  const {
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
  } = payload;

  const lines: string[] = [];

  lines.push("STONEY VERIFY TICKET TRANSCRIPT");
  lines.push("=".repeat(44));
  lines.push("");
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
  lines.push("");
  lines.push("MEMBER CONTEXT");
  lines.push("-".repeat(44));
  lines.push(`Display Name: ${normalizeString(member?.display_name || ticket?.username) || "—"}`);
  lines.push(`Username: ${normalizeString(member?.username || ticket?.username) || "—"}`);
  lines.push(`User ID: ${normalizeString(member?.user_id || ticket?.user_id) || "—"}`);
  lines.push(`Verification: ${normalizeString(workspace?.verificationLabel) || "—"}`);
  lines.push(`Risk: ${normalizeString(workspace?.riskLevel) || "—"}`);
  lines.push(`Role State: ${normalizeString(member?.role_state) || "—"}`);
  lines.push(`Entry Method: ${normalizeString(member?.entry_method || joins?.[0]?.entry_method) || "—"}`);
  lines.push(`Invited By: ${normalizeString(member?.invited_by_name || joins?.[0]?.invited_by_name) || "—"}`);
  lines.push(`Vouched By: ${normalizeString(member?.vouched_by_name || joins?.[0]?.vouched_by_name) || "—"}`);
  lines.push(`Approved By: ${normalizeString(member?.approved_by_name || joins?.[0]?.approved_by_name) || "—"}`);
  lines.push("");

  if (ticket?.initial_message) {
    lines.push("INITIAL MESSAGE");
    lines.push("-".repeat(44));
    lines.push(String(ticket.initial_message));
    lines.push("");
  }

  lines.push("MESSAGES");
  lines.push("-".repeat(44));
  if (!messages.length) {
    lines.push("No ticket messages recorded.");
  } else {
    messages.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.author_name || row?.author_id) || "Unknown"} • ${normalizeString(row?.message_type) || "message"}`
      );
      lines.push(row?.content || "");
      if (safeArray(row?.attachments).length) {
        lines.push("Attachments:");
        safeArray<{ name?: string | null; url?: string | null }>(row.attachments).forEach((attachment) => {
          const name = normalizeString(attachment?.name) || "attachment";
          const url = normalizeString(attachment?.url) || "";
          lines.push(`- ${name}: ${url}`);
        });
      }
      lines.push("");
    });
  }

  lines.push("INTERNAL NOTES");
  lines.push("-".repeat(44));
  if (!notes.length) {
    lines.push("No internal notes recorded.");
  } else {
    notes.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.staff_name || row?.staff_id) || "Unknown Staff"}`
      );
      lines.push(row?.content || "");
      lines.push("");
    });
  }

  lines.push("VERIFICATION FLAGS");
  lines.push("-".repeat(44));
  if (!verificationFlags.length) {
    lines.push("No verification flags recorded.");
  } else {
    verificationFlags.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.created_at)} • score ${row?.score || 0} • flagged ${row?.flagged ? "yes" : "no"}`
      );
      lines.push(
        Array.isArray(row?.reasons) && row.reasons.length
          ? row.reasons.join(" • ")
          : "No reasons."
      );
      lines.push("");
    });
  }

  lines.push("WARNS");
  lines.push("-".repeat(44));
  if (!warns.length) {
    lines.push("No warns recorded.");
  } else {
    warns.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.reason) || "No reason"}`
      );
    });
    lines.push("");
  }

  lines.push("TOKEN HISTORY");
  lines.push("-".repeat(44));
  if (!verificationTokens.length) {
    lines.push("No verification tokens recorded.");
  } else {
    verificationTokens.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.updated_at || row?.decided_at || row?.submitted_at || row?.created_at)} • status ${row?.status || "pending"} • decision ${row?.decision || "PENDING"}`
      );
    });
    lines.push("");
  }

  lines.push("VC SESSIONS");
  lines.push("-".repeat(44));
  if (!vcSessions.length) {
    lines.push("No VC sessions recorded.");
  } else {
    vcSessions.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.completed_at || row?.started_at || row?.accepted_at || row?.canceled_at || row?.created_at)} • ${row?.status || "PENDING"} • ${row?.access_minutes || 0} min`
      );
    });
    lines.push("");
  }

  lines.push("ACTIVITY");
  lines.push("-".repeat(44));
  if (!activity.length) {
    lines.push("No activity rows recorded.");
  } else {
    activity.forEach((row, index) => {
      lines.push(
        `[${index + 1}] ${formatDateTime(row?.created_at)} • ${normalizeString(row?.title || row?.event_type) || "Activity"}`
      );
      const body = normalizeString(row?.description || row?.reason);
      if (body) lines.push(body);
      lines.push("");
    });
  }

  return lines.join("\n");
}

function buildHtmlTranscript(payload: TranscriptPayload): string {
  const {
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
  } = payload;

  const ownerName =
    normalizeString(
      member?.display_name ||
      member?.nickname ||
      member?.username ||
      ticket?.username ||
      ticket?.user_id
    ) || "Unknown User";

  const categoryName =
    normalizeString(category?.name || ticket?.matched_category_name || ticket?.category) ||
    "Uncategorized";

  const recommendedActions = safeArray<string>(workspace?.recommendedActions || []);

  const renderBadge = (value: unknown, tone = ""): string => {
    const label = escapeHtml(value || "Unknown");
    const cls = tone ? `badge ${tone}` : "badge";
    return `<span class="${cls}">${label}</span>`;
  };

  const renderInfoGrid = (): string => `
    <div class="grid cols-3">
      <div class="meta"><span class="label">Ticket ID</span><span>${escapeHtml(ticket?.id || "—")}</span></div>
      <div class="meta"><span class="label">Ticket Number</span><span>${escapeHtml(ticket?.ticket_number || "—")}</span></div>
      <div class="meta"><span class="label">Category</span><span>${escapeHtml(categoryName)}</span></div>
      <div class="meta"><span class="label">Status</span><span>${escapeHtml(ticket?.status || "—")}</span></div>
      <div class="meta"><span class="label">Priority</span><span>${escapeHtml(ticket?.priority || "—")}</span></div>
      <div class="meta"><span class="label">Verification</span><span>${escapeHtml(workspace?.verificationLabel || "Unknown")}</span></div>
      <div class="meta"><span class="label">Risk</span><span>${escapeHtml(workspace?.riskLevel || "unknown")}</span></div>
      <div class="meta"><span class="label">Channel</span><span>${escapeHtml(ticket?.channel_name || "—")}</span></div>
      <div class="meta"><span class="label">Channel ID</span><span>${escapeHtml(ticket?.channel_id || ticket?.discord_thread_id || "—")}</span></div>
      <div class="meta"><span class="label">Created</span><span>${escapeHtml(formatDateTime(ticket?.created_at))}</span></div>
      <div class="meta"><span class="label">Updated</span><span>${escapeHtml(formatDateTime(ticket?.updated_at))}</span></div>
      <div class="meta"><span class="label">Closed</span><span>${escapeHtml(formatDateTime(ticket?.closed_at))}</span></div>
    </div>
  `;

  const renderMemberGrid = (): string => `
    <div class="grid cols-3">
      <div class="meta"><span class="label">Display Name</span><span>${escapeHtml(ownerName)}</span></div>
      <div class="meta"><span class="label">Username</span><span>${escapeHtml(member?.username || ticket?.username || "—")}</span></div>
      <div class="meta"><span class="label">User ID</span><span>${escapeHtml(member?.user_id || ticket?.user_id || "—")}</span></div>
      <div class="meta"><span class="label">Role State</span><span>${escapeHtml(member?.role_state || "—")}</span></div>
      <div class="meta"><span class="label">Entry Method</span><span>${escapeHtml(member?.entry_method || joins?.[0]?.entry_method || "—")}</span></div>
      <div class="meta"><span class="label">Verification Source</span><span>${escapeHtml(member?.verification_source || joins?.[0]?.verification_source || "—")}</span></div>
      <div class="meta"><span class="label">Invited By</span><span>${escapeHtml(member?.invited_by_name || joins?.[0]?.invited_by_name || "—")}</span></div>
      <div class="meta"><span class="label">Vouched By</span><span>${escapeHtml(member?.vouched_by_name || joins?.[0]?.vouched_by_name || "—")}</span></div>
      <div class="meta"><span class="label">Approved By</span><span>${escapeHtml(member?.approved_by_name || joins?.[0]?.approved_by_name || "—")}</span></div>
      <div class="meta full"><span class="label">Role State Reason</span><span>${escapeHtml(member?.role_state_reason || "—")}</span></div>
      <div class="meta full"><span class="label">Recommended Actions</span><span>${recommendedActions.length ? escapeHtml(recommendedActions.join(" • ")) : "None"}</span></div>
      <div class="meta"><span class="label">Exported By</span><span>${escapeHtml(viewer?.username || "Staff")}</span></div>
      <div class="meta"><span class="label">Exported At</span><span>${escapeHtml(formatDateTime(new Date().toISOString()))}</span></div>
      <div class="meta"><span class="label">Ghost Ticket</span><span>${ticket?.is_ghost ? "yes" : "no"}</span></div>
    </div>
  `;

  const renderMessages = (): string => {
    if (!messages.length) return `<div class="empty">No ticket messages recorded.</div>`;

    return messages.map((row) => `
      <div class="entry ${row?.message_type === "staff" ? "staff" : "user"}">
        <div class="entry-top">
          <strong>${escapeHtml(row?.author_name || row?.author_id || "Unknown")}</strong>
          <span>${escapeHtml(formatDateTime(row?.created_at))}</span>
        </div>
        <div class="entry-body">${escapeHtml(row?.content || "").replace(/\n/g, "<br />")}</div>
        ${safeArray(row?.attachments).length ? `
          <div class="sublist">
            ${safeArray<{ name?: string | null; url?: string | null }>(row.attachments).map((attachment) => `<div>📎 <a href="${escapeHtml(attachment?.url || "")}" target="_blank" rel="noreferrer">${escapeHtml(attachment?.name || attachment?.url || "attachment")}</a></div>`).join("")}
          </div>
        ` : ""}
      </div>
    `).join("");
  };

  const renderNotes = (): string => {
    if (!notes.length) return `<div class="empty">No internal notes recorded.</div>`;

    return notes.map((row) => `
      <div class="entry note">
        <div class="entry-top">
          <strong>${escapeHtml(row?.staff_name || row?.staff_id || "Unknown Staff")}</strong>
          <span>${escapeHtml(formatDateTime(row?.created_at))}</span>
        </div>
        <div class="entry-body">${escapeHtml(row?.content || "").replace(/\n/g, "<br />")}</div>
      </div>
    `).join("");
  };

  const renderSimpleList = <T,>(
    rows: T[],
    emptyText: string,
    renderer: (row: T) => string
  ): string => {
    if (!rows.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
    return rows.map(renderer).join("");
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(categoryName)} Transcript • ${escapeHtml(ownerName)}</title>
  <style>
    :root {
      color-scheme: dark;
      --text: #e5edf6;
      --muted: #93a4b8;
      --line: rgba(255,255,255,0.08);
      --blue: #63d5ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background:
        radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
        radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%),
        linear-gradient(180deg, rgba(14,25,35,0.98), rgba(7,13,21,0.98));
      color: var(--text);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .wrap { max-width: 1200px; margin: 0 auto; display: grid; gap: 18px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 18px;
      background:
        radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
        rgba(16,26,37,0.96);
      box-shadow: 0 12px 24px rgba(0,0,0,0.22);
    }
    .hero { display: grid; gap: 12px; }
    h1,h2,h3 { margin: 0; }
    h1 { font-size: clamp(30px, 5vw, 46px); line-height: 0.95; letter-spacing: -0.04em; }
    h2 { font-size: 18px; margin-bottom: 12px; }
    .muted { color: var(--muted); }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      font-size: 12px;
    }
    .badge.open { border-color: rgba(99,213,255,0.22); background: rgba(99,213,255,0.08); }
    .badge.claimed { border-color: rgba(93,255,141,0.22); background: rgba(93,255,141,0.08); }
    .badge.warn { border-color: rgba(251,191,36,0.22); background: rgba(251,191,36,0.08); }
    .badge.danger { border-color: rgba(248,113,113,0.22); background: rgba(248,113,113,0.08); }
    .grid { display: grid; gap: 12px; }
    .cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .meta {
      display: grid;
      gap: 4px;
      padding: 12px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.025);
      min-width: 0;
    }
    .meta.full { grid-column: 1 / -1; }
    .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .entry {
      border-radius: 16px;
      border: 1px solid var(--line);
      padding: 14px;
      background: rgba(255,255,255,0.025);
      display: grid;
      gap: 10px;
    }
    .entry.staff { border-color: rgba(99,213,255,0.16); }
    .entry.user { border-color: rgba(93,255,141,0.16); }
    .entry.note { border-color: rgba(251,191,36,0.16); }
    .entry-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 12px;
    }
    .entry-body {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--text);
    }
    .sublist {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
    }
    a { color: var(--blue); }
    .empty {
      padding: 14px;
      border-radius: 16px;
      border: 1px dashed var(--line);
      color: var(--muted);
    }
    .section { display: grid; gap: 12px; }
    @media (max-width: 900px) {
      .cols-3 { grid-template-columns: 1fr; }
      body { padding: 14px; }
    }
    @media print {
      body { background: white; color: black; padding: 0; }
      .card { box-shadow: none; border-color: #ddd; background: white; }
      .meta, .entry, .empty { border-color: #ddd; background: white; }
      .muted, .label, .entry-top, a { color: #444 !important; }
      .badge { border-color: #bbb; background: #f4f4f4; color: #111; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="card hero">
      <div class="muted">Stoney Verify Ticket Transcript</div>
      <h1>${escapeHtml(ticket?.title || categoryName || "Ticket Transcript")}</h1>
      <div class="muted">${escapeHtml(ownerName)} • ${escapeHtml(categoryName)} • exported ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      <div class="badges">
        ${renderBadge(ticket?.status || "unknown", normalizeLower(ticket?.status) === "closed" ? "warn" : normalizeLower(ticket?.status) === "claimed" ? "claimed" : normalizeLower(ticket?.status) === "open" ? "open" : "")}
        ${renderBadge(ticket?.priority || "medium", normalizeLower(ticket?.priority) === "urgent" || normalizeLower(ticket?.priority) === "high" ? "danger" : normalizeLower(ticket?.priority) === "medium" ? "warn" : "")}
        ${renderBadge(workspace?.verificationLabel || "Unknown", normalizeLower(workspace?.verificationLabel) === "verified" ? "claimed" : normalizeLower(workspace?.verificationLabel) === "pending" ? "open" : normalizeLower(workspace?.verificationLabel) === "needs review" ? "danger" : "")}
        ${renderBadge(`${workspace?.riskLevel || "unknown"} risk`, normalizeLower(workspace?.riskLevel) === "high" ? "danger" : normalizeLower(workspace?.riskLevel) === "medium" ? "warn" : "")}
      </div>
    </section>

    <section class="card section">
      <h2>Ticket Snapshot</h2>
      ${renderInfoGrid()}
    </section>

    <section class="card section">
      <h2>Member Context</h2>
      ${renderMemberGrid()}
    </section>

    ${ticket?.initial_message ? `
      <section class="card section">
        <h2>Initial Message</h2>
        <div class="entry"><div class="entry-body">${escapeHtml(ticket.initial_message).replace(/\n/g, "<br />")}</div></div>
      </section>
    ` : ""}

    <section class="card section">
      <h2>Messages</h2>
      ${renderMessages()}
    </section>

    <section class="card section">
      <h2>Internal Notes</h2>
      ${renderNotes()}
    </section>

    <section class="card section">
      <h2>Verification Flags</h2>
      ${renderSimpleList<VerificationFlagRow>(
        verificationFlags,
        "No verification flags recorded.",
        (row) => `
          <div class="entry note">
            <div class="entry-top">
              <strong>Score ${escapeHtml(row?.score || 0)}</strong>
              <span>${escapeHtml(formatDateTime(row?.created_at))}</span>
            </div>
            <div class="entry-body">${escapeHtml(Array.isArray(row?.reasons) && row.reasons.length ? row.reasons.join(" • ") : "No reasons recorded.")}</div>
          </div>
        `
      )}
    </section>

    <section class="card section">
      <h2>Warn History</h2>
      ${renderSimpleList<WarnRow>(
        warns,
        "No warns recorded.",
        (row) => `
          <div class="entry">
            <div class="entry-top">
              <strong>Warn</strong>
              <span>${escapeHtml(formatDateTime(row?.created_at))}</span>
            </div>
            <div class="entry-body">${escapeHtml(row?.reason || "No reason recorded.")}</div>
          </div>
        `
      )}
    </section>

    <section class="card section">
      <h2>Verification Tokens</h2>
      ${renderSimpleList<VerificationTokenRow>(
        verificationTokens,
        "No verification tokens recorded.",
        (row) => `
          <div class="entry">
            <div class="entry-top">
              <strong>${escapeHtml(row?.status || "pending")} • ${escapeHtml(row?.decision || "PENDING")}</strong>
              <span>${escapeHtml(formatDateTime(row?.updated_at || row?.decided_at || row?.submitted_at || row?.created_at))}</span>
            </div>
            <div class="entry-body">${escapeHtml(row?.role_sync_reason || row?.ai_status || "No extra token notes.")}</div>
          </div>
        `
      )}
    </section>

    <section class="card section">
      <h2>VC Sessions</h2>
      ${renderSimpleList<VcSessionRow>(
        vcSessions,
        "No VC sessions recorded.",
        (row) => `
          <div class="entry">
            <div class="entry-top">
              <strong>${escapeHtml(row?.status || "PENDING")}</strong>
              <span>${escapeHtml(formatDateTime(row?.completed_at || row?.started_at || row?.accepted_at || row?.canceled_at || row?.created_at))}</span>
            </div>
            <div class="entry-body">Access Minutes: ${escapeHtml(row?.access_minutes || 0)}</div>
          </div>
        `
      )}
    </section>

    <section class="card section">
      <h2>Activity Timeline</h2>
      ${renderSimpleList<ActivityFeedRow>(
        activity,
        "No activity rows recorded.",
        (row) => `
          <div class="entry">
            <div class="entry-top">
              <strong>${escapeHtml(row?.title || row?.event_type || "Activity")}</strong>
              <span>${escapeHtml(formatDateTime(row?.created_at))}</span>
            </div>
            <div class="entry-body">${escapeHtml(row?.description || row?.reason || "No description.")}</div>
          </div>
        `
      )}
    </section>
  </div>
</body>
</html>`;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const typedSession = session as SessionLike;
    const supabase = createServerSupabase();
    const ticketId = normalizeString(context?.params?.id);
    const url = new URL(request.url);
    const format = normalizeLower(url.searchParams.get("format") || "html");

    if (!ticketId) {
      return buildJsonResponse({ error: "Missing ticket id." }, 400, refreshedTokens);
    }

    const [ticketRes, messagesRes, notesRes, categoriesRes] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", ticketId).single(),
      supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      supabase.from("ticket_notes").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }),
      supabase.from("ticket_categories").select("*").eq("guild_id", env.guildId || ""),
    ]);

    if (ticketRes.error || !ticketRes.data) {
      return buildJsonResponse(
        { error: ticketRes.error?.message || "Ticket not found." },
        404,
        refreshedTokens
      );
    }

    const ticket = enrichTicketWithMatchedCategory(
      mapTicket(ticketRes.data as TicketRow),
      safeArray<TicketCategoryRow>(categoriesRes.data || [])
    ) as TicketRow;

    const ticketUserId = normalizeString(ticket?.user_id);
    const ticketChannelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);

    const [
      memberRowsRes,
      joinsRes,
      flagsRes,
      tokensRes,
      vcRes,
      warnsRes,
      activityRes,
    ] = await Promise.all([
      ticketUserId
        ? supabase.from("guild_members").select("*").eq("guild_id", env.guildId || "").eq("user_id", ticketUserId).limit(1)
        : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase.from("member_joins").select("*").eq("guild_id", env.guildId || "").eq("user_id", ticketUserId).order("joined_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase.from("verification_flags").select("*").eq("guild_id", env.guildId || "").eq("user_id", ticketUserId).order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase.from("verification_tokens").select("*").eq("guild_id", env.guildId || "").or(`requester_id.eq.${ticketUserId},user_id.eq.${ticketUserId},approved_user_id.eq.${ticketUserId}`).order("created_at", { ascending: false }).limit(60)
        : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase.from("vc_verify_sessions").select("*").eq("guild_id", env.guildId || "").or(`owner_id.eq.${ticketUserId},requester_id.eq.${ticketUserId}`).order("created_at", { ascending: false }).limit(40)
        : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase.from("warns").select("*").eq("guild_id", env.guildId || "").eq("user_id", ticketUserId).order("created_at", { ascending: false }).limit(30)
        : Promise.resolve({ data: [], error: null }),
      ticketUserId
        ? supabase.from("activity_feed_events").select("*").eq("guild_id", env.guildId || "").or(
            ticketChannelId
              ? `ticket_id.eq.${ticketId},channel_id.eq.${ticketChannelId},target_user_id.eq.${ticketUserId}`
              : `ticket_id.eq.${ticketId},target_user_id.eq.${ticketUserId}`
          ).order("created_at", { ascending: false }).limit(100)
        : supabase.from("activity_feed_events").select("*").eq("guild_id", env.guildId || "").eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(100),
    ]);

    const member = mapGuildMember((safeArray<GuildMemberRow>(memberRowsRes.data || [])[0] || null) as GuildMemberRow | null);
    const messages = safeArray<TicketMessageRow>(messagesRes.data).map(mapTicketMessage);
    const notes = safeArray<TicketNoteRow>(notesRes.data).map(mapTicketNote);
    const joins = safeArray<JoinRow>(joinsRes.data).map(mapJoin);
    const verificationFlags = safeArray<VerificationFlagRow>(flagsRes.data).map(mapVerificationFlag);
    const verificationTokens = safeArray<VerificationTokenRow>(tokensRes.data).map(mapVerificationToken);
    const vcSessions = safeArray<VcSessionRow>(vcRes.data).map(mapVcSession);
    const warns = safeArray<WarnRow>(warnsRes.data).map(mapWarn);
    const activity = safeArray<ActivityFeedRow>(activityRes.data).map(mapActivityRow);

    const category =
      safeArray<TicketCategoryRow>(categoriesRes.data || []).find((row) => {
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
      id:
        typedSession?.user?.discord_id ||
        typedSession?.user?.id ||
        typedSession?.discordUser?.id ||
        "",
      username:
        typedSession?.user?.username ||
        typedSession?.discordUser?.username ||
        typedSession?.user?.name ||
        "Staff",
    };

    const workspace = {
      verificationLabel: deriveVerificationLabel({
        member,
        latestToken,
        latestVc,
        flaggedCount,
        ticket,
      }),
      riskLevel: deriveRiskLevel({
        ticket,
        member,
        flaggedCount,
        warnCount,
        maxFlagScore,
        noteCount,
      }),
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

    const transcriptPayload: TranscriptPayload = {
      ok: true,
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
      activity: activity.sort((a, b) => parseDateMs(a.created_at) - parseDateMs(b.created_at)),
      workspace,
      viewer,
      exportedAt: new Date().toISOString(),
    };

    const fileBase = transcriptFileName(ticket);

    if (format === "json") {
      const response = new NextResponse(JSON.stringify(transcriptPayload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.json"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
      applyAuthCookies(response, refreshedTokens);
      return response;
    }

    if (format === "txt" || format === "text") {
      const text = buildTextTranscript(transcriptPayload);
      const response = new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileBase}.txt"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
      applyAuthCookies(response, refreshedTokens);
      return response;
    }

    const html = buildHtmlTranscript(transcriptPayload);
    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.html"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    return buildJsonResponse(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    );
  }
}
