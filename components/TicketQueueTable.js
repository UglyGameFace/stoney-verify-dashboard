"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { timeAgo } from "@/lib/format";
import TicketControls from "./dashboard/TicketControls";
import CreateTicketButton from "./dashboard/CreateTicketButton";

function badgeClass(value) {
  const v = String(value || "").toLowerCase();

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

  return "badge";
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
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
  return String(ticket?.status || "unknown").toLowerCase();
}

function isGhost(ticket) {
  return ticket?.is_ghost === true;
}

function hasMissingChannel(ticket) {
  return !getChannelId(ticket);
}

function getDisplayedCategoryName(ticket) {
  return (
    String(ticket?.matched_category_name || "").trim() ||
    String(ticket?.category || "").trim() ||
    "Uncategorized"
  );
}

function getDisplayedCategorySlug(ticket) {
  return (
    String(ticket?.matched_category_slug || "").trim() ||
    String(ticket?.category || "").trim() ||
    ""
  );
}

function getDisplayedIntakeType(ticket) {
  return String(ticket?.matched_intake_type || "").trim() || "";
}

function getCategoryReason(ticket) {
  return String(ticket?.matched_category_reason || "").trim() || "";
}

function getCategoryScore(ticket) {
  const score = Number(ticket?.matched_category_score || 0);
  return Number.isFinite(score) ? score : 0;
}

function hasMatchedCategory(ticket) {
  return Boolean(
    String(ticket?.matched_category_name || "").trim() ||
      String(ticket?.matched_category_slug || "").trim()
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
    urgent: countByPriority(tickets, "urgent"),
    high: countByPriority(tickets, "high"),
    missingChannel: tickets.filter((ticket) => hasMissingChannel(ticket)).length,
    ghosts: tickets.filter((ticket) => isGhost(ticket)).length,
    matched: countMatchedCategories(tickets),
    verificationLike: countVerificationLike(tickets),
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
  const categorySlug = getDisplayedCategorySlug(ticket);
  const intakeType = getDisplayedIntakeType(ticket);
  const reason = getCategoryReason(ticket);
  const score = getCategoryScore(ticket);
  const matched = hasMatchedCategory(ticket);

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
        <span className={matched ? "badge claimed" : "badge"}>
          {categoryName}
        </span>
        {intakeType ? (
          <span className={badgeClass(intakeType)}>{intakeType}</span>
        ) : null}
      </div>

      {reason ? (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          {compact ? reason : `Match: ${reason}`}
          {score > 0 ? ` • score ${score}` : ""}
        </div>
      ) : null}

      {categorySlug && categorySlug !== categoryName ? (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          {categorySlug}
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
        boxShadow: missingChannel
          ? "0 0 0 1px rgba(248,113,113,0.08)"
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
            <div style={{ marginBottom: 6 }}>
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

        <div style={{ marginBottom: 12 }}>
          <CategoryDisplay ticket={ticket} compact />
        </div>

        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {expanded ? "Hide actions" : "Open actions"}
          </div>
          <div className="badge open">{expanded ? "Expanded" : "Quick View"}</div>
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
}) {
  const stats = useMemo(() => getSummaryStats(tickets), [tickets]);
  const [expandedDesktopId, setExpandedDesktopId] = useState(null);

  function toggleDesktopTicket(ticketId) {
    setExpandedDesktopId((prev) => (prev === ticketId ? null : ticketId));
  }

  return (
    <div className="card" id="tickets">
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
          <h2 style={{ margin: 0 }}>Active Ticket Queue</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Live active tickets only — open and claimed work ready for staff action
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
            {tickets.length} active ticket{tickets.length === 1 ? "" : "s"}
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
          No active tickets match the current filters.
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
                      <>
                        <tr
                          key={ticket.id}
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
                          <tr key={`${ticket.id}-expanded`}>
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
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      <style jsx>{`
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

        .queue-summary-chip.warn {
          border-color: rgba(251, 191, 36, 0.2);
          background: rgba(251, 191, 36, 0.08);
        }

        .queue-summary-chip.danger {
          border-color: rgba(248, 113, 113, 0.24);
          background: rgba(248, 113, 113, 0.08);
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
          border-radius: 22px;
          padding: 14px;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.06), transparent 38%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            rgba(255,255,255,0.025);
        }

        .ticket-mobile-card.expanded {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.08), transparent 38%),
            rgba(99,213,255,0.05);
        }

        .ticket-mobile-toggle {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
          border: 0;
          padding: 0;
          margin: 0;
          text-align: left;
          color: inherit;
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

        @media (min-width: 768px) {
          .queue-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (min-width: 1200px) {
          .queue-summary-grid {
            grid-template-columns: repeat(9, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
