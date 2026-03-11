"use client"

import { useState } from "react"

export default function TicketStaffActions({ ticket, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState("Resolved by staff")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  async function post(endpoint, payload) {
    setBusy(true)
    setError("")

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const json = await res.json()

      if (!res.ok) throw new Error(json.error || "Ticket action failed.")

      if (onRefresh) await onRefresh()

      setNote("")
    } catch (err) {
      setError(err.message || "Ticket action failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space">
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Staff Actions</h2>

        <div className="space">
          {ticket.status !== "claimed" && ticket.status !== "closed" ? (
            <button
              className="button"
              disabled={busy}
              onClick={() => post(`/api/tickets/${ticket.id}/claim`, {})}
            >
              {busy ? "Working…" : "Claim Ticket"}
            </button>
          ) : null}

          {ticket.status !== "closed" ? (
            <>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <button
                className="button danger"
                disabled={busy}
                onClick={() =>
                  post(`/api/tickets/${ticket.id}/close`, { reason })
                }
              >
                {busy ? "Working…" : "Close Ticket"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Internal Note</h2>

        <div className="space">
          <textarea
            className="textarea"
            rows="5"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add internal note..."
          />

          <button
            className="button"
            disabled={busy || !note.trim()}
            onClick={() =>
              post(`/api/tickets/${ticket.id}/notes`, { content: note })
            }
          >
            {busy ? "Saving…" : "Save Note"}
          </button>
        </div>
      </div>

      <a
        className="button primary"
        href={`/api/tickets/${ticket.id}/transcript`}
        target="_blank"
        rel="noreferrer"
      >
        Export Transcript
      </a>
    </div>
  )
}
