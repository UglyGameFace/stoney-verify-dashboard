"use client"

import { useState } from "react"

const actions = [
  { name: "Live Role Sync", endpoint: "/api/discord/role-sync", method: "POST" },
  { name: "Raid Check", endpoint: "/api/moderation/raid-check", method: "POST" },
  { name: "Create Sample Tickets", endpoint: "/api/tickets/sample", method: "POST" }
]

export default function QuickActions({ onRefresh }) {
  const [running, setRunning] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function run(endpoint, method, name) {
    setError("")
    setMessage("")
    setRunning(name)

    try {
      const res = await fetch(endpoint, { method })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Action failed.")
      }

      setMessage(`${name} completed.`)

      if (onRefresh) {
        await onRefresh()
      }
    } catch (err) {
      setError(err.message || "Action failed.")
    } finally {
      setRunning("")
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Quick Actions</h2>

      {error ? (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="info-banner" style={{ marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      <div className="quick-actions">
        {actions.map((action) => (
          <button
            key={action.name}
            className="button"
            disabled={running === action.name}
            onClick={() => run(action.endpoint, action.method, action.name)}
          >
            {running === action.name ? `Running ${action.name}...` : action.name}
          </button>
        ))}
      </div>
    </div>
  )
}
