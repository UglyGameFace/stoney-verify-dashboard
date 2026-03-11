"use client"

import { useState } from "react"

export default function TicketReplyBox({ ticketId, onPosted }) {
  const [message, setMessage] = useState("")
  const [attachmentInput, setAttachmentInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function parseAttachments(value) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url, index) => ({
        name: `attachment-${index + 1}`,
        url
      }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setError("Reply message cannot be empty.")
      return
    }

    setBusy(true)
    setError("")
    setSuccess("")

    try {
      const attachments = parseAttachments(attachmentInput)

      const res = await fetch(`/api/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmedMessage,
          attachments
        })
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to send reply.")
      }

      setMessage("")
      setAttachmentInput("")
      setSuccess(
        json.mirroredToDiscord
          ? "Reply sent and mirrored to Discord."
          : "Reply saved."
      )

      if (onPosted) {
        await onPosted()
      }
    } catch (err) {
      setError(err.message || "Failed to send reply.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Reply to Ticket</h2>

      {error ? (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="info-banner" style={{ marginBottom: 12 }}>
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space">
        <textarea
          className="textarea"
          rows="6"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your staff reply..."
        />

        <textarea
          className="textarea"
          rows="3"
          value={attachmentInput}
          onChange={(e) => setAttachmentInput(e.target.value)}
          placeholder="Optional attachment URLs, one per line..."
        />

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}
        >
          <div className="muted" style={{ fontSize: 13 }}>
            Replies are stored in the dashboard and mirrored to Discord when linked.
          </div>

          <button
            type="submit"
            className="button primary"
            disabled={busy || !message.trim()}
            style={{ width: "auto", minWidth: 140 }}
          >
            {busy ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>
    </div>
  )
}
