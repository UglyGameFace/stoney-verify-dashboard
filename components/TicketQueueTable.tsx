// ============================================================
// File: components/TicketQueueTable.tsx
// Purpose:
//   Simpler, cleaner ticket queue renderer with:
//   - stable category colors
//   - no meaningless "Unknown" chips
//   - Discord default avatar fallback
//   - much quieter mobile cards
//   - one consistent visual system for mobile + desktop
// ============================================================

"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { timeAgo } from "@/lib/format";
import TicketControls from "./dashboard/TicketControls";
import CreateTicketButton from "./dashboard/CreateTicketButton";

type TicketLike = {
  id?: string | null;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  title?: string | null;
  username?: string | null;
  display_name?: string | null;
  user_id?: string | null;

  category?: string | null;
  raw_category?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  matched_intake_type?: string | null;
  matched_category_reason?: string | null;

  status?: string | null;
  ticket_status?: string | null;
  priority?: string | null;

  claimed_by?: string | null;
  claimed_by_id?: string | null;
  claimed_by_name?: string | null;
  assigned_to?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;

  owner_display_name?: string | null;
  owner_avatar_url?: string | null;
  avatar_url?: string | null;

  owner_verification_label?: string | null;
  verification_label?: string | null;
  risk_level?: string | null;

  owner_entry_method?: string | null;
  owner_join_source?: string | null;
  owner_verification_source?: string | null;
  entry_method?: string | null;
  join_source?: string | null;
  source?: string | null;

  owner_invited_by_name?: string | null;
  owner_vouched_by_name?: string | null;
  owner_approved_by_name?: string | null;
  owner_role_state?: string | null;

  owner_ticket_total?: number | null;
  prior_ticket_total?: number | null;
  owner_warn_count?: number | null;
  owner_flag_count?: number | null;

  latest_activity_title?: string | null;
  latest_activity_type?: string | null;
  latest_activity_at?: string | null;
  latest_note_at?: string | null;
  latest_note_staff_name?: string | null;

  note_count?: number | null;

  mod_suggestion?: string | null;
  closed_reason?: string | null;

  updated_at?: string | null;
  created_at?: string | null;

  overdue?: boolean | null;
  minutes_overdue?: number | null;
  minutes_until_deadline?: number | null;
  sla_status?: string | null;

  is_ghost?: boolean | null;
  is_unclaimed?: boolean | null;
  is_claimed?: boolean | null;

  recommended_actions?: string[] | null;

  [key: string]: unknown;
};

type QueueMode =
  | ""
  | "queue"
  | "active"
  | "unclaimed"
  | "claimed"
  | "my_claimed"
  | "my-claimed"
  | "open_only"
  | "closed"
  | "deleted"
  | "all"
  | string;

type QueueRenderMode = "full" | "embedded";

type TicketQueueTableProps = {
  tickets?: TicketLike[];
  currentStaffId?: string | null;
  onRefresh?: () => Promise<void> | void;
  createTicketUserId?: string | number | null;
  createTicketTargetName?: string;
  queueMode?: QueueMode;
  renderMode?: QueueRenderMode;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function titleize(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function truncateText(value: unknown, max = 120): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function getDiscordDefaultAvatarUrl(userId: unknown): string {
  const raw = String(userId || "").trim();
  if (!raw || !/^\d+$/.test(raw)) return "";

  try {
    const index = Number((BigInt(raw) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "";
  }
}

function getOwnerName(ticket: TicketLike): string {
  return (
    String(ticket?.owner_display_name || "").trim() ||
    String(ticket?.display_name || "").trim() ||
    String(ticket?.username || "").trim() ||
    String(ticket?.user_id || "").trim() ||
    "Unknown User"
  );
}

function getOwnerAvatar(ticket: TicketLike): string {
  const explicit = String(ticket?.owner_avatar_url || ticket?.avatar_url || "").trim();
  if (explicit) return explicit;

  const fallback = getDiscordDefaultAvatarUrl(ticket?.user_id);
  if (fallback) return fallback;

  return "";
}

function getOwnerInitials(ticket: TicketLike): string {
  const source = getOwnerName(ticket);
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function getTicketTitle(ticket: TicketLike): string {
  return (
    String(ticket?.title || "").trim() ||
    String(ticket?.channel_name || "").trim() ||
    "Untitled Ticket"
  );
}

function getChannelId(ticket: TicketLike): string {
  return String(ticket?.channel_id || ticket?.discord_thread_id || "").trim();
}

function getStatus(ticket: TicketLike): string {
  return String(ticket?.status || ticket?.ticket_status || "unknown")
    .trim()
    .toLowerCase();
}

function getPriority(ticket: TicketLike): string {
  return String(ticket?.priority || "medium").trim().toLowerCase();
}

function hasMissingChannel(ticket: TicketLike): boolean {
  return !getChannelId(ticket);
}

function isGhost(ticket: TicketLike): boolean {
  return ticket?.is_ghost === true;
}

function getVisibleVerificationLabel(ticket: TicketLike): string {
  const value = normalizeText(
    ticket?.owner_verification_label || ticket?.verification_label || ""
  );

  if (!value) return "";
  if (value === "unknown") return "";
  if (value === "verification history") return "";

  if (value === "pending verification") return "Pending Verification";
  if (value === "needs review") return "Needs Review";
  if (value === "verified") return "Verified";
  if (value === "staff") return "Staff";
  if (value === "vc in progress") return "VC In Progress";
  if (value === "denied") return "Denied";

  return titleize(value);
}

function getVisibleRiskLabel(ticket: TicketLike): string {
  const value = normalizeText(ticket?.risk_level || "");
  if (value === "high") return "High Risk";
  if (value === "medium") return "Medium Risk";
  return "";
}

function getClaimedByLabel(ticket: TicketLike): string {
  return (
    String(ticket?.claimed_by_name || "").trim() ||
    String(ticket?.assigned_to_name || "").trim() ||
    String(ticket?.claimed_by || "").trim() ||
    String(ticket?.assigned_to || "").trim() ||
    "Unclaimed"
  );
}

function getClaimedById(ticket: TicketLike): string {
  return (
    String(ticket?.claimed_by_id || "").trim() ||
    String(ticket?.assigned_to_id || "").trim() ||
    String(ticket?.claimed_by || "").trim() ||
    String(ticket?.assigned_to || "").trim() ||
    ""
  );
}

function getDisplayedCategoryName(ticket: TicketLike): string {
  const candidates = [
    ticket?.matched_category_name,
    ticket?.matched_category_slug,
    ticket?.category,
    ticket?.raw_category,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (!normalized) continue;
    if (normalized === "unknown") continue;
    if (normalized === "uncategorized") continue;
    if (normalized === "none") continue;

    if (
      normalized === "verification_issue" ||
      normalized === "verification issue" ||
      normalized === "verify_issue"
    ) {
      return "Verification";
    }

    return titleize(candidate);
  }

  const title = normalizeText(ticket?.title || "");
  if (title.includes("verification")) return "Verification";
  if (title.includes("appeal")) return "Appeal";
  if (title.includes("report")) return "Report";
  if (title.includes("support")) return "Support";

  return "Support";
}

function getDisplayedIntakeType(ticket: TicketLike): string {
  const raw = normalizeText(ticket?.matched_intake_type || ticket?.category || "");
  if (!raw) return "";

  if (
    raw === "verification_issue" ||
    raw === "verification issue" ||
    raw === "verify_issue"
  ) {
    return "Verification";
  }

  return titleize(raw);
}

function getCategoryTone(ticket: TicketLike): string {
  const category = normalizeText(getDisplayedCategoryName(ticket));
  const intake = normalizeText(getDisplayedIntakeType(ticket));

  if (category.includes("verification") || intake === "verification") return "verification";
  if (category.includes("support") || intake === "support") return "support";
  if (category.includes("appeal") || intake === "appeal") return "appeal";
  if (category.includes("report") || intake === "report") return "report";
  if (category.includes("partnership") || intake === "partnership") return "partnership";
  if (category.includes("question") || intake === "question") return "question";

  return "default";
}

function getEntryMethodLabel(ticket: TicketLike): string {
  const raw =
    String(ticket?.owner_join_source || "").trim() ||
    String(ticket?.owner_entry_method || "").trim() ||
    String(ticket?.owner_verification_source || "").trim() ||
    String(ticket?.join_source || "").trim() ||
    String(ticket?.entry_method || "").trim() ||
    String(ticket?.source || "").trim() ||
    "";

  return raw ? titleize(raw) : "Unknown";
}

function getSlaStatusLabel(ticket: TicketLike): string {
  if (ticket?.overdue) {
    const minutes = Number(ticket?.minutes_overdue || 0);
    if (minutes > 0) return `${minutes}m overdue`;
    return "Overdue";
  }

  const minutesUntilDeadline = Number(ticket?.minutes_until_deadline);
  if (Number.isFinite(minutesUntilDeadline) && minutesUntilDeadline > 0) {
    return `${minutesUntilDeadline}m left`;
  }

  const status = String(ticket?.sla_status || "").trim();
  if (!status || status === "no_deadline") return "No SLA";
  if (status === "counting_down") return "Countdown";
  if (status === "closed") return "Closed";
  return titleize(status);
}

function getPastTicketCount(ticket: TicketLike): number {
  return Number(ticket?.owner_ticket_total || ticket?.prior_ticket_total || 0);
}

function getLatestActivityLabel(ticket: TicketLike): string {
  const title =
    String(ticket?.latest_activity_title || "").trim() ||
    String(ticket?.latest_activity_type || "").trim();

  if (!title) return "No recent activity";
  return titleize(title);
}

function getLatestActivityTime(ticket: TicketLike): string | null {
  return (
    (ticket?.latest_activity_at as string | null) ||
    (ticket?.updated_at as string | null) ||
    (ticket?.created_at as string | null) ||
    null
  );
}

function getQueueHeading(mode: QueueMode) {
  if (mode === "unclaimed") {
    return {
      title: "Unclaimed Ticket Queue",
      subtitle: "Tickets waiting for a staff member to claim and begin handling",
    };
  }

  if (mode === "claimed") {
    return {
      title: "Claimed Ticket Queue",
      subtitle: "Tickets currently assigned to staff and actively being worked",
    };
  }

  if (mode === "my_claimed" || mode === "my-claimed") {
    return {
      title: "My Claimed Tickets",
      subtitle: "Tickets currently assigned to the selected staff member",
    };
  }

  if (mode === "open_only") {
    return {
      title: "Open Ticket Queue",
      subtitle: "Showing only open tickets that still need staff action",
    };
  }

  if (mode === "closed") {
    return {
      title: "Closed Ticket History",
      subtitle: "Closed tickets remain visible here for audit trails and historical review",
    };
  }

  if (mode === "deleted") {
    return {
      title: "Deleted Ticket History",
      subtitle: "Deleted ticket records remain visible here for audit and historical review",
    };
  }

  if (mode === "all") {
    return {
      title: "Ticket History & Queue",
      subtitle: "Showing active and historical tickets together for review and auditing",
    };
  }

  return {
    title: "Active Ticket Queue",
    subtitle: "Live active tickets with assignment state, urgency, and next-action context",
  };
}

function countByStatus(tickets: TicketLike[], status: string): number {
  return tickets.filter(
    (ticket) => getStatus(ticket) === status
  ).length;
}

function countOverdue(tickets: TicketLike[]): number {
  return tickets.filter((ticket) => Boolean(ticket?.overdue)).length;
}

function getSummaryStats(tickets: TicketLike[]) {
  return {
    total: tickets.length,
    open: countByStatus(tickets, "open"),
    claimed: countByStatus(tickets, "claimed"),
    closed: countByStatus(tickets, "closed"),
    deleted: countByStatus(tickets, "deleted"),
    overdue: countOverdue(tickets),
  };
}

function getTicketRowKey(ticket: TicketLike, index = 0): string {
  return (
    String(ticket?.id || "").trim() ||
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim() ||
    [
      String(ticket?.user_id || "").trim(),
      String(ticket?.category || "").trim(),
      String(ticket?.status || ticket?.ticket_status || "").trim(),
      String(ticket?.created_at || "").trim(),
      String(index),
    ].join("::")
  );
}

function badgeClass(value: string): string {
  const normalized = normalizeText(value);

  if (normalized === "open") return "badge open";
  if (normalized === "claimed") return "badge claimed";
  if (normalized === "closed") return "badge closed";
  if (normalized === "deleted") return "badge closed";

  if (normalized === "low") return "badge low";
  if (normalized === "medium") return "badge medium";
  if (normalized === "high") return "badge danger";
  if (normalized === "urgent") return "badge danger";

  if (normalized === "pending verification") return "badge open";
  if (normalized === "needs review") return "badge danger";
  if (normalized === "verified") return "badge claimed";
  if (normalized === "staff") return "badge claimed";
  if (normalized === "denied") return "badge danger";
  if (normalized === "vc in progress") return "badge open";

  if (normalized === "high risk") return "badge danger";
  if (normalized === "medium risk") return "badge medium";

  return "badge";
}

function AvatarBubble({
  ticket,
  size = 42,
}: {
  ticket: TicketLike;
  size?: number;
}) {
  const avatar = getOwnerAvatar(ticket);
  const initials = getOwnerInitials(ticket);

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={getOwnerName(ticket)}
        className="queue-avatar"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="queue-avatar queue-avatar-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "open" | "claimed" | "danger";
}) {
  return (
    <div className={`queue-summary-chip ${tone}`}>
      <span className="queue-summary-chip-label">{label}</span>
      <span className="queue-summary-chip-value">{value}</span>
    </div>
  );
}

function CategoryChips({ ticket }: { ticket: TicketLike }) {
  const category = getDisplayedCategoryName(ticket);
  const intake = getDisplayedIntakeType(ticket);
  const tone = getCategoryTone(ticket);

  return (
    <div className="queue-chip-row">
      <span className={`queue-category-badge ${tone}`}>{category}</span>
      {intake && normalizeText(intake) !== normalizeText(category) ? (
        <span className="badge">{intake}</span>
      ) : null}
    </div>
  );
}

function CompactContextRow({ ticket }: { ticket: TicketLike }) {
  return (
    <div className="queue-context-row">
      <span className="queue-context-pill">Entry: {getEntryMethodLabel(ticket)}</span>
      <span className="queue-context-pill">SLA: {getSlaStatusLabel(ticket)}</span>
      <span className="queue-context-pill">Notes: {Number(ticket?.note_count || 0)}</span>
      <span className="queue-context-pill">Past Tickets: {getPastTicketCount(ticket)}</span>
    </div>
  );
}

function RecommendedActions({ ticket }: { ticket: TicketLike }) {
  const actions = Array.isArray(ticket?.recommended_actions)
    ? ticket.recommended_actions.filter(Boolean).slice(0, 4)
    : [];

  if (!actions.length) {
    return <div className="muted">No suggested next actions.</div>;
  }

  return (
    <div className="queue-actions-list">
      {actions.map((action) => (
        <div key={action} className="queue-action-chip">
          {action}
        </div>
      ))}
    </div>
  );
}

function TicketExpandedDetails({
  ticket,
  currentStaffId,
  onRefresh,
}: {
  ticket: TicketLike;
  currentStaffId?: string | null;
  onRefresh?: () => Promise<void> | void;
}) {
  return (
    <div className="ticket-expanded-shell">
      <div className="ticket-expanded-head">
        <div className="ticket-expanded-owner">
          <AvatarBubble ticket={ticket} size={52} />
          <div style={{ minWidth: 0 }}>
            <div className="ticket-expanded-owner-name">{getOwnerName(ticket)}</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              {getTicketTitle(ticket)}
            </div>
          </div>
        </div>

        <div className="queue-chip-row">
          <span className={badgeClass(getStatus(ticket))}>
            {safeText(ticket.status || ticket.ticket_status)}
          </span>
          <span className={badgeClass(getPriority(ticket))}>
            {safeText(ticket.priority)}
          </span>
          {getVisibleVerificationLabel(ticket) ? (
            <span className={badgeClass(getVisibleVerificationLabel(ticket))}>
              {getVisibleVerificationLabel(ticket)}
            </span>
          ) : null}
          {getVisibleRiskLabel(ticket) ? (
            <span className={badgeClass(getVisibleRiskLabel(ticket))}>
              {getVisibleRiskLabel(ticket)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="ticket-details-grid">
        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Category</div>
          <div>{getDisplayedCategoryName(ticket)}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Intake Type</div>
          <div>{getDisplayedIntakeType(ticket) || "—"}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Claimed By</div>
          <div>{getClaimedByLabel(ticket)}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Channel</div>
          <div>{getChannelId(ticket) || "Missing"}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">User ID</div>
          <div>{safeText(ticket.user_id)}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Latest Activity</div>
          <div>{`${getLatestActivityLabel(ticket)} • ${timeAgo(getLatestActivityTime(ticket))}`}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Invited By</div>
          <div>{safeText(ticket.owner_invited_by_name)}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Vouched By</div>
          <div>{safeText(ticket.owner_vouched_by_name)}</div>
        </div>

        <div className="ticket-detail-box">
          <div className="ticket-detail-label">Approved By</div>
          <div>{safeText(ticket.owner_approved_by_name)}</div>
        </div>

        <div className="ticket-detail-box full">
          <div className="ticket-detail-label">Role State</div>
          <div>{safeText(ticket.owner_role_state)}</div>
        </div>

        {!!ticket.mod_suggestion ? (
          <div className="ticket-detail-box full">
            <div className="ticket-detail-label">Suggestion</div>
            <div>{ticket.mod_suggestion}</div>
          </div>
        ) : null}

        {!!ticket.closed_reason ? (
          <div className="ticket-detail-box full">
            <div className="ticket-detail-label">Closed Reason</div>
            <div>{ticket.closed_reason}</div>
          </div>
        ) : null}
      </div>

      <div className="ticket-expanded-section">
        <div className="ticket-expanded-section-title">Recommended Actions</div>
        <RecommendedActions ticket={ticket} />
      </div>

      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div className="muted" style={{ fontSize: 12 }}>
          Full ticket view gives you the full conversation, reply flow, notes, and verification actions.
        </div>

        <Link
          className="button ghost"
          href={`/tickets/${ticket.id}`}
          style={{ width: "auto", minWidth: 150 }}
        >
          Open Full Ticket
        </Link>
      </div>

      <TicketControls
        ticket={ticket}
        currentStaffId={currentStaffId}
        onChanged={onRefresh}
      />
    </div>
  );
}

function MobileTicketCard({
  ticket,
  currentStaffId,
  onRefresh,
}: {
  ticket: TicketLike;
  currentStaffId?: string | null;
  onRefresh?: () => Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`ticket-mobile-card ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="ticket-mobile-toggle"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="ticket-card-top">
          <div className="ticket-card-owner">
            <AvatarBubble ticket={ticket} size={46} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="queue-chip-row" style={{ marginBottom: 8 }}>
                <span className={badgeClass(getStatus(ticket))}>
                  {safeText(ticket.status || ticket.ticket_status)}
                </span>
                <span className={badgeClass(getPriority(ticket))}>
                  {safeText(ticket.priority)}
                </span>
                {getVisibleVerificationLabel(ticket) ? (
                  <span className={badgeClass(getVisibleVerificationLabel(ticket))}>
                    {getVisibleVerificationLabel(ticket)}
                  </span>
                ) : null}
                {getVisibleRiskLabel(ticket) ? (
                  <span className={badgeClass(getVisibleRiskLabel(ticket))}>
                    {getVisibleRiskLabel(ticket)}
                  </span>
                ) : null}
                {ticket?.overdue ? <span className="badge danger">Overdue</span> : null}
                {ticket?.is_unclaimed ? <span className="badge open">Unclaimed</span> : null}
                {hasMissingChannel(ticket) ? (
                  <span className="badge danger">Missing Channel</span>
                ) : null}
              </div>

              <div className="ticket-owner-name">{getOwnerName(ticket)}</div>
              <div className="ticket-owner-subtitle">{getTicketTitle(ticket)}</div>
            </div>
          </div>

          <div className="ticket-card-time">
            {timeAgo(ticket.updated_at || ticket.created_at)}
          </div>
        </div>

        <CategoryChips ticket={ticket} />
        <CompactContextRow ticket={ticket} />

        <div className="ticket-card-footer">
          <span className="muted" style={{ fontSize: 12 }}>
            {expanded ? "Tap again to hide tools" : "Tap to open tools"}
          </span>

          <span className={`badge ${expanded ? "claimed" : "open"}`}>
            {expanded ? "Expanded" : "Quick View"}
          </span>
        </div>
      </button>

      {expanded ? (
        <>
          <div className="ticket-mobile-meta-grid">
            <div className="ticket-detail-box">
              <div className="ticket-detail-label">Category</div>
              <div>{getDisplayedCategoryName(ticket)}</div>
            </div>

            <div className="ticket-detail-box">
              <div className="ticket-detail-label">Intake Type</div>
              <div>{getDisplayedIntakeType(ticket) || "—"}</div>
            </div>

            <div className="ticket-detail-box">
              <div className="ticket-detail-label">Claimed By</div>
              <div>{getClaimedByLabel(ticket)}</div>
            </div>

            <div className="ticket-detail-box">
              <div className="ticket-detail-label">Entry</div>
              <div>{getEntryMethodLabel(ticket)}</div>
            </div>

            <div className="ticket-detail-box full">
              <div className="ticket-detail-label">Latest Activity</div>
              <div>{`${getLatestActivityLabel(ticket)} • ${timeAgo(getLatestActivityTime(ticket))}`}</div>
            </div>

            <div className="ticket-detail-box full">
              <div className="ticket-detail-label">Channel</div>
              <div>{getChannelId(ticket) || "Missing"}</div>
            </div>
          </div>

          <div className="ticket-expanded-section" style={{ marginTop: 12 }}>
            <div className="ticket-expanded-section-title">Recommended Actions</div>
            <RecommendedActions ticket={ticket} />
          </div>

          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Open the full ticket page for conversation history, notes, and verification actions.
            </div>

            <Link
              className="button ghost"
              href={`/tickets/${ticket.id}`}
              style={{ width: "auto", minWidth: 150 }}
            >
              Open Full Ticket
            </Link>
          </div>

          <TicketControls
            ticket={ticket}
            currentStaffId={currentStaffId}
            onChanged={onRefresh}
          />
        </>
      ) : null}
    </div>
  );
}

export default function TicketQueueTable({
  tickets = [],
  currentStaffId = null,
  onRefresh = async () => {},
  createTicketUserId = null,
  createTicketTargetName = "",
  queueMode = "",
  renderMode = "embedded",
}: TicketQueueTableProps) {
  const rows = Array.isArray(tickets) ? tickets : [];
  const isEmbedded = renderMode === "embedded";
  const heading = getQueueHeading(queueMode);
  const stats = useMemo(() => getSummaryStats(rows), [rows]);
  const [expandedDesktopId, setExpandedDesktopId] = useState<string | null>(null);

  return (
    <div className={isEmbedded ? "queue-shell embedded" : "card queue-shell"} id="tickets">
      {!isEmbedded ? (
        <>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>{heading.title}</h2>
              <div className="muted" style={{ marginTop: 6 }}>
                {heading.subtitle}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div className="muted" style={{ fontSize: 14 }}>
                {rows.length} ticket{rows.length === 1 ? "" : "s"}
              </div>

              {createTicketUserId ? (
                <CreateTicketButton
                  userId={String(createTicketUserId)}
                  currentStaffId={currentStaffId}
                  onCreated={onRefresh}
                  title={
                    createTicketTargetName
                      ? `Create Ticket for ${createTicketTargetName}`
                      : "Create Ticket"
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="queue-summary-grid" style={{ marginBottom: 14 }}>
            <SummaryChip label="Total" value={stats.total} />
            <SummaryChip label="Open" value={stats.open} tone="open" />
            <SummaryChip label="Claimed" value={stats.claimed} tone="claimed" />
            <SummaryChip label="Closed" value={stats.closed} />
            <SummaryChip label="Deleted" value={stats.deleted} />
            <SummaryChip label="Overdue" value={stats.overdue} tone={stats.overdue ? "danger" : "default"} />
          </div>
        </>
      ) : null}

      {!rows.length ? (
        <div className="empty-state">
          No tickets match the current search and filter settings.
        </div>
      ) : null}

      {!!rows.length ? (
        <>
          <div className="ticket-mobile-list">
            {rows.map((ticket, index) => (
              <MobileTicketCard
                key={getTicketRowKey(ticket, index)}
                ticket={ticket}
                currentStaffId={currentStaffId}
                onRefresh={onRefresh}
              />
            ))}
          </div>

          <div className="ticket-desktop-table">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((ticket, index) => {
                    const key = getTicketRowKey(ticket, index);
                    const isExpanded = expandedDesktopId === key;

                    return (
                      <React.Fragment key={key}>
                        <tr>
                          <td style={{ minWidth: 260 }}>
                            <div className="queue-desktop-owner">
                              <AvatarBubble ticket={ticket} size={42} />
                              <div style={{ minWidth: 0 }}>
                                <div className="ticket-owner-name">{getOwnerName(ticket)}</div>
                                <div className="ticket-owner-subtitle">
                                  {getTicketTitle(ticket)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ minWidth: 220 }}>
                            <CategoryChips ticket={ticket} />
                          </td>

                          <td style={{ minWidth: 220 }}>
                            <div className="queue-chip-row">
                              <span className={badgeClass(getStatus(ticket))}>
                                {safeText(ticket.status || ticket.ticket_status)}
                              </span>
                              <span className={badgeClass(getPriority(ticket))}>
                                {safeText(ticket.priority)}
                              </span>
                              {getVisibleVerificationLabel(ticket) ? (
                                <span className={badgeClass(getVisibleVerificationLabel(ticket))}>
                                  {getVisibleVerificationLabel(ticket)}
                                </span>
                              ) : null}
                              {getVisibleRiskLabel(ticket) ? (
                                <span className={badgeClass(getVisibleRiskLabel(ticket))}>
                                  {getVisibleRiskLabel(ticket)}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td>
                            <div>{timeAgo(ticket.updated_at || ticket.created_at)}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {truncateText(getLatestActivityLabel(ticket), 50)}
                            </div>
                          </td>

                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="button ghost"
                                style={{ width: "auto", minWidth: 118 }}
                                onClick={() =>
                                  setExpandedDesktopId((prev) => (prev === key ? null : key))
                                }
                              >
                                {isExpanded ? "Hide Tools" : "Open Tools"}
                              </button>

                              <Link
                                className="button ghost"
                                href={`/tickets/${ticket.id}`}
                                style={{ width: "auto", minWidth: 110 }}
                              >
                                Full Ticket
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr>
                            <td colSpan={5} style={{ padding: 0 }}>
                              <div className="ticket-desktop-expanded">
                                <TicketExpandedDetails
                                  ticket={ticket}
                                  currentStaffId={currentStaffId}
                                  onRefresh={onRefresh}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <style jsx global>{`
        .queue-shell {
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99, 213, 255, 0.06), transparent 22%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
          overflow: hidden;
        }

        .queue-shell.embedded {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          overflow: visible;
        }

        .queue-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .queue-summary-chip {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
          border-radius: 16px;
          padding: 12px;
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .queue-summary-chip.open {
          border-color: rgba(96, 165, 250, 0.2);
          background: rgba(96, 165, 250, 0.08);
        }

        .queue-summary-chip.claimed {
          border-color: rgba(74, 222, 128, 0.2);
          background: rgba(74, 222, 128, 0.08);
        }

        .queue-summary-chip.danger {
          border-color: rgba(248, 113, 113, 0.24);
          background: rgba(248, 113, 113, 0.08);
        }

        .queue-summary-chip-label {
          font-size: 12px;
          color: var(--muted, #9fb0c3);
          line-height: 1.1;
        }

        .queue-summary-chip-value {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-strong, #f8fafc);
          line-height: 1;
          overflow-wrap: anywhere;
        }

        .queue-avatar {
          border-radius: 999px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .queue-avatar-fallback {
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 13px;
          color: #f8fafc;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%),
            linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98));
        }

        .queue-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .queue-category-badge {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.1;
          border: 1px solid rgba(255,255,255,0.08);
          color: #f8fafc;
        }

        .queue-category-badge.verification {
          background: rgba(122, 92, 255, 0.16);
          border-color: rgba(122, 92, 255, 0.26);
        }

        .queue-category-badge.support {
          background: rgba(74, 222, 128, 0.14);
          border-color: rgba(74, 222, 128, 0.24);
        }

        .queue-category-badge.appeal {
          background: rgba(251, 191, 36, 0.14);
          border-color: rgba(251, 191, 36, 0.24);
        }

        .queue-category-badge.report {
          background: rgba(248, 113, 113, 0.14);
          border-color: rgba(248, 113, 113, 0.24);
        }

        .queue-category-badge.partnership {
          background: rgba(99, 213, 255, 0.14);
          border-color: rgba(99, 213, 255, 0.24);
        }

        .queue-category-badge.question {
          background: rgba(148, 163, 184, 0.14);
          border-color: rgba(148, 163, 184, 0.22);
        }

        .queue-category-badge.default {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
        }

        .queue-context-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .queue-context-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          font-size: 12px;
          color: var(--text, #dbe4ee);
        }

        .queue-actions-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .queue-action-chip {
          border-radius: 999px;
          padding: 7px 10px;
          border: 1px solid rgba(99,213,255,0.14);
          background: rgba(99,213,255,0.05);
          font-size: 12px;
          line-height: 1.2;
          color: var(--text, #dbe4ee);
        }

        .ticket-mobile-list {
          display: block;
        }

        .ticket-mobile-card {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          padding: 14px;
          margin-bottom: 12px;
          color: var(--text-strong, #f8fafc);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(17, 28, 39, 0.98), rgba(9, 16, 24, 0.98));
          box-shadow: 0 14px 30px rgba(0,0,0,0.22);
        }

        .ticket-mobile-card.expanded {
          border-color: rgba(99,213,255,0.14);
          box-shadow:
            0 16px 34px rgba(0,0,0,0.26),
            0 0 0 1px rgba(99,213,255,0.06) inset;
        }

        .ticket-mobile-toggle {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          display: block;
          width: 100%;
          background: transparent !important;
          border: 0 !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 0;
          margin: 0;
          text-align: left;
          color: inherit !important;
          cursor: pointer;
        }

        .ticket-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .ticket-card-owner {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          flex: 1;
          min-width: 0;
        }

        .ticket-owner-name {
          font-weight: 900;
          font-size: 16px;
          line-height: 1.12;
          color: var(--text-strong, #f8fafc);
          overflow-wrap: anywhere;
        }

        .ticket-owner-subtitle {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.35;
          color: var(--muted, #9fb0c3);
          overflow-wrap: anywhere;
        }

        .ticket-card-time {
          font-size: 12px;
          white-space: nowrap;
          color: var(--muted, #9fb0c3);
          flex-shrink: 0;
        }

        .ticket-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
        }

        .ticket-mobile-meta-grid,
        .ticket-details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .ticket-detail-box {
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.025);
          min-width: 0;
          color: var(--text, #dbe4ee);
        }

        .ticket-detail-box.full {
          grid-column: 1 / -1;
        }

        .ticket-detail-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .ticket-expanded-shell {
          display: grid;
          gap: 0;
        }

        .ticket-expanded-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .ticket-expanded-owner {
          display: flex;
          gap: 14px;
          align-items: center;
          min-width: 0;
          flex: 1;
        }

        .ticket-expanded-owner-name {
          font-size: 18px;
          font-weight: 900;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .ticket-expanded-section {
          margin-bottom: 14px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
        }

        .ticket-expanded-section-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
          margin-bottom: 10px;
        }

        .queue-desktop-owner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .ticket-desktop-table {
          display: none;
        }

        .ticket-desktop-expanded {
          padding: 16px;
          background: rgba(255,255,255,0.02);
        }

        @media (min-width: 768px) {
          .queue-summary-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }

        @media (max-width: 1023px) {
          .ticket-mobile-list {
            display: grid !important;
            gap: 14px;
          }

          .ticket-mobile-card {
            width: 100%;
            margin: 0;
          }

          .ticket-card-top {
            flex-direction: column;
            align-items: stretch;
          }

          .ticket-card-time {
            text-align: left;
          }

          .ticket-mobile-meta-grid,
          .ticket-details-grid {
            grid-template-columns: 1fr;
          }

          .table-wrap,
          table,
          thead,
          tbody,
          tr,
          td,
          th {
            background: transparent !important;
          }
        }

        @media (min-width: 1024px) {
          .ticket-mobile-list {
            display: none;
          }

          .ticket-desktop-table {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
