"use client"

import Link from "next/link"
import { timeAgo } from "@/lib/format"

export default function TicketQueueTable({ tickets = [], onAction, loadingId }) {
  return (
    <div className="card" id="tickets">
      <h2 style={{ marginTop: 0 }}>Ticket Queue</h2>
      <div className="muted" style={{ marginBottom: 14 }}>Richer desktop table with inline staff controls</div>
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
            {!tickets.length ? (
              <tr>
                <td colSpan="8">
                  <div className="empty-state">No tickets match the current filters.</div>
                </td>
              </tr>
            ) : tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <div style={{ fontWeight: 800 }}>{ticket.username || ticket.user_id}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{ticket.title}</div>
                </td>
                <td>{ticket.category}</td>
                <td><span className={`badge ${ticket.status}`}>{ticket.status}</span></td>
                <td><span className={`badge ${ticket.priority}`}>{ticket.priority}</span></td>
                <td>{ticket.mod_suggestion || "—"}</td>
                <td>{ticket.claimed_by || "—"}</td>
                <td>{timeAgo(ticket.updated_at || ticket.created_at)}</td>
                <td>
                  <div className="row">
                    <Link className="button ghost" href={`/tickets/${ticket.id}`}>Open</Link>
                    {ticket.status !== "claimed" && ticket.status !== "closed" ? (
                      <button className="button" disabled={loadingId === ticket.id} onClick={() => onAction("claim", ticket.id, {})}>
                        {loadingId === ticket.id ? "Claiming…" : "Claim"}
                      </button>
                    ) : null}
                    {ticket.status !== "closed" ? (
                      <button className="button danger" disabled={loadingId === ticket.id} onClick={() => onAction("close", ticket.id, { reason: "Closed from dashboard table" })}>
                        {loadingId === ticket.id ? "Closing…" : "Close"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
