"use client"

import { useEffect, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import TicketMessageList from "@/components/TicketMessageList"
import TicketReplyBox from "@/components/TicketReplyBox"
import TicketStaffActions from "@/components/TicketStaffActions"

export default function TicketDetailClient({ initialData, ticketId }) {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function refresh({ silent = false } = {}) {
    if (!silent) setIsRefreshing(true)
    setError("")

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, { cache: "no-store" })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to refresh ticket.")
      }

      setData(json)
    } catch (err) {
      setError(err.message || "Failed to refresh ticket.")
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let supabase
    let channel

    async function handleRealtimeChange() {
      await refresh({ silent: true })
    }

    try {
      supabase = getBrowserSupabase()

      channel = supabase
        .channel(`ticket-${ticketId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_notes", filter: `ticket_id=eq.${ticketId}` },
          handleRealtimeChange
        )
        .subscribe((status) => {
          console.log("ticket realtime status:", status)
          if (status === "SUBSCRIBED") {
            refresh({ silent: true })
          }
        })
    } catch (err) {
      setError(err.message || "Realtime initialization failed.")
      return
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [ticketId])

  const ticket = data?.ticket || {}
  const messages = data?.messages || []
  const notes = data?.notes || []

  const status = ticket.status || "open"
  const priority = ticket.priority || "medium"

  return (
    <>
      {error ? (
        <div className="error-banner" style={{ marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 18 }}>
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}
        >
          <div className="muted">
            Live ticket view with realtime updates for replies, notes, status changes, and transfers.
          </div>

          <button
            className="button ghost"
            type="button"
            onClick={() => refresh()}
            disabled={isRefreshing}
            style={{ width: "auto", minWidth: 110 }}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="ticket-shell">
        <div className="space">
          <div className="card">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ marginTop: 0, marginBottom: 8 }}>
                  {ticket.title || "Ticket"}
                </h2>

                <div className="muted" style={{ overflowWrap: "anywhere" }}>
                  Ticket ID: {ticket.id || ticketId}
                </div>
              </div>

              <div
                className="row"
                style={{
                  gap: 8,
                  flexWrap: "wrap"
                }}
              >
                <span className={`badge ${status}`}>{status}</span>
                <span className={`badge ${priority}`}>{priority}</span>
              </div>
            </div>

            <div className="ticket-info-grid">
              <div className="ticket-info-item">
                <span className="ticket-info-label">User</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.username || ticket.user_id || "—"}
                </span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Category</span>
                <span>{ticket.category || "—"}</span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Claimed By</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.claimed_by || "—"}
                </span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Assigned To</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.assigned_to || "—"}
                </span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Closed By</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.closed_by || "—"}
                </span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Discord Channel</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.discord_thread_id ? `#${ticket.discord_thread_id}` : "Not linked"}
                </span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Suggestion</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.mod_suggestion || "—"}
                  {ticket.mod_suggestion_confidence !== undefined &&
                  ticket.mod_suggestion_confidence !== null
                    ? ` (${ticket.mod_suggestion_confidence})`
                    : ""}
                </span>
              </div>

              <div className="ticket-info-item">
                <span className="ticket-info-label">Closed Reason</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  {ticket.closed_reason || "—"}
                </span>
              </div>

              <div className="ticket-info-item full">
                <span className="ticket-info-label">Initial Message</span>
                <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {ticket.initial_message || "—"}
                </span>
              </div>
            </div>
          </div>

          <TicketStaffActions ticket={ticket} onRefresh={refresh} />

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Internal Notes</h2>

            <div className="space">
              {!notes.length ? (
                <div className="empty-state">No internal notes yet.</div>
              ) : null}

              {notes.map((note) => (
                <div key={note.id} className="message staff">
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10
                    }}
                  >
                    <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                      {note.staff_name || note.staff_id}
                    </div>

                    <div className="muted" style={{ fontSize: 12 }}>
                      Internal
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {note.content}
                  </div>

                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    {note.created_at
                      ? new Date(note.created_at).toLocaleString()
                      : "Unknown time"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space">
          <TicketMessageList messages={messages} />
          <TicketReplyBox ticketId={ticketId} onPosted={refresh} />
        </div>
      </div>
    </>
  )
}
