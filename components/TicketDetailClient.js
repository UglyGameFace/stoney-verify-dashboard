"use client"

import { useEffect, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import TicketMessageList from "@/components/TicketMessageList"
import TicketReplyBox from "@/components/TicketReplyBox"
import TicketStaffActions from "@/components/TicketStaffActions"

export default function TicketDetailClient({ initialData, ticketId }) {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState("")

  async function refresh() {
    setError("")
    const res = await fetch(`/api/tickets/${ticketId}`, { cache: "no-store" })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || "Failed to refresh ticket.")
      return
    }
    setData(json)
  }

  useEffect(() => {
    let supabase
    try {
      supabase = getBrowserSupabase()
    } catch (err) {
      setError(err.message || "Realtime client unavailable.")
      return
    }
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_notes", filter: `ticket_id=eq.${ticketId}` }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ticketId])

  return (
    <>
      {error ? <div className="error-banner" style={{ marginBottom: 18 }}>{error}</div> : null}
      <div className="ticket-shell">
        <div className="space">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Ticket Info</h2>
            <div className="space">
              <div><strong>User:</strong> {data.ticket.username || data.ticket.user_id}</div>
              <div><strong>Category:</strong> {data.ticket.category}</div>
              <div><strong>Status:</strong> <span className={`badge ${data.ticket.status}`}>{data.ticket.status}</span></div>
              <div><strong>Priority:</strong> <span className={`badge ${data.ticket.priority}`}>{data.ticket.priority}</span></div>
              <div><strong>Claimed By:</strong> {data.ticket.claimed_by || "—"}</div>
              <div><strong>Suggestion:</strong> {data.ticket.mod_suggestion || "—"} ({data.ticket.mod_suggestion_confidence || 0})</div>
              <div><strong>Initial Message:</strong> {data.ticket.initial_message}</div>
            </div>
          </div>

          <TicketStaffActions ticket={data.ticket} onRefresh={refresh} />

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Internal Notes</h2>
            <div className="space">
              {!data.notes.length ? <div className="empty-state">No internal notes yet.</div> : null}
              {data.notes.map((note) => (
                <div key={note.id} className="message staff">
                  <div style={{ fontWeight: 800 }}>{note.staff_name || note.staff_id}</div>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{note.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space">
          <TicketMessageList messages={data.messages} />
          <TicketReplyBox ticketId={ticketId} onPosted={refresh} />
        </div>
      </div>
    </>
  )
}
