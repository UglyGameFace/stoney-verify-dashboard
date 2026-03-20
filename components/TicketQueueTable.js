"use client";

import Link from "next/link";
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

function getPriority(ticket) {
  return String(ticket?.priority || "").trim().toLowerCase();
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

function getSummaryStats(tickets) {
  return {
    total: tickets.length,
    open: countByStatus(tickets, "open"),
    claimed: countByStatus(tickets, "claimed"),
    urgent: countByPriority(tickets, "urgent"),
    high: countByPriority(tickets, "high"),
    missingChannel: tickets.filter((ticket) => hasMissingChannel(ticket)).length,
    ghosts: tickets.filter((ticket) => isGhost(ticket)).length,
  };
}

function summaryChip(label, value, tone = "default") {
  return (
    <div className={`queue-summary-chip ${tone}`}>
      <span className="queue-summary-chip-label">{label}</span>
      <span className="queue-summary-chip-value">{value}</span>
    </div>
  );
}

function metaBlock(label, value, full = false) {
  return (
    <div className={`ticket-mobile-meta-item ${full ? "full" : ""}`}>
      <span className="ticket-mobile-meta-label">{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function desktopMiniField(label, value) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ overflowWrap: "anywhere" }}>{value}</div>
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
  const stats = getSummaryStats(tickets);

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
        {summaryChip("Total", stats.total)}
        {summaryChip("Open", stats.open, "open")}
        {summaryChip("Claimed", stats.claimed, "claimed")}
        {summaryChip("Urgent", stats.urgent, "danger")}
        {summaryChip("High", stats.high, "warn")}
        {summaryChip("Missing Channel", stats.missingChannel, stats.missingChannel ? "danger" : "default")}
        {summaryChip("Ghost", stats.ghosts, stats.ghosts ? "warn" : "default")}
      </div>

      {!tickets.length ? (
        <div className="empty-state">
          No active tickets match the current filters.
        </div>
      ) : null}

      {!!tickets.length ? (
        <>
          <div className="ticket-mobile-list" style={{ display: "grid", gap: 12 }}>
            {tickets.map((ticket) => {
              const status = getStatus(ticket);
              const channelId = getChannelId(ticket);
              const missingChannel = hasMissingChannel(ticket);
              const ghost = isGhost(ticket);

              return (
                <div
                  key={ticket.id}
                  className="ticket-mobile-card"
                  style={{
                    border: missingChannel
                      ? "1px solid rgba(248,113,113,0.28)"
                      : undefined,
                    boxShadow: missingChannel
                      ? "0 0 0 1px rgba(248,113,113,0.08)"
                      : undefined,
                  }}
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
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 6,
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

                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          overflowWrap: "anywhere",
                          lineHeight: 1.15,
                        }}
                      >
                        {getTicketUserLabel(ticket)}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          overflowWrap: "anywhere",
                          lineHeight: 1.35,
                        }}
                      >
                        {getTicketTitle(ticket)}
                      </div>
                    </div>

                    <div
                      className="muted"
                      style={{
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      {timeAgo(ticket.updated_at || ticket.created_at)}
                    </div>
                  </div>

                  <div className="ticket-mobile-meta">
                    {metaBlock("Category", safeText(ticket.category))}
                    {metaBlock("Claimed By", safeText(ticket.claimed_by))}
                    {metaBlock("Priority", safeText(ticket.priority))}
                    {metaBlock("Status", safeText(ticket.status))}
                    {metaBlock("Channel", channelId || "Missing", true)}
                    {metaBlock("User ID", safeText(ticket.user_id), true)}
                    {metaBlock("Ghost", ghost ? "yes" : "no")}
                    {metaBlock("Updated", timeAgo(ticket.updated_at || ticket.created_at))}
                    {metaBlock("Suggestion", ticket.mod_suggestion || "—", true)}

                    {!!ticket.closed_reason ? (
                      metaBlock("Closed Reason", ticket.closed_reason, true)
                    ) : null}
                  </div>

                  <div
                    className="ticket-mobile-actions"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                      Open Ticket View
                    </Link>
                  </div>

                  <TicketControls
                    ticket={ticket}
                    currentStaffId={currentStaffId}
                    onChanged={onRefresh}
                  />
                </div>
              );
            })}
          </div>

          <div className="ticket-desktop-table">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Claimed By</th>
                    <th>Channel</th>
                    <th>Updated</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => {
                    const channelId = getChannelId(ticket);
                    const status = getStatus(ticket);
                    const missingChannel = hasMissingChannel(ticket);
                    const ghost = isGhost(ticket);

                    return (
                      <tr
                        key={ticket.id}
                        style={
                          missingChannel
                            ? {
                                background: "rgba(248,113,113,0.04)",
                              }
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

                        <td style={{ whiteSpace: "normal" }}>
                          {safeText(ticket.category)}
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
                          <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {tickets.map((ticket) => {
                const channelId = getChannelId(ticket);
                const missingChannel = hasMissingChannel(ticket);
                const ghost = isGhost(ticket);

                return (
                  <div
                    key={`${ticket.id}-controls`}
                    className="card"
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      border: missingChannel
                        ? "1px solid rgba(248,113,113,0.24)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: missingChannel
                        ? "rgba(248,113,113,0.04)"
                        : undefined,
                    }}
                  >
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <span className={badgeClass(ticket.status)}>
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

                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 16,
                            overflowWrap: "anywhere",
                            lineHeight: 1.15,
                          }}
                        >
                          {getTicketUserLabel(ticket)}
                        </div>

                        <div
                          className="muted"
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            overflowWrap: "anywhere",
                            lineHeight: 1.35,
                          }}
                        >
                          {getTicketTitle(ticket)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                          Open Ticket View
                        </Link>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        marginBottom: 14,
                      }}
                    >
                      {desktopMiniField("Category", safeText(ticket.category))}
                      {desktopMiniField("Claimed By", safeText(ticket.claimed_by))}
                      {desktopMiniField("Channel ID", channelId || "Missing")}
                      {desktopMiniField("User ID", safeText(ticket.user_id))}
                      {desktopMiniField(
                        "Updated",
                        timeAgo(ticket.updated_at || ticket.created_at)
                      )}
                      {desktopMiniField("Ghost", ghost ? "yes" : "no")}
                    </div>

                    {!!ticket.mod_suggestion ? (
                      <div style={{ marginBottom: 14 }}>
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginBottom: 4 }}
                        >
                          Suggestion
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>
                          {ticket.mod_suggestion}
                        </div>
                      </div>
                    ) : null}

                    {!!ticket.closed_reason ? (
                      <div style={{ marginBottom: 14 }}>
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginBottom: 4 }}
                        >
                          Closed Reason
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>
                          {ticket.closed_reason}
                        </div>
                      </div>
                    ) : null}

                    <TicketControls
                      ticket={ticket}
                      currentStaffId={currentStaffId}
                      onChanged={onRefresh}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <style jsx>{`
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

        @media (min-width: 768px) {
          .queue-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (min-width: 1200px) {
          .queue-summary-grid {
            grid-template-columns: repeat(7, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
