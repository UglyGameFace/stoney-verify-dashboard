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

  if (v === "low") return "badge";
  if (v === "medium") return "badge";
  if (v === "high") return "badge";
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

export default function TicketQueueTable({
  tickets = [],
  currentStaffId = null,
  onRefresh = async () => {},
  createTicketUserId = null,
  createTicketTargetName = "",
}) {
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
        <div>
          <h2 style={{ margin: 0 }}>Ticket Queue</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Rich desktop table with mobile ticket cards
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

      {!tickets.length ? (
        <div className="empty-state">No tickets match the current filters.</div>
      ) : null}

      {!!tickets.length ? (
        <>
          <div className="ticket-mobile-list">
            {tickets.map((ticket) => {
              const status = getStatus(ticket);
              const channelId = getChannelId(ticket);

              return (
                <div key={ticket.id} className="ticket-mobile-card">
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          overflowWrap: "anywhere",
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
                        }}
                      >
                        {getTicketTitle(ticket)}
                      </div>
                    </div>

                    <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {timeAgo(ticket.updated_at || ticket.created_at)}
                    </div>
                  </div>

                  <div className="ticket-mobile-meta">
                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Category</span>
                      <span>{safeText(ticket.category)}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Status</span>
                      <span className={badgeClass(status)}>{safeText(ticket.status)}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Priority</span>
                      <span className={badgeClass(ticket.priority)}>
                        {safeText(ticket.priority)}
                      </span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Claimed</span>
                      <span>{safeText(ticket.claimed_by)}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Channel</span>
                      <span>{channelId || "Missing"}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Ghost</span>
                      <span>{isGhost(ticket) ? "yes" : "no"}</span>
                    </div>

                    <div className="ticket-mobile-meta-item full">
                      <span className="ticket-mobile-meta-label">Suggestion</span>
                      <span style={{ overflowWrap: "anywhere" }}>
                        {ticket.mod_suggestion || "—"}
                      </span>
                    </div>

                    {!!ticket.closed_reason ? (
                      <div className="ticket-mobile-meta-item full">
                        <span className="ticket-mobile-meta-label">Closed Reason</span>
                        <span style={{ overflowWrap: "anywhere" }}>
                          {ticket.closed_reason}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="ticket-mobile-actions"
                    style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}
                  >
                    <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                      Open
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

                    return (
                      <tr key={ticket.id}>
                        <td>
                          <div style={{ fontWeight: 800 }}>{getTicketUserLabel(ticket)}</div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            {getTicketTitle(ticket)}
                          </div>
                          {isGhost(ticket) ? (
                            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                              Ghost ticket
                            </div>
                          ) : null}
                        </td>

                        <td>{safeText(ticket.category)}</td>

                        <td>
                          <span className={badgeClass(status)}>{safeText(ticket.status)}</span>
                        </td>

                        <td>
                          <span className={badgeClass(ticket.priority)}>
                            {safeText(ticket.priority)}
                          </span>
                        </td>

                        <td>{safeText(ticket.claimed_by)}</td>

                        <td>
                          <div style={{ fontSize: 13, overflowWrap: "anywhere" }}>
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

                return (
                  <div
                    key={`${ticket.id}-controls`}
                    className="card"
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.08)",
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
                            fontWeight: 800,
                            fontSize: 16,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {getTicketUserLabel(ticket)}
                        </div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
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
                        <span className={badgeClass(ticket.status)}>{safeText(ticket.status)}</span>
                        <span className={badgeClass(ticket.priority)}>
                          {safeText(ticket.priority)}
                        </span>
                        <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                          Open
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
                      <div>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Category
                        </div>
                        <div>{safeText(ticket.category)}</div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Claimed By
                        </div>
                        <div>{safeText(ticket.claimed_by)}</div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Channel ID
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>
                          {channelId || "Missing"}
                        </div>
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Updated
                        </div>
                        <div>{timeAgo(ticket.updated_at || ticket.created_at)}</div>
                      </div>
                    </div>

                    {!!ticket.mod_suggestion ? (
                      <div style={{ marginBottom: 14 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Suggestion
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>{ticket.mod_suggestion}</div>
                      </div>
                    ) : null}

                    {!!ticket.closed_reason ? (
                      <div style={{ marginBottom: 14 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                          Closed Reason
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>{ticket.closed_reason}</div>
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
    </div>
  );
}
