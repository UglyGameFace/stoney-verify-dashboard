"use client"

import { useEffect, useState } from "react"

export default function AuthStatus() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load session.")
        setSession(json.session || null)
      })
      .catch((err) => setError(err.message || "Failed to load session."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-state">Checking session…</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!session) return <a className="button primary" href="/api/auth/login">Login with Discord</a>

  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <div className="row">
        {session.user.avatar ? (
          <div className="avatar"><img src={session.user.avatar} alt="" width="38" height="38" /></div>
        ) : (
          <div className="avatar">{(session.user.username || "?").slice(0, 1).toUpperCase()}</div>
        )}
        <div>
          <div style={{ fontWeight: 800 }}>{session.user.username}</div>
          <div className="muted" style={{ fontSize: 13 }}>{session.isStaff ? "Staff access" : "View-only"}</div>
        </div>
      </div>
      <a className="button ghost" href="/api/auth/logout">Logout</a>
    </div>
  )
}
