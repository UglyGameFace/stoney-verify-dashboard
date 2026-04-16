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
  category_id?: string | null;
  matched_category_id?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  matched_intake_type?: string | null;
  matched_category_reason?: string | null;
  matched_category_score?: number | null;
  category_override?: boolean | null;

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
  owner_verification_source?: string | null;
  entry_method?: string | null;
  source?: string | null;

  owner_invited_by_name?: string | null;
  owner_vouched_by_name?: string | null;
  owner_approved_by_name?: string | null;

  owner_ticket_total?: number | null;
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

type TicketQueueTableProps = {
  tickets?: TicketLike[];
  currentStaffId?: string | null;
  onRefresh?: () => Promise<void> | void;
  createTicketUserId?: string | number | null;
  createTicketTargetName?: string;
  queueMode?: QueueMode;
};

type SummaryChipProps = {
  label: string;
  value: string | number;
  tone?: "default" | "open" | "claimed" | "warn" | "danger";
};

type MetaBlockProps = {
  label: string;
  value: React.ReactNode;
  full?: boolean;
};

type MiniFieldProps = {
  label: string;
  value: React.ReactNode;
  full?: boolean;
};

type AvatarBubbleProps = {
  ticket: TicketLike;
  size?: number;
};

type CategoryDisplayProps = {
  ticket: TicketLike;
  compact?: boolean;
};

type TicketExpandedDetailsProps = {
  ticket: TicketLike;
  currentStaffId?: string | null;
  onRefresh?: () => Promise<void> | void;
};

type MobileTicketCardProps = {
  ticket: TicketLike;
  currentStaffId?: string | null;
  onRefresh?: () => Promise<void> | void;
};

const PLACEHOLDER_CATEGORY_VALUES = new Set([
  "",
  "uncategorized",
  "unknown",
  "none",
  "null",
  "undefined",
  "no-categories",
  "no categories",
  "general",
]);

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function truncateText(value: unknown, max = 120): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
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

function badgeClass(value: unknown): string {
  const v = String(value || "").toLowerCase().trim();

  if (v === "open") return "badge open";
  if (v === "closed") return "badge closed";
  if (v === "deleted") return "badge closed";
  if (v === "claimed") return "badge claimed";

  if (v === "low") return "badge low";
  if (v === "medium") return "badge medium";
  if (v === "high") return "badge danger";
  if (v === "urgent") return "badge danger";

  if (v === "verification") return "badge claimed";
  if (v === "appeal") return "badge medium";
  if (v === "report") return "badge danger";
  if (v === "partnership") return "badge low";
  if (v === "question") return "badge";
  if (v === "custom") return "badge";
  if (v === "support") return "badge low";
  if (v === "ghost") return "badge";

  if (v === "verified") return "badge claimed";
  if (v === "pending") return "badge open";
  if (v === "vc in progress") return "badge open";
  if (v === "needs review") return "badge danger";
  if (v === "denied") return "badge danger";
  if (v === "staff") return "badge claimed";
  if (v === "unknown") return "badge";

  if (v === "high risk") return "badge danger";
  if (v === "medium risk") return "badge medium";
  if (v === "low risk") return "badge low";

  if (v === "overdue") return "badge danger";
  if (v === "counting_down") return "badge medium";
  if (v === "closed_sla") return "badge closed";
  if (v === "no_deadline") return "badge";

  return "badge";
}

function getChannelId(ticket: TicketLike): string {
  return String(ticket?.channel_id || ticket?.discord_thread_id || "").trim();
}

function hasMissingChannel(ticket: TicketLike): boolean {
  return !getChannelId(ticket);
}

function isGhost(ticket: TicketLike): boolean {
  return ticket?.is_ghost === true;
}

function getStatus(ticket: TicketLike): string {
  return String(ticket?.status || ticket?.ticket_status || "unknown")
    .toLowerCase()
    .trim();
}

function getPriority(ticket: TicketLike): string {
  return String(ticket?.priority || "medium").toLowerCase().trim();
}

function isPlaceholderCategory(value: unknown): boolean {
  return PLACEHOLDER_CATEGORY_VALUES.has(normalizeText(value));
}

function normalizeIntakeType(value: unknown): string {
  const v = normalizeText(value);

  if (!v) return "";
  if (v === "verification_issue") return "verification";
  if (v === "verification issue") return "verification";
  if (v === "verify_issue") return "verification";
  if (v === "support") return "support";
  if (v === "general support") return "support";
  if (v === "report_issue") return "report";
  if (v === "report issue") return "report";

  return v;
}

function getDisplayIntakeLabel(value: unknown): string {
  const intake = normalizeIntakeType(value);
  return intake ? titleize(intake) : "";
}

function deriveFallbackCategoryFromTicket(ticket: TicketLike): string {
  const raw = [
    ticket?.category,
    ticket?.raw_category,
    ticket?.matched_category_slug,
    ticket?.matched_intake_type,
  ]
    .map((v) => normalizeText(v))
    .filter(Boolean);

  for (const value of raw) {
    if (isPlaceholderCategory(value)) continue;

    if (
      value === "verification_issue" ||
      value === "verification issue" ||
      value === "verify_issue" ||
      value === "verification"
    ) {
      return "Verification Issue";
    }

    if (value === "support" || value === "general support") {
      return "Support";
    }

    if (
      value === "report" ||
      value === "report_issue" ||
      value === "report issue"
    ) {
      return "Report";
    }

    if (value === "appeal") return "Appeal";
    if (value === "partnership") return "Partnership";
    if (value === "question") return "Question";
    if (value === "ghost") return "Ghost";

    return titleize(value);
  }

  const title = normalizeText(ticket?.title);
  if (title.includes("verification")) return "Verification Issue";
  if (title.includes("appeal")) return "Appeal";
  if (title.includes("report")) return "Report";
  if (title.includes("support")) return "Support";
  if (title.includes("partner")) return "Partnership";
  if (title.includes("question")) return "Question";
  if (title.includes("ghost")) return "Ghost";

  return "Support";
}

function getDisplayedCategoryName(ticket: TicketLike): string {
  const matchedName = String(ticket?.matched_category_name || "").trim();
  const matchedSlug = String(ticket?.matched_category_slug || "").trim();
  const rawCategory = String(ticket?.category || "").trim();
  const rawAlt = String(ticket?.raw_category || "").trim();

  if (matchedName && !isPlaceholderCategory(matchedName)) {
    return titleize(matchedName);
  }

  if (matchedSlug && !isPlaceholderCategory(matchedSlug)) {
    return titleize(matchedSlug);
  }

  if (rawCategory && !isPlaceholderCategory(rawCategory)) {
    return deriveFallbackCategoryFromTicket({ ...ticket, category: rawCategory });
  }

  if (rawAlt && !isPlaceholderCategory(rawAlt)) {
    return deriveFallbackCategoryFromTicket({ ...ticket, raw_category: rawAlt });
  }

  return deriveFallbackCategoryFromTicket(ticket);
}

function getDisplayedIntakeType(ticket: TicketLike): string {
  const intake = getDisplayIntakeLabel(
    ticket?.matched_intake_type || ticket?.category || ticket?.raw_category || ""
  );

  if (intake === "Verification Issue") return "Verification";
  return intake;
}

function getCategoryReason(ticket: TicketLike): string {
  const reason = String(ticket?.matched_category_reason || "").trim();
  if (!reason) return "";

  const lowered = normalizeText(reason);
  if (lowered === "no-categories") return "";
  if (lowered === "no categories") return "";

  return reason;
}

function getCategoryScore(ticket: TicketLike): number {
  const score = Number(ticket?.matched_category_score || 0);
  return Number.isFinite(score) ? score : 0;
}

function hasMatchedCategory(ticket: TicketLike): boolean {
  const matchedName = String(ticket?.matched_category_name || "").trim();
  const matchedSlug = String(ticket?.matched_category_slug || "").trim();

  return Boolean(
    (matchedName && !isPlaceholderCategory(matchedName)) ||
      (matchedSlug && !isPlaceholderCategory(matchedSlug))
  );
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
  const url = String(ticket?.owner_avatar_url || ticket?.avatar_url || "").trim();
  return url || "";
}

function getOwnerInitials(ticket: TicketLike): string {
  const source = getOwnerName(ticket);
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function getTicketTitle(ticket: TicketLike): string {
  return (
    String(ticket?.title || "").trim() ||
    String(ticket?.channel_name || "").trim() ||
    "Untitled Ticket"
  );
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

function getVerificationLabel(ticket: TicketLike): string {
  return (
    String(ticket?.owner_verification_label || "").trim() ||
    String(ticket?.verification_label || "").trim() ||
    "Unknown"
  );
}

function getRiskLevel(ticket: TicketLike): string {
  const level = normalizeText(ticket?.risk_level);
  if (level === "high") return "High Risk";
  if (level === "medium") return "Medium Risk";
  if (level === "low") return "Low Risk";
  return "Unknown";
}

function getEntryMethodLabel(ticket: TicketLike): string {
  const raw =
    String(ticket?.owner_entry_method || "").trim() ||
    String(ticket?.owner_verification_source || "").trim() ||
    String(ticket?.entry_method || "").trim() ||
    String(ticket?.source || "").trim() ||
    "";
  return raw ? titleize(raw) : "Unknown";
}

function getQueueIntel(ticket: TicketLike): string[] {
  const pieces: string[] = [];

  const inviter = String(ticket?.owner_invited_by_name || "").trim();
  const voucher = String(ticket?.owner_vouched_by_name || "").trim();
  const approver = String(ticket?.owner_approved_by_name || "").trim();

  if (inviter) pieces.push(`Invited by ${inviter}`);
  if (voucher) pieces.push(`Vouched by ${voucher}`);
  if (approver) pieces.push(`Approved by ${approver}`);

  if (ticket?.is_unclaimed) pieces.push("Waiting for claim");
  if (ticket?.is_claimed) pieces.push("Assigned to staff");

  return pieces;
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
  if (!status) return "No SLA";
  if (status === "counting_down") return "Countdown";
  if (status === "closed") return "Closed";
  if (status === "no_deadline") return "No SLA";

  return titleize(status);
}

function getRecommendedActions(ticket: TicketLike): string[] {
  if (Array.isArray(ticket?.recommended_actions)) {
    return ticket.recommended_actions.filter(Boolean);
  }

  const actions: string[] = [];

  if (ticket?.is_unclaimed) actions.push("Claim this ticket");
  if (normalizeText(ticket?.priority) === "urgent") actions.push("Handle urgently");
  if (ticket?.overdue) actions.push("Respond immediately");
  if (Number(ticket?.note_count || 0) <= 0) actions.push("Add staff notes");
  if (hasMissingChannel(ticket)) actions.push("Repair missing channel link");

  return actions;
}

function getLatestActivityLabel(ticket: TicketLike): string {
  const title =
    String(ticket?.latest_activity_title || "").trim() ||
    String(ticket?.latest_activity_type || "").trim();

  if (!title) return "No recent activity";
  return titleize(title);
}

function getLatestActivityTime(ticket: TicketLike): string | null {
  return (ticket?.latest_activity_at ||
    ticket?.updated_at ||
    ticket?.created_at ||
    null) as string | null;
}

function countByStatus(tickets: TicketLike[], status: string): number {
  return tickets.filter(
    (ticket) => String(ticket?.status || ticket?.ticket_status || "").toLowerCase() === status
  ).length;
}

function countByPriority(tickets: TicketLike[], priority: string): number {
  return tickets.filter(
    (ticket) => String(ticket?.priority || "").toLowerCase() === priority
  ).length;
}

function countMatchedCategories(tickets: TicketLike[]): number {
  return tickets.filter((ticket) => hasMatchedCategory(ticket)).length;
}

function countVerificationLike(tickets: TicketLike[]): number {
  return tickets.filter((ticket) => {
    const intake = getDisplayedIntakeType(ticket).toLowerCase();
    const category = getDisplayedCategoryName(ticket).toLowerCase();
    return intake === "verification" || category.includes("verification");
  }).length;
}

function countOverdue(tickets: TicketLike[]): number {
  return tickets.filter((ticket) => Boolean(ticket?.overdue)).length;
}

function countHighRisk(tickets: TicketLike[]): number {
  return tickets.filter(
    (ticket) => normalizeText(ticket?.risk_level) === "high"
  ).length;
}

function countUnassigned(tickets: TicketLike[]): number {
  return tickets.filter((ticket) => {
    if (ticket?.is_unclaimed === true) return true;
    const claimed = String(ticket?.claimed_by || "").trim();
    const assigned = String(ticket?.assigned_to || "").trim();
    const claimedById = String(ticket?.claimed_by_id ?? "").trim();
    return !claimed && !assigned && !claimedById;
  }).length;
}

function countNoNotes(tickets: TicketLike[]): number {
  return tickets.filter((ticket) => Number(ticket?.note_count || 0) <= 0).length;
}

function getSummaryStats(tickets: TicketLike[]) {
  return {
    total: tickets.length,
    open: countByStatus(tickets, "open"),
    claimed: countByStatus(tickets, "claimed"),
    closed: countByStatus(tickets, "closed"),
    deleted: countByStatus(tickets, "deleted"),
    urgent: countByPriority(tickets, "urgent"),
    high: countByPriority(tickets, "high"),
    missingChannel: tickets.filter((ticket) => hasMissingChannel(ticket)).length,
    ghosts: tickets.filter((ticket) => isGhost(ticket)).length,
    matched: countMatchedCategories(tickets),
    verificationLike: countVerificationLike(tickets),
    overdue: countOverdue(tickets),
    highRisk: countHighRisk(tickets),
    unassigned: countUnassigned(tickets),
    noNotes: countNoNotes(tickets),
  };
}

function getQueueHeading(tickets: TicketLike[], explicitMode: QueueMode) {
  const rows = Array.isArray(tickets) ? tickets : [];
  const statuses = [...new Set(rows.map((ticket) => getStatus(ticket)).filter(Boolean))];
  const activeOnly =
    statuses.length > 0 &&
    statuses.every((status) => status === "open" || status === "claimed");

  if (explicitMode === "queue" || explicitMode === "active" || (!explicitMode && activeOnly)) {
    return {
      title: "Active Ticket Queue",
      subtitle:
        "Live active tickets with assignment state, urgency, and next-action intelligence",
    };
  }

  if (explicitMode === "unclaimed") {
    return {
      title: "Unclaimed Ticket Queue",
      subtitle:
        "Tickets waiting for a staff member to claim and begin handling",
    };
  }

  if (explicitMode === "claimed") {
    return {
      title: "Claimed Ticket Queue",
      subtitle:
        "Tickets currently assigned to staff and actively being worked",
    };
  }

  if (explicitMode === "my_claimed" || explicitMode === "my-claimed") {
    return {
      title: "My Claimed Tickets",
      subtitle:
        "Tickets currently assigned to the selected staff member",
    };
  }

  if (explicitMode === "open_only") {
    return {
      title: "Open Ticket Queue",
      subtitle: "Showing only open tickets that still need staff action",
    };
  }

  if (explicitMode === "closed") {
    return {
      title: "Closed Ticket History",
      subtitle:
        "Closed tickets remain visible here for audit trails, reopen workflows, and historical review",
    };
  }

  if (explicitMode === "deleted") {
    return {
      title: "Deleted Ticket History",
      subtitle:
        "Deleted ticket records remain visible here for audit and historical review",
    };
  }

  if (explicitMode === "all") {
    return {
      title: "Ticket History & Queue",
      subtitle:
        "Showing active and historical tickets together for review, auditing, and reopen workflows",
    };
  }

  const label =
    statuses.length === 0
      ? "No ticket records"
      : statuses
          .map((status) => status.charAt(0).toUpperCase() + status.slice(1))
          .join(", ");

  return {
    title: "Filtered Ticket View",
    subtitle: `Showing the current filtered ticket set: ${label}`,
  };
}

function SummaryChip({ label, value, tone = "default" }: SummaryChipProps) {
  return (
    <div className={`queue-summary-chip ${tone}`}>
      <span className="queue-summary-chip-label">{label}</span>
      <span className="queue-summary-chip-value">{value}</span>
    </div>
  );
}

function MetaBlock({ label, value, full = false }: MetaBlockProps) {
  return (
    <div className={`ticket-mobile-meta-item ${full ? "full" : ""}`}>
      <span className="ticket-mobile-meta-label">{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function MiniField({ label, value, full = false }: MiniFieldProps) {
  return (
    <div className={`ticket-info-item ${full ? "full" : ""}`}>
      <span className="ticket-info-label">{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function AvatarBubble({ ticket, size = 42 }: AvatarBubbleProps) {
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

function CategoryDisplay({ ticket, compact = false }: CategoryDisplayProps) {
  const categoryName = getDisplayedCategoryName(ticket);
  const intakeType = getDisplayedIntakeType(ticket);
  const reason = getCategoryReason(ticket);
  const score = getCategoryScore(ticket);
  const matched = hasMatchedCategory(ticket);

  const normalizedCategory = normalizeText(categoryName);
  const normalizedIntake = normalizeText(intakeType);
  const normalizedCategoryWithoutIssue = normalizeText(
    categoryName.replace(/\s+issue$/i, "")
  );

  const showIntakeChip =
    Boolean(intakeType) &&
    normalizedIntake !== normalizedCategory &&
    normalizedIntake !== normalizedCategoryWithoutIssue;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span className={matched ? "badge claimed" : "badge low"}>
          {categoryName}
        </span>

        {showIntakeChip ? (
          <span className={badgeClass(intakeType.toLowerCase())}>
            {intakeType}
          </span>
        ) : null}
      </div>

      {reason ? (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          {compact ? reason : `Match: ${reason}`}
          {score > 0 ? ` • score ${score}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function TicketHeaderBadges({ ticket }: { ticket: TicketLike }) {
  const status = getStatus(ticket);
  const missingChannel = hasMissingChannel(ticket);
  const ghost = isGhost(ticket);
  const verification = getVerificationLabel(ticket);
  const risk = getRiskLevel(ticket);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span className={badgeClass(status)}>{safeText(ticket.status || ticket.ticket_status)}</span>
      <span className={badgeClass(ticket.priority)}>
        {safeText(ticket.priority)}
      </span>
      <span className={badgeClass(verification)}>{verification}</span>
      <span className={badgeClass(risk.toLowerCase())}>{risk}</span>
      {ticket?.is_unclaimed ? <span className="badge open">Unclaimed</span> : null}
      {ticket?.is_claimed ? <span className="badge claimed">Claimed</span> : null}
      {ticket?.overdue ? <span className="badge danger">Overdue</span> : null}
      {ghost ? <span className="badge">Ghost</span> : null}
      {missingChannel ? <span className="badge danger">Missing Channel</span> : null}
    </div>
  );
}

function QueueIntelStrip({ ticket }: { ticket: TicketLike }) {
  const intel = getQueueIntel(ticket);
  const noteCount = Number(ticket?.note_count || 0);
  const priorTotal = Number(ticket?.owner_ticket_total || 0);
  const warnCount = Number(ticket?.owner_warn_count || 0);
  const flagCount = Number(ticket?.owner_flag_count || 0);

  return (
    <div className="queue-intel-strip">
      <span className="queue-intel-pill">Entry: {getEntryMethodLabel(ticket)}</span>
      <span className="queue-intel-pill">SLA: {getSlaStatusLabel(ticket)}</span>
      <span className="queue-intel-pill">Notes: {noteCount}</span>
      <span className="queue-intel-pill">Past Tickets: {priorTotal}</span>
      {warnCount > 0 ? (
        <span className="queue-intel-pill danger">Warns: {warnCount}</span>
      ) : null}
      {flagCount > 0 ? (
        <span className="queue-intel-pill danger">Flags: {flagCount}</span>
      ) : null}
      {intel.map((line) => (
        <span key={line} className="queue-intel-pill">
          {line}
        </span>
      ))}
    </div>
  );
}

function RecommendedActions({ ticket }: { ticket: TicketLike }) {
  const actions = getRecommendedActions(ticket);

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

function getTicketRowKey(ticket: TicketLike, index = 0): string {
  return (
    String(ticket?.id || "").trim() ||
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim() ||
    [
      String(ticket?.user_id || "").trim(),
      String(ticket?.category_id || "").trim(),
      String(ticket?.matched_category_id || "").trim(),
      String(ticket?.category || "").trim(),
      String(ticket?.status || ticket?.ticket_status || "").trim(),
      String(ticket?.created_at || "").trim(),
      String(index),
    ].join("::")
  );
}

function TicketExpandedDetails({
  ticket,
  currentStaffId,
  onRefresh,
}: TicketExpandedDetailsProps) {
  const channelId = getChannelId(ticket);
  const ghost = isGhost(ticket);

  return (
    <div className="ticket-expanded-shell">
      <div className="ticket-expanded-topbar">
        <div className="ticket-expanded-owner">
          <AvatarBubble ticket={ticket} size={54} />
          <div style={{ minWidth: 0 }}>
            <div className="ticket-expanded-owner-name">{getOwnerName(ticket)}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {getTicketTitle(ticket)}
            </div>
          </div>
        </div>

        <div className="ticket-expanded-badges">
          <TicketHeaderBadges ticket={ticket} />
        </div>
      </div>

      <QueueIntelStrip ticket={ticket} />

      <div className="ticket-info-grid" style={{ marginBottom: 14 }}>
        <MiniField label="Category" value={getDisplayedCategoryName(ticket)} />
        <MiniField
          label="Intake Type"
          value={getDisplayedIntakeType(ticket) || "—"}
        />
        <MiniField label="Verification" value={getVerificationLabel(ticket)} />
        <MiniField label="Risk" value={getRiskLevel(ticket)} />
        <MiniField label="Claimed By" value={getClaimedByLabel(ticket)} />
        <MiniField label="Entry Method" value={getEntryMethodLabel(ticket)} />
        <MiniField label="Channel ID" value={channelId || "Missing"} />
        <MiniField label="User ID" value={safeText(ticket.user_id)} />
        <MiniField
          label="Latest Activity"
          value={`${getLatestActivityLabel(ticket)} • ${timeAgo(getLatestActivityTime(ticket))}`}
          full
        />
        <MiniField
          label="SLA"
          value={getSlaStatusLabel(ticket)}
        />
        <MiniField
          label="Notes"
          value={String(Number(ticket?.note_count || 0))}
        />
        <MiniField
          label="Past Tickets"
          value={String(Number(ticket?.owner_ticket_total || 0))}
        />
        <MiniField label="Ghost" value={ghost ? "yes" : "no"} />
        <MiniField
          label="Updated"
          value={timeAgo(ticket.updated_at || ticket.created_at)}
        />
        <MiniField
          label="Queue State"
          value={
            ticket?.is_unclaimed
              ? "Unclaimed"
              : ticket?.is_claimed
                ? "Claimed"
                : safeText(ticket.status || ticket.ticket_status)
          }
        />
        <MiniField
          label="Invited By"
          value={safeText(ticket?.owner_invited_by_name)}
        />
        <MiniField
          label="Vouched By"
          value={safeText(ticket?.owner_vouched_by_name)}
        />
        <MiniField
          label="Approved By"
          value={safeText(ticket?.owner_approved_by_name)}
        />
        <MiniField
          label="Role State"
          value={safeText(ticket?.owner_role_state)}
          full
        />
        <MiniField
          label="Match Reason"
          value={getCategoryReason(ticket) || "—"}
          full
        />
        {!!ticket.mod_suggestion ? (
          <MiniField label="Suggestion" value={ticket.mod_suggestion} full />
        ) : null}
        {!!ticket.closed_reason ? (
          <MiniField label="Closed Reason" value={ticket.closed_reason} full />
        ) : null}
        {!!ticket.latest_note_staff_name || !!ticket.latest_note_at ? (
          <MiniField
            label="Latest Note"
            value={`${safeText(ticket.latest_note_staff_name)} • ${timeAgo(ticket.latest_note_at)}`}
            full
          />
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
          Full ticket view gives you the full conversation, reply flow, notes,
          transcript links, and verification actions.
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
}: MobileTicketCardProps) {
  const [expanded, setExpanded] = useState(false);
  const channelId = getChannelId(ticket);

  return (
    <div
      className={`ticket-mobile-card premium ${expanded ? "expanded" : ""}`}
      style={{
        border: hasMissingChannel(ticket)
          ? "1px solid rgba(248,113,113,0.28)"
          : undefined,
      }}
    >
      <button
        type="button"
        className="ticket-mobile-toggle"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="queue-card-topline">
          <div className="queue-card-owner-wrap">
            <AvatarBubble ticket={ticket} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ marginBottom: 8 }}>
                <TicketHeaderBadges ticket={ticket} />
              </div>

              <div className="queue-ticket-name">{getOwnerName(ticket)}</div>

              <div className="muted queue-ticket-subtitle">
                {getTicketTitle(ticket)}
              </div>
            </div>
          </div>

          <div className="muted queue-ticket-time">
            {timeAgo(ticket.updated_at || ticket.created_at)}
          </div>
        </div>

        <div className="queue-category-wrap">
          <CategoryDisplay ticket={ticket} compact />
        </div>

        <QueueIntelStrip ticket={ticket} />

        <div className="queue-card-footer-row">
          <div className="muted" style={{ fontSize: 12 }}>
            {expanded ? "Hide tools" : "Open tools"}
          </div>
          <div className={`badge ${expanded ? "claimed" : "open"}`}>
            {expanded ? "Expanded" : "Quick View"}
          </div>
        </div>
      </button>

      {expanded ? (
        <>
          <div className="ticket-mobile-meta" style={{ marginTop: 12 }}>
            <MetaBlock label="Category" value={getDisplayedCategoryName(ticket)} />
            <MetaBlock
              label="Intake Type"
              value={getDisplayedIntakeType(ticket) || "—"}
            />
            <MetaBlock label="Verification" value={getVerificationLabel(ticket)} />
            <MetaBlock label="Risk" value={getRiskLevel(ticket)} />
            <MetaBlock label="Claimed By" value={getClaimedByLabel(ticket)} />
            <MetaBlock label="Entry" value={getEntryMethodLabel(ticket)} />
            <MetaBlock label="Channel" value={channelId || "Missing"} full />
            <MetaBlock label="User ID" value={safeText(ticket.user_id)} full />
            <MetaBlock
              label="Latest Activity"
              value={`${getLatestActivityLabel(ticket)} • ${timeAgo(getLatestActivityTime(ticket))}`}
              full
            />
            <MetaBlock
              label="SLA"
              value={getSlaStatusLabel(ticket)}
            />
            <MetaBlock
              label="Notes"
              value={String(Number(ticket?.note_count || 0))}
            />
            <MetaBlock
              label="Past Tickets"
              value={String(Number(ticket?.owner_ticket_total || 0))}
            />
            <MetaBlock
              label="Queue State"
              value={
                ticket?.is_unclaimed
                  ? "Unclaimed"
                  : ticket?.is_claimed
                    ? "Claimed"
                    : safeText(ticket.status || ticket.ticket_status)
              }
            />
            <MetaBlock
              label="Invited By"
              value={safeText(ticket?.owner_invited_by_name)}
            />
            <MetaBlock
              label="Vouched By"
              value={safeText(ticket?.owner_vouched_by_name)}
            />
            <MetaBlock
              label="Approved By"
              value={safeText(ticket?.owner_approved_by_name)}
            />
            <MetaBlock
              label="Match Reason"
              value={getCategoryReason(ticket) || "—"}
              full
            />
            {!!ticket.mod_suggestion ? (
              <MetaBlock label="Suggestion" value={ticket.mod_suggestion} full />
            ) : null}
            {!!ticket.closed_reason ? (
              <MetaBlock label="Closed Reason" value={ticket.closed_reason} full />
            ) : null}
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
              Full ticket page gives you full conversation, reply flow, notes,
              and verification actions.
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
}: TicketQueueTableProps) {
  const normalizedTickets = Array.isArray(tickets) ? tickets : [];
  const stats = useMemo(() => getSummaryStats(normalizedTickets), [normalizedTickets]);
  const heading = useMemo(
    () => getQueueHeading(normalizedTickets, queueMode),
    [normalizedTickets, queueMode]
  );
  const [expandedDesktopId, setExpandedDesktopId] = useState<string | null>(null);

  function toggleDesktopTicket(ticketId: string) {
    setExpandedDesktopId((prev) => (prev === ticketId ? null : ticketId));
  }

  return (
    <div className="card queue-shell" id="tickets">
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
            {normalizedTickets.length} ticket{normalizedTickets.length === 1 ? "" : "s"}
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
        <SummaryChip label="Urgent" value={stats.urgent} tone="danger" />
        <SummaryChip label="High" value={stats.high} tone="warn" />
        <SummaryChip label="Overdue" value={stats.overdue} tone={stats.overdue ? "danger" : "default"} />
        <SummaryChip label="High Risk" value={stats.highRisk} tone={stats.highRisk ? "danger" : "default"} />
        <SummaryChip label="Unassigned" value={stats.unassigned} tone={stats.unassigned ? "warn" : "default"} />
        <SummaryChip
          label="Matched"
          value={stats.matched}
          tone={stats.matched ? "claimed" : "default"}
        />
        <SummaryChip
          label="Verification"
          value={stats.verificationLike}
          tone={stats.verificationLike ? "open" : "default"}
        />
        <SummaryChip
          label="No Notes"
          value={stats.noNotes}
          tone={stats.noNotes ? "warn" : "default"}
        />
        <SummaryChip
          label="Missing Channel"
          value={stats.missingChannel}
          tone={stats.missingChannel ? "danger" : "default"}
        />
        <SummaryChip
          label="Ghost"
          value={stats.ghosts}
          tone={stats.ghosts ? "warn" : "default"}
        />
      </div>

      {!normalizedTickets.length ? (
        <div className="empty-state">
          No tickets match the current filters.
        </div>
      ) : null}

      {!!normalizedTickets.length ? (
        <>
          <div className="ticket-mobile-list queue-mobile-stack">
            {normalizedTickets.map((ticket, index) => (
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
                    <th>Queue Intelligence</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {normalizedTickets.map((ticket, index) => {
                    const ticketKey = getTicketRowKey(ticket, index);
                    const channelId = getChannelId(ticket);
                    const status = getStatus(ticket);
                    const missingChannel = hasMissingChannel(ticket);
                    const isExpanded = expandedDesktopId === ticketKey;

                    return (
                      <React.Fragment key={ticketKey}>
                        <tr
                          style={
                            missingChannel
                              ? { background: "rgba(248,113,113,0.04)" }
                              : undefined
                          }
                        >
                          <td style={{ minWidth: 260 }}>
                            <div className="queue-desktop-owner">
                              <AvatarBubble ticket={ticket} size={42} />
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    marginBottom: 6,
                                    alignItems: "center",
                                  }}
                                >
                                  <span className={badgeClass(status)}>
                                    {safeText(ticket.status || ticket.ticket_status)}
                                  </span>
                                  <span className={badgeClass(ticket.priority)}>
                                    {safeText(ticket.priority)}
                                  </span>
                                  <span className={badgeClass(getVerificationLabel(ticket))}>
                                    {getVerificationLabel(ticket)}
                                  </span>
                                  <span className={badgeClass(getRiskLevel(ticket).toLowerCase())}>
                                    {getRiskLevel(ticket)}
                                  </span>
                                  {ticket?.is_unclaimed ? (
                                    <span className="badge open">Unclaimed</span>
                                  ) : null}
                                  {ticket?.is_claimed ? (
                                    <span className="badge claimed">Claimed</span>
                                  ) : null}
                                  {ticket?.overdue ? (
                                    <span className="badge danger">Overdue</span>
                                  ) : null}
                                  {isGhost(ticket) ? <span className="badge">Ghost</span> : null}
                                  {missingChannel ? (
                                    <span className="badge danger">Missing Channel</span>
                                  ) : null}
                                </div>

                                <div className="queue-owner-name">
                                  {getOwnerName(ticket)}
                                </div>

                                <div className="muted queue-ticket-subtitle">
                                  {getTicketTitle(ticket)}
                                </div>

                                <div className="queue-submeta">
                                  <span>Entry: {getEntryMethodLabel(ticket)}</span>
                                  <span>Past Tickets: {Number(ticket?.owner_ticket_total || 0)}</span>
                                  <span>User ID: {safeText(ticket.user_id)}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                            <CategoryDisplay ticket={ticket} />
                          </td>

                          <td style={{ minWidth: 260 }}>
                            <div className="queue-intel-cell">
                              <div className="queue-intel-row">
                                <span className="queue-inline-pill">
                                  SLA: {getSlaStatusLabel(ticket)}
                                </span>
                                <span className="queue-inline-pill">
                                  Notes: {Number(ticket?.note_count || 0)}
                                </span>
                                <span className="queue-inline-pill">
                                  Activity: {timeAgo(getLatestActivityTime(ticket))}
                                </span>
                              </div>

                              <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
                                {truncateText(getLatestActivityLabel(ticket), 120)}
                              </div>

                              <div className="queue-actions-list" style={{ marginTop: 8 }}>
                                {getRecommendedActions(ticket).slice(0, 2).map((action) => (
                                  <div key={action} className="queue-action-chip compact">
                                    {action}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="queue-status-stack">
                              <span className={badgeClass(status)}>
                                {safeText(ticket.status || ticket.ticket_status)}
                              </span>
                              <span className={badgeClass(ticket.priority)}>
                                {safeText(ticket.priority)}
                              </span>
                            </div>
                          </td>

                          <td style={{ whiteSpace: "normal", minWidth: 150 }}>
                            <div style={{ fontWeight: 700 }}>
                              {getClaimedByLabel(ticket)}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {channelId || "Missing channel"}
                            </div>
                          </td>

                          <td>
                            <div>{timeAgo(ticket.updated_at || ticket.created_at)}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {ticket?.latest_note_at
                                ? `Note ${timeAgo(ticket.latest_note_at)}`
                                : "No notes yet"}
                            </div>
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <button
                                type="button"
                                className="button ghost"
                                style={{ width: "auto", minWidth: 118 }}
                                onClick={() => toggleDesktopTicket(ticketKey)}
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
                            <td
                              colSpan={7}
                              style={{
                                whiteSpace: "normal",
                                padding: 0,
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
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

      <style jsx>{`
        .queue-shell {
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 26%),
            radial-gradient(circle at bottom left, rgba(99, 213, 255, 0.06), transparent 22%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
          overflow: hidden;
        }

        .queue-mobile-stack {
          display: grid;
          gap: 12px;
        }

        .queue-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .queue-summary-chip {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 45%),
            rgba(255, 255, 255, 0.025);
          border-radius: 16px;
          padding: 12px;
          display: grid;
          gap: 6px;
          min-width: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }

        .queue-summary-chip.open {
          border-color: rgba(96, 165, 250, 0.2);
          background:
            radial-gradient(circle at top right, rgba(96,165,250,0.12), transparent 48%),
            rgba(96, 165, 250, 0.08);
        }

        .queue-summary-chip.claimed {
          border-color: rgba(74, 222, 128, 0.2);
          background:
            radial-gradient(circle at top right, rgba(74,222,128,0.12), transparent 48%),
            rgba(74, 222, 128, 0.08);
        }

        .queue-summary-chip.warn {
          border-color: rgba(251, 191, 36, 0.2);
          background:
            radial-gradient(circle at top right, rgba(251,191,36,0.12), transparent 48%),
            rgba(251, 191, 36, 0.08);
        }

        .queue-summary-chip.danger {
          border-color: rgba(248, 113, 113, 0.24);
          background:
            radial-gradient(circle at top right, rgba(248,113,113,0.12), transparent 48%),
            rgba(248, 113, 113, 0.08);
        }

        .queue-summary-chip-label {
          font-size: 12px;
          color: var(--muted);
        }

        .queue-summary-chip-value {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-strong);
          line-height: 1;
          overflow-wrap: anywhere;
        }

        .queue-avatar {
          border-radius: 999px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 8px 18px rgba(0,0,0,0.2);
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

        .queue-desktop-owner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .queue-owner-name {
          font-weight: 900;
          font-size: 15px;
          line-height: 1.15;
          overflow-wrap: anywhere;
          color: var(--text-strong, #f8fafc);
        }

        .queue-submeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 6px;
          font-size: 12px;
          color: var(--muted, #9fb0c3);
        }

        .queue-intel-cell {
          display: grid;
          gap: 8px;
        }

        .queue-intel-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .queue-inline-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.035);
          font-size: 12px;
          color: var(--text, #dbe4ee);
        }

        .queue-intel-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        .queue-intel-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.05), transparent 42%),
            rgba(255,255,255,0.025);
          font-size: 12px;
          color: var(--text, #dbe4ee);
          overflow-wrap: anywhere;
        }

        .queue-intel-pill.danger {
          border-color: rgba(248,113,113,0.22);
          background:
            radial-gradient(circle at top right, rgba(248,113,113,0.1), transparent 42%),
            rgba(248,113,113,0.06);
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
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.10), transparent 42%),
            rgba(99,213,255,0.05);
          font-size: 12px;
          line-height: 1.2;
          color: var(--text, #dbe4ee);
        }

        .queue-action-chip.compact {
          padding: 5px 8px;
          font-size: 11px;
        }

        .queue-status-stack {
          display: grid;
          gap: 8px;
          justify-items: start;
        }

        .ticket-mobile-card.premium {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: 22px;
          padding: 14px;
          color: var(--text-strong, #f8fafc) !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 36%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(17, 28, 39, 0.98), rgba(9, 16, 24, 0.98)) !important;
          box-shadow:
            0 14px 30px rgba(0,0,0,0.24),
            0 0 0 1px rgba(255,255,255,0.02) inset;
          -webkit-tap-highlight-color: transparent;
        }

        .ticket-mobile-card.premium,
        .ticket-mobile-card.premium * {
          color: inherit;
        }

        .ticket-mobile-card.premium::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.04),
            rgba(255,255,255,0)
          );
          z-index: 0;
        }

        .ticket-mobile-card.premium > * {
          position: relative;
          z-index: 1;
        }

        .ticket-mobile-card.premium :global(.card),
        .ticket-mobile-card.premium :global(table),
        .ticket-mobile-card.premium :global(thead),
        .ticket-mobile-card.premium :global(tbody),
        .ticket-mobile-card.premium :global(tr),
        .ticket-mobile-card.premium :global(td),
        .ticket-mobile-card.premium :global(th),
        .ticket-mobile-card.premium :global(button),
        .ticket-mobile-card.premium :global(a) {
          background-color: transparent !important;
          box-shadow: none;
        }

        .ticket-mobile-card.expanded {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.1), transparent 38%),
            radial-gradient(circle at bottom left, rgba(93,255,141,0.08), transparent 28%),
            linear-gradient(180deg, rgba(19, 33, 46, 0.99), rgba(10, 17, 26, 0.99)) !important;
          box-shadow:
            0 16px 34px rgba(0,0,0,0.28),
            0 0 0 1px rgba(99,213,255,0.08) inset;
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

        .queue-card-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .queue-card-owner-wrap {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          flex: 1;
          min-width: 0;
        }

        .queue-ticket-name {
          font-weight: 900;
          font-size: 16px;
          overflow-wrap: anywhere;
          line-height: 1.12;
          color: var(--text-strong, #f8fafc);
          letter-spacing: -0.02em;
        }

        .queue-ticket-subtitle {
          margin-top: 6px;
          font-size: 13px;
          overflow-wrap: anywhere;
          line-height: 1.35;
          color: var(--muted, #9fb0c3);
        }

        .queue-ticket-time {
          font-size: 12px;
          white-space: nowrap;
          flex-shrink: 0;
          text-align: right;
          color: var(--muted, #9fb0c3);
        }

        .queue-category-wrap {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02) !important;
        }

        .queue-card-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
        }

        .ticket-mobile-meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .ticket-mobile-meta-item {
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.025) !important;
          min-width: 0;
          color: var(--text, #dbe4ee) !important;
        }

        .ticket-mobile-meta-item.full {
          grid-column: 1 / -1;
        }

        .ticket-mobile-meta-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3) !important;
        }

        .ticket-desktop-expanded {
          padding: 16px;
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.06), transparent 38%),
            rgba(255,255,255,0.02);
        }

        .ticket-expanded-shell {
          display: grid;
          gap: 0;
        }

        .ticket-expanded-topbar {
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

        .ticket-expanded-badges {
          display: flex;
          justify-content: flex-end;
          max-width: 100%;
        }

        .ticket-expanded-section {
          margin-bottom: 14px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .ticket-expanded-section-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
          margin-bottom: 10px;
        }

        .ticket-mobile-list {
          display: block;
        }

        .ticket-desktop-table {
          display: none;
        }

        @media (min-width: 768px) {
          .queue-summary-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
        }

        @media (max-width: 1023px) {
          .ticket-mobile-list {
            display: grid !important;
            gap: 14px;
          }

          .ticket-mobile-card.premium {
            width: 100%;
            margin: 0;
          }

          .queue-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ticket-mobile-meta {
            grid-template-columns: 1fr;
          }

          .queue-card-topline {
            flex-direction: column;
            align-items: stretch;
          }

          .queue-ticket-time {
            text-align: left;
          }

          :global(.table-wrap),
          :global(table),
          :global(thead),
          :global(tbody),
          :global(tr),
          :global(td),
          :global(th) {
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

        @media (min-width: 1280px) {
          .queue-summary-grid {
            grid-template-columns: repeat(15, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
