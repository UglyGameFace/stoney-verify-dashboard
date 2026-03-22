"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import TicketMessageList from "@/components/TicketMessageList"
import TicketReplyBox from "@/components/TicketReplyBox"
import TicketControls from "@/components/dashboard/TicketControls"
import TicketVerificationActions from "@/components/TicketVerificationActions"

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function formatDateTime(value) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "—"
  }
}

function getCurrentStaffId(data) {
  return (
    String(data?.currentStaffId || "").trim() ||
    String(data?.viewer?.id || "").trim() ||
    String(data?.viewer?.user_id || "").trim() ||
    String(data?.session?.user?.id || "").trim() ||
    String(data?.session?.discordUser?.id || "").trim() ||
    ""
  )
}

export default function TicketDetailClient({ initialData, ticketId }) {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [note, setNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [noteError, setNoteError] = useState("")
  const [noteMessage, setNoteMessage] = useState("")

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

  async function saveInternalNote() {
    const content = String(note || "").trim()
    if (!content) return

    setSavingNote(true)
    setNoteError("")
    setNoteMessage("")

    try {
      const res = await fetch(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ content }),
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save internal note.")
      }

      setNote("")
      setNoteMessage("Internal note saved.")
      await refresh({ silent: true })
    } catch (err) {
      setNoteError(err?.message || "Failed to save internal note.")
    } finally {
      setSavingNote(false)
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

  const status = String(ticket.status || "open").toLowerCase()
  const priority = String(ticket.priority || "medium").toLowerCase()
  const currentStaffId = useMemo(() => getCurrentStaffId(data), [data])

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
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Ticket Detail
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(30px, 5vw, 46px)",
                lineHeight: 0.96,
                letterSpacing: "-0.05em",
                overflowWrap: "anywhere",
              }}
            >
              {ticket.title || "Ticket"}
            </h1>

            <div
              className="muted"
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                overflowWrap: "anywhere",
              }}
            >
              <span>{ticket.username || ticket.user_id || "Unknown user"}</span>
              <span>•</span>
              <span>{ticket.category || "uncategorized"}</span>
              <span>•</span>
              <span>{status}</span>
            </div>
          </div>

          <div
            className="row"
            style={{
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span className={`badge ${status}`}>{status}</span>
            <span className={`badge ${priority}`}>{priority}</span>
          </div>
        </div>

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div className="muted" style={{ minWidth: 0, flex: 1 }}>
            Live ticket view with realtime updates for replies, notes, and status changes.
          </div>

          <div
            className="row"
            style={{
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              className="button ghost"
              href="/"
              style={{ width: "auto", minWidth: 170 }}
            >
              Back to Dashboard
            </Link>

            <button
              className="button ghost"
              type="button"
              onClick={() => refresh()}
              disabled={isRefreshing}
              style={{ width: "auto", minWidth: 110 }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <a
              className="button primary"
              href={`/api/tickets/${ticket.id || ticketId}/transcript`}
              target="_blank"
              rel="noreferrer"
              style={{ width: "auto", minWidth: 170 }}
            >
              Export Transcript
            </a>
          </div>
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
                marginBottom: 14,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ marginTop: 0, marginBottom: 8 }}>
                  Ticket Snapshot
                </h2>

                <div className="muted" style={{ overflowWrap: "anywhere" }}>
                  Ticket ID: {ticket.id || ticketId}
                </div>
              </div>

              <div
                className="row"
                style={{
                  gap: 8,
                  flexWrap: "wrap",
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
                  {ticket.channel_id || ticket.discord_thread_id || "Not linked"}
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

          <TicketControls
            ticket={ticket}
            currentStaffId={currentStaffId || null}
            onChanged={refresh}
          />

          <TicketVerificationActions
            ticket={ticket}
            currentStaffId={currentStaffId || null}
            onChanged={refresh}
          />

          <div className="card">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0 }}>Internal Notes</h2>
              <div className="muted" style={{ fontSize: 13 }}>
                Staff-only notes for this ticket
              </div>
            </div>

            {noteError ? (
              <div className="error-banner" style={{ marginBottom: 12 }}>
                {noteError}
              </div>
            ) : null}

            {noteMessage ? (
              <div className="info-banner" style={{ marginBottom: 12 }}>
                {noteMessage}
              </div>
            ) : null}

            <div className="space" style={{ marginBottom: 14 }}>
              <textarea
                className="textarea"
                rows="4"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add internal note..."
              />

              <button
                className="button ghost"
                disabled={savingNote || !note.trim()}
                onClick={saveInternalNote}
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>

            <div className="space">
              {!notes.length ? (
                <div className="empty-state">No internal notes yet.</div>
              ) : null}

              {notes.map((noteRow) => (
                <div key={noteRow.id} className="message staff">
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                      {noteRow.staff_name || noteRow.staff_id}
                    </div>

                    <div className="muted" style={{ fontSize: 12 }}>
                      Internal
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {noteRow.content}
                  </div>

                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    {formatDateTime(noteRow.created_at)}
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
