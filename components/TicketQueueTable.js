"use client"

import Link from "next/link"
import { timeAgo } from "@/lib/format"

export default function TicketQueueTable({ tickets = [], onAction, loadingId }) {
  return (
    <div className="card" id="tickets">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Ticket Queue</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Rich desktop table with mobile ticket cards
          </div>
        </div>

        <div className="muted" style={{ fontSize: 14 }}>
          {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
        </div>
      </div>

      {!tickets.length ? (
        <div className="empty-state">No tickets match the current filters.</div>
      ) : null}

      {!!tickets.length ? (
        <>
          <div className="ticket-mobile-list">
            {tickets.map((ticket) => {
              const busy = loadingId === ticket.id

              return (
                <div key={ticket.id} className="ticket-mobile-card">
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                      marginBottom: 10
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          overflowWrap: "anywhere"
                        }}
                      >
                        {ticket.username || ticket.user_id}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          overflowWrap: "anywhere"
                        }}
                      >
                        {ticket.title}
                      </div>
                    </div>

                    <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {timeAgo(ticket.updated_at || ticket.created_at)}
                    </div>
                  </div>

                  <div className="ticket-mobile-meta">
                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Category</span>
                      <span>{ticket.category}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Status</span>
                      <span className={`badge ${ticket.status}`}>{ticket.status}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Priority</span>
                      <span className={`badge ${ticket.priority}`}>{ticket.priority}</span>
                    </div>

                    <div className="ticket-mobile-meta-item">
                      <span className="ticket-mobile-meta-label">Claimed</span>
                      <span>{ticket.claimed_by || "—"}</span>
                    </div>

                    <div className="ticket-mobile-meta-item full">
                      <span className="ticket-mobile-meta-label">Suggestion</span>
                      <span style={{ overflowWrap: "anywhere" }}>
                        {ticket.mod_suggestion || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="ticket-mobile-actions">
                    <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                      Open
                    </Link>

                    {ticket.status !== "claimed" && ticket.status !== "closed" ? (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => onAction("claim", ticket.id, {})}
                      >
                        {busy ? "Claiming..." : "Claim"}
                      </button>
                    ) : null}

                    {ticket.status !== "closed" ? (
                      <button
                        className="button danger"
                        disabled={busy}
                        onClick={() =>
                          onAction("close", ticket.id, {
                            reason: "Closed from dashboard queue"
                          })
                        }
                      >
                        {busy ? "Closing..." : "Close"}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
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
                    <th>Suggestion</th>
                    <th>Claimed By</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => {
                    const busy = loadingId === ticket.id

                    return (
                      <tr key={ticket.id}>
                        <td>
                          <div style={{ fontWeight: 800 }}>{ticket.username || ticket.user_id}</div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            {ticket.title}
                          </div>
                        </td>

                        <td>{ticket.category}</td>

                        <td>
                          <span className={`badge ${ticket.status}`}>{ticket.status}</span>
                        </td>

                        <td>
                          <span className={`badge ${ticket.priority}`}>{ticket.priority}</span>
                        </td>

                        <td>{ticket.mod_suggestion || "—"}</td>

                        <td>{ticket.claimed_by || "—"}</td>

                        <td>{timeAgo(ticket.updated_at || ticket.created_at)}</td>

                        <td>
                          <div className="row" style={{ flexWrap: "wrap" }}>
                            <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                              Open
                            </Link>

                            {ticket.status !== "claimed" && ticket.status !== "closed" ? (
                              <button
                                className="button"
                                disabled={busy}
                                onClick={() => onAction("claim", ticket.id, {})}
                              >
                                {busy ? "Claiming..." : "Claim"}
                              </button>
                            ) : null}

                            {ticket.status !== "closed" ? (
                              <button
                                className="button danger"
                                disabled={busy}
                                onClick={() =>
                                  onAction("close", ticket.id, {
                                    reason: "Closed from dashboard table"
                                  })
                                }
                              >
                                {busy ? "Closing..." : "Close"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
