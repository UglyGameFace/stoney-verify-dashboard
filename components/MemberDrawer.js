"use client"

import { useState } from "react"

export default function MemberDrawer({ member, onClose }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  if (!member) return null

  const displayName =
    member.display_name ||
    member.nickname ||
    member.username ||
    member.name ||
    member.user_id ||
    member.id ||
    "Unknown Member"

  const inGuild = member.in_guild !== false
  const avatarUrl = member.avatar_url || member.avatar || null
  const memberId = member.user_id || member.id || ""

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(String(memberId))
      setMessage("User ID copied.")
      setError("")
    } catch {
      setError("Failed to copy user ID.")
      setMessage("")
    }
  }

  async function triggerRoleSync() {
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/discord/role-sync", {
        method: "POST"
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Role sync failed.")
      }

      setMessage("Role sync started.")
    } catch (err) {
      setError(err.message || "Role sync failed.")
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0 }}>Member Details</h2>
          <button className="button ghost" onClick={onClose}>Close</button>
        </div>

        {error ? <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div> : null}
        {message ? <div className="info-banner" style={{ marginBottom: 12 }}>{message}</div> : null}

        <div className="card">
          <div className="row">
            <div className="avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  width="38"
                  height="38"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>{displayName}</div>
              <div className="muted" style={{ overflowWrap: "anywhere" }}>
                {member.nickname || "No nickname"} • {memberId || "No user id"}
              </div>
            </div>
          </div>

          <div className="space" style={{ marginTop: 16 }}>
            <div><strong>Status:</strong> {inGuild ? "In Server" : "Left / Removed"}</div>
            <div><strong>Top Role:</strong> {member.top_role || member.highest_role_name || "—"}</div>
            <div><strong>Role State:</strong> {member.role_state || "—"}</div>
            <div><strong>Health:</strong> {member.data_health || "—"}</div>
            <div><strong>Joined:</strong> {member.joined_at ? new Date(member.joined_at).toLocaleString() : "—"}</div>
            <div>
              <strong>Roles:</strong>
              <div className="roles" style={{ marginTop: 8 }}>
                {(member.roles || member.role_names || []).map((role) => (
                  <span key={role} className="badge">{role}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>Staff Actions</h2>

          <div className="space">
            <button className="button" onClick={copyUserId}>
              Copy User ID
            </button>

            <button className="button" onClick={triggerRoleSync}>
              Run Role Sync
            </button>

            <a
              className="button ghost"
              href={`/api/discord/member-search?q=${encodeURIComponent(memberId || displayName)}`}
              target="_blank"
              rel="noreferrer"
            >
              Live Member Lookup
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
