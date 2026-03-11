"use client"

import { useState } from "react"

export default function TicketStaffActions({ ticket, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState("Resolved by staff")
  const [note, setNote] = useState("")
  const [transferTarget, setTransferTarget] = useState("")
  const [transferReason, setTransferReason] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function post(endpoint, payload) {
    setBusy(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Ticket action failed.")
      }

      if (onRefresh) {
        await onRefresh()
      }

      setNote("")
      setTransferReason("")
      setMessage("Action completed.")
      return json
    } catch (err) {
      setError(err.message || "Ticket action failed.")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function onClaim() {
    await post(`/api/tickets/${ticket.id}/claim`, {})
  }

  async function onClose() {
    await post(`/api/tickets/${ticket.id}/close`, { reason })
  }

  async function onReopen() {
    await post(`/api/tickets/${ticket.id}/reopen`, {})
  }

  async function onSaveNote() {
    const content = note.trim()
    if (!content) return
    await post(`/api/tickets/${ticket.id}/notes`, { content })
  }

  async function onTransfer() {
    const assignedTo = transferTarget.trim()
    if (!assignedTo) {
      setError("Enter the staff member name for transfer.")
      return
    }

    await post(`/api/tickets/${ticket.id}/transfer`, {
      assigned_to: assignedTo,
      reason: transferReason.trim()
    })
  }

  const isClosed = ticket.status === "closed"
  const isClaimed = ticket.status === "claimed"

  return (
    <div className="space">
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="info-banner">{message}</div> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Staff Actions</h2>

        <div className="space">
          {!isClaimed && !isClosed ? (
            <button
              className="button"
              disabled={busy}
              onClick={onClaim}
            >
              {busy ? "Working..." : "Claim Ticket"}
            </button>
          ) : null}

          {!isClosed ? (
            <>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for closing"
              />

              <button
                className="button danger"
                disabled={busy}
                onClick={onClose}
              >
                {busy ? "Working..." : "Close Ticket"}
              </button>
            </>
          ) : null}

          {isClosed ? (
            <button
              className="button"
              disabled={busy}
              onClick={onReopen}
            >
              {busy ? "Working..." : "Reopen Ticket"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Transfer Ticket</h2>

        <div className="space">
          <input
            className="input"
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            placeholder="Transfer to staff name"
          />

          <textarea
            className="textarea"
            rows="4"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Reason for transfer..."
          />

          <button
            className="button"
            disabled={busy || !transferTarget.trim()}
            onClick={onTransfer}
          >
            {busy ? "Working..." : "Transfer Ticket"}
          </button>
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
            onClick={onSaveNote}
          >
            {busy ? "Saving..." : "Save Note"}
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
