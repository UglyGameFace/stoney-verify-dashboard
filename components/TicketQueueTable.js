"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { timeAgo } from "@/lib/format";
import TicketControls from "./dashboard/TicketControls";
import CreateTicketButton from "./dashboard/CreateTicketButton";

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

function badgeClass(value) {
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

  return "badge";
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function titleize(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getChannelId(ticket) {
  return String(ticket?.channel_id || ticket?.discord_thread_id || "").trim();
}

function getTicketUserLabel(ticket) {
  return (
    String(ticket?.username || "").trim() ||
    String(ticket?.user_id || "").trim() ||
    "Unknown User"
  );
}

function getTicketTitle(ticket) {
  return (
    String(ticket?.title || "").trim() ||
    String(ticket?.channel_name || "").trim() ||
    "Untitled Ticket"
  );
}

function getStatus(ticket) {
  return String(ticket?.status || "unknown").toLowerCase().trim();
}

function isGhost(ticket) {
  return ticket?.is_ghost === true;
}

function hasMissingChannel(ticket) {
  return !getChannelId(ticket);
}

function isPlaceholderCategory(value) {
  return PLACEHOLDER_CATEGORY_VALUES.has(normalizeText(value));
}

function normalizeIntakeType(value) {
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

function getDisplayIntakeLabel(value) {
  const intake = normalizeIntakeType(value);
  return intake ? titleize(intake) : "";
}

function deriveFallbackCategoryFromTicket(ticket) {
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

    return titleize(value);
  }

  const title = normalizeText(ticket?.title);
  if (title.includes("verification")) return "Verification Issue";
  if (title.includes("appeal")) return "Appeal";
  if (title.includes("report")) return "Report";
  if (title.includes("support")) return "Support";
  if (title.includes("partner")) return "Partnership";
  if (title.includes("question")) return "Question";

  return "Support";
}

function getDisplayedCategoryName(ticket) {
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

function getDisplayedIntakeType(ticket) {
  const intake = getDisplayIntakeLabel(
    ticket?.matched_intake_type || ticket?.category || ticket?.raw_category || ""
  );

  if (intake === "Verification Issue") return "Verification";
  return intake;
}

function getCategoryReason(ticket) {
  const reason = String(ticket?.matched_category_reason || "").trim();
  if (!reason) return "";

  const lowered = normalizeText(reason);
  if (lowered === "no-categories") return "";
  if (lowered === "no categories") return "";

  return reason;
}

function getCategoryScore(ticket) {
  const score = Number(ticket?.matched_category_score || 0);
  return Number.isFinite(score) ? score : 0;
}

function hasMatchedCategory(ticket) {
  const matchedName = String(ticket?.matched_category_name || "").trim();
  const matchedSlug = String(ticket?.matched_category_slug || "").trim();

  return Boolean(
    (matchedName && !isPlaceholderCategory(matchedName)) ||
      (matchedSlug && !isPlaceholderCategory(matchedSlug))
  );
}

function countByStatus(tickets, status) {
  return tickets.filter(
    (ticket) => String(ticket?.status || "").toLowerCase() === status
  ).length;
}

function countByPriority(tickets, priority) {
  return tickets.filter(
    (ticket) => String(ticket?.priority || "").toLowerCase() === priority
  ).length;
}

function countMatchedCategories(tickets) {
  return tickets.filter((ticket) => hasMatchedCategory(ticket)).length;
}

function countVerificationLike(tickets) {
  return tickets.filter((ticket) => {
    const intake = getDisplayedIntakeType(ticket).toLowerCase();
    const category = getDisplayedCategoryName(ticket).toLowerCase();
    return intake === "verification" || category.includes("verification");
  }).length;
}

function getSummaryStats(tickets) {
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
  };
}

function getQueueHeading(tickets, explicitMode) {
  const rows = Array.isArray(tickets) ? tickets : [];
  const statuses = [...new Set(rows.map((ticket) => getStatus(ticket)).filter(Boolean))];
  const activeOnly =
    statuses.length > 0 &&
    statuses.every((status) => status === "open" || status === "claimed");

  if (explicitMode === "active" || (!explicitMode && activeOnly)) {
    return {
      title: "Active Ticket Queue",
      subtitle: "Live active tickets only — open and claimed work ready for staff action",
    };
  }

  if (explicitMode === "open_only") {
    return {
      title: "Open Ticket Queue",
      subtitle: "Showing only open tickets that still need staff action",
    };
  }

  if (explicitMode === "claimed") {
    return {
      title: "Claimed Ticket Queue",
      subtitle: "Showing claimed tickets currently being handled by staff",
    };
  }

  if (explicitMode === "closed") {
    return {
      title: "Closed Ticket History",
      subtitle: "Closed tickets remain visible here so staff can review and reopen when needed",
    };
  }

  if (explicitMode === "deleted") {
    return {
      title: "Deleted Ticket History",
      subtitle: "Deleted ticket records remain visible here for audit and historical review",
    };
  }

  if (explicitMode === "all") {
    return {
      title: "Ticket History & Queue",
      subtitle: "Showing active and historical tickets together for review, auditing, and reopen workflows",
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

function SummaryChip({ label, value, tone = "default" }) {
  return (
    <div className={`queue-summary-chip ${tone}`}>
      <span className="queue-summary-chip-label">{label}</span>
      <span className="queue-summary-chip-value">{value}</span>
    </div>
  );
}

function MetaBlock({ label, value, full = false }) {
  return (
    <div className={`ticket-mobile-meta-item ${full ? "full" : ""}`}>
      <span className="ticket-mobile-meta-label">{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function MiniField({ label, value, full = false }) {
  return (
    <div className={`ticket-info-item ${full ? "full" : ""}`}>
      <span className="ticket-info-label">{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function CategoryDisplay({ ticket, compact = false }) {
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

function TicketHeaderBadges({ ticket }) {
  const status = getStatus(ticket);
  const missingChannel = hasMissingChannel(ticket);
  const ghost = isGhost(ticket);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span className={badgeClass(status)}>{safeText(ticket.status)}</span>
      <span className={badgeClass(ticket.priority)}>
        {safeText(ticket.priority)}
      </span>
      {ghost ? <span className="badge">Ghost</span> : null}
      {missingChannel ? <span className="badge danger">Missing Channel</span> : null}
    </div>
  );
}

function TicketExpandedDetails({ ticket, currentStaffId, onRefresh }) {
  const channelId = getChannelId(ticket);
  const ghost = isGhost(ticket);

  return (
    <div className="ticket-expanded-shell">
      <div className="ticket-info-grid" style={{ marginBottom: 14 }}>
        <MiniField label="Category" value={getDisplayedCategoryName(ticket)} />
        <MiniField
          label="Intake Type"
          value={getDisplayedIntakeType(ticket) || "—"}
        />
        <MiniField label="Claimed By" value={safeText(ticket.claimed_by)} />
        <MiniField label="Channel ID" value={channelId || "Missing"} />
        <MiniField label="User ID" value={safeText(ticket.user_id)} />
        <MiniField
          label="Updated"
          value={timeAgo(ticket.updated_at || ticket.created_at)}
        />
        <MiniField label="Ghost" value={ghost ? "yes" : "no"} />
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

function MobileTicketCard({ ticket, currentStaffId, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const channelId = getChannelId(ticket);
  const missingChannel = hasMissingChannel(ticket);
  const ghost = isGhost(ticket);

  return (
    <div
      className={`ticket-mobile-card premium ${expanded ? "expanded" : ""}`}
      style={{
        border: missingChannel
          ? "1px solid rgba(248,113,113,0.28)"
          : undefined,
      }}
    >
      <button
        type="button"
        className="ticket-mobile-toggle"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 10,
            flexWrap: "nowrap",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ marginBottom: 8 }}>
              <TicketHeaderBadges ticket={ticket} />
            </div>

            <div className="queue-ticket-name">{getTicketUserLabel(ticket)}</div>

            <div className="muted queue-ticket-subtitle">
              {getTicketTitle(ticket)}
            </div>
          </div>

          <div className="muted queue-ticket-time">
            {timeAgo(ticket.updated_at || ticket.created_at)}
          </div>
        </div>

        <div className="queue-category-wrap">
          <CategoryDisplay ticket={ticket} compact />
        </div>

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
            <MetaBlock label="Claimed By" value={safeText(ticket.claimed_by)} />
            <MetaBlock label="Priority" value={safeText(ticket.priority)} />
            <MetaBlock label="Status" value={safeText(ticket.status)} />
            <MetaBlock label="Channel" value={channelId || "Missing"} full />
            <MetaBlock label="User ID" value={safeText(ticket.user_id)} full />
            <MetaBlock label="Ghost" value={ghost ? "yes" : "no"} />
            <MetaBlock
              label="Updated"
              value={timeAgo(ticket.updated_at || ticket.created_at)}
            />
            <MetaBlock
              label="Match Reason"
              value={getCategoryReason(ticket) || "—"}
              full
            />
            <MetaBlock
              label="Suggestion"
              value={ticket.mod_suggestion || "—"}
              full
            />
            {!!ticket.closed_reason ? (
              <MetaBlock label="Closed Reason" value={ticket.closed_reason} full />
            ) : null}
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
}) {
  const stats = useMemo(() => getSummaryStats(tickets), [tickets]);
  const heading = useMemo(
    () => getQueueHeading(tickets, queueMode),
    [tickets, queueMode]
  );
  const [expandedDesktopId, setExpandedDesktopId] = useState(null);

  function toggleDesktopTicket(ticketId) {
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
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
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

      {!tickets.length ? (
        <div className="empty-state">
          No tickets match the current filters.
        </div>
      ) : null}

      {!!tickets.length ? (
        <>
          <div className="ticket-mobile-list queue-mobile-stack">
            {tickets.map((ticket) => (
              <MobileTicketCard
                key={ticket.id}
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
                    <th>User</th>
                    <th>Category Intelligence</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Claimed By</th>
                    <th>Channel</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => {
                    const channelId = getChannelId(ticket);
                    const status = getStatus(ticket);
                    const missingChannel = hasMissingChannel(ticket);
                    const ghost = isGhost(ticket);
                    const isExpanded = expandedDesktopId === ticket.id;

                    return (
                      <React.Fragment key={ticket.id}>
                        <tr
                          style={
                            missingChannel
                              ? { background: "rgba(248,113,113,0.04)" }
                              : undefined
                          }
                        >
                          <td>
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
                                {safeText(ticket.status)}
                              </span>
                              <span className={badgeClass(ticket.priority)}>
                                {safeText(ticket.priority)}
                              </span>
                              {ghost ? <span className="badge">Ghost</span> : null}
                              {missingChannel ? (
                                <span className="badge danger">Missing Channel</span>
                              ) : null}
                            </div>

                            <div style={{ fontWeight: 800 }}>
                              {getTicketUserLabel(ticket)}
                            </div>

                            <div
                              className="muted"
                              style={{
                                fontSize: 13,
                                marginTop: 4,
                                whiteSpace: "normal",
                                overflowWrap: "anywhere",
                                lineHeight: 1.35,
                              }}
                            >
                              {getTicketTitle(ticket)}
                            </div>
                          </td>

                          <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                            <CategoryDisplay ticket={ticket} />
                          </td>

                          <td>
                            <span className={badgeClass(status)}>
                              {safeText(ticket.status)}
                            </span>
                          </td>

                          <td>
                            <span className={badgeClass(ticket.priority)}>
                              {safeText(ticket.priority)}
                            </span>
                          </td>

                          <td style={{ whiteSpace: "normal" }}>
                            {safeText(ticket.claimed_by)}
                          </td>

                          <td>
                            <div
                              style={{
                                fontSize: 13,
                                overflowWrap: "anywhere",
                                whiteSpace: "normal",
                                color: missingChannel ? "#fca5a5" : undefined,
                                fontWeight: missingChannel ? 700 : undefined,
                              }}
                            >
                              {channelId || "Missing"}
                            </div>
                          </td>

                          <td>{timeAgo(ticket.updated_at || ticket.created_at)}</td>

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
                                onClick={() => toggleDesktopTicket(ticket.id)}
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
                              colSpan={8}
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
            linear-gradient(180deg, rgba(14, 25, 35, 0.96), rgba(7, 13, 21, 0.96));
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

        .ticket-mobile-card.premium {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: 22px;
          padding: 14px;
          color: var(--text-strong, #f8fafc);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 36%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 28%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(17, 28, 39, 0.96), rgba(9, 16, 24, 0.96));
          box-shadow:
            0 14px 30px rgba(0,0,0,0.24),
            0 0 0 1px rgba(255,255,255,0.02) inset;
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

        .ticket-mobile-card.expanded {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.1), transparent 38%),
            radial-gradient(circle at bottom left, rgba(93,255,141,0.08), transparent 28%),
            linear-gradient(180deg, rgba(19, 33, 46, 0.98), rgba(10, 17, 26, 0.98));
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
        }

        .queue-ticket-time {
          font-size: 12px;
          white-space: nowrap;
          flex-shrink: 0;
          text-align: right;
        }

        .queue-category-wrap {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .queue-card-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
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

        .ticket-mobile-list {
          display: block;
        }

        .ticket-desktop-table {
          display: none;
        }

        @media (min-width: 768px) {
          .queue-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
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

        @media (min-width: 1200px) {
          .queue-summary-grid {
            grid-template-columns: repeat(11, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
