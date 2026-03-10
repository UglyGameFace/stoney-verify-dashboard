"use client"

import { useState } from "react"

export default function TicketReplyBox({ ticketId, onPosted }) {
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  async function submit(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setError("")
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, message_type: "staff" })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to send reply.")
      setContent("")
      await onPosted()
    } catch (err) {
      setError(err.message || "Failed to send reply.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Send Reply</h2>
      {error ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}
      <form className="space" onSubmit={submit}>
        <textarea className="textarea" rows="6" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your response..." />
        <button className="button primary" type="submit" disabled={sending}>{sending ? "Sending…" : "Post Reply"}</button>
      </form>
    </div>
  )
}
