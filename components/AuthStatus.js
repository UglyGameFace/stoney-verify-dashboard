"use client"

import { useEffect, useState } from "react"

export default function AuthStatus() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || "Failed to load session.")
        }

        if (mounted) {
          setSession(json.session || null)
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load session.")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return <div className="loading-state">Checking session...</div>
  }

  if (error) {
    return <div className="error-banner">{error}</div>
  }

  if (!session) {
    return (
      <div className="auth-status-card">
        <div className="space" style={{ gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Staff Login</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Sign in with Discord to access staff actions and live moderation tools.
            </div>
          </div>

          <a className="button primary" href="/api/auth/login">
            Login with Discord
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-status-card">
      <div
        className="row auth-status-row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12
        }}
      >
        <div className="row" style={{ minWidth: 0, flex: 1 }}>
          {session.user?.avatar ? (
            <div className="avatar">
              <img
                src={session.user.avatar}
                alt={session.user.username || "User avatar"}
                width="38"
                height="38"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div className="avatar">
              {(session.user?.username || "?").slice(0, 1).toUpperCase()}
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {session.user?.username}
            </div>

            <div
              className="muted"
              style={{
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {session.isStaff ? "Staff access active" : "View-only session"}
            </div>
          </div>
        </div>

        <a className="button ghost auth-status-logout" href="/api/auth/logout">
          Logout
        </a>
      </div>
    </div>
  )
}
