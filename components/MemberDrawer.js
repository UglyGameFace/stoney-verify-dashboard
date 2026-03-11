"use client"

import { useMemo, useState } from "react"

function buildMention(id) {
  return id ? `<@${id}>` : ""
}

export default function MemberDrawer({ member, onClose }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const displayName =
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.name ||
    member?.user_id ||
    member?.id ||
    "Unknown Member"

  const inGuild = member?.in_guild !== false
  const avatarUrl = member?.avatar_url || member?.avatar || null
  const memberId = member?.user_id || member?.id || ""

  const roleList = useMemo(() => {
    return member ? (member.roles || member.role_names || []) : []
  }, [member])

  if (!member) return null

  async function copyText(value, successText) {
    try {
      await navigator.clipboard.writeText(String(value || ""))
      setMessage(successText)
      setError("")
    } catch {
      setError("Failed to copy.")
      setMessage("")
    }
  }

  async function triggerRoleSync() {
    setBusy(true)
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
    } finally {
      setBusy(false)
    }
  }

  async function searchTicketsForMember() {
    try {
      await copyText(memberId, "User ID copied. Paste it into ticket search.")
    } catch {
      setError("Failed to copy user ID.")
    }
  }

  async function openStaffTicketTemplate() {
    const lines = [
      `Member: ${displayName}`,
      `User ID: ${memberId || "unknown"}`,
      `Status: ${inGuild ? "In Server" : "Left / Removed"}`,
      `Role State: ${member.role_state || "unknown"}`,
      `Top Role: ${member.top_role || member.highest_role_name || "none"}`
    ]

    await copyText(lines.join("\n"), "Member summary copied for staff use.")
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer member-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="member-drawer-handle" />

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Member Smoke Sheet</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Quick staff view and fast helper actions
            </div>
          </div>

          <button className="button ghost" onClick={onClose} style={{ width: "auto" }}>
            Close
          </button>
        </div>

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

        <div className="card">
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="avatar member-drawer-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  width="52"
                  height="52"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  color: "var(--text-strong)",
                  overflowWrap: "anywhere"
                }}
              >
                {displayName}
              </div>

              <div className="muted" style={{ overflowWrap: "anywhere", marginTop: 4 }}>
                {member.nickname || "No nickname"} • {memberId || "No user id"}
              </div>

              <div className="member-drawer-badges">
                <span className={`badge ${inGuild ? "claimed" : "closed"}`}>
                  {inGuild ? "In Server" : "Left / Removed"}
                </span>

                <span className={`badge ${member.has_verified_role ? "low" : "medium"}`}>
                  {member.has_verified_role ? "Verified" : "Pending Verification"}
                </span>

                <span className={`badge ${member.has_staff_role ? "claimed" : "open"}`}>
                  {member.has_staff_role ? "Staff" : "Member"}
                </span>
              </div>
            </div>
          </div>

          <div className="member-detail-grid" style={{ marginTop: 16 }}>
            <div className="member-detail-item">
              <span className="ticket-info-label">Top Role</span>
              <span>{member.top_role || member.highest_role_name || "—"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Role State</span>
              <span>{member.role_state || "—"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Health</span>
              <span>{member.data_health || "—"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Joined</span>
              <span>
                {member.joined_at ? new Date(member.joined_at).toLocaleString() : "—"}
              </span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Reason</span>
              <span style={{ overflowWrap: "anywhere" }}>
                {member.role_state_reason || "—"}
              </span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Roles</span>
              <div className="roles" style={{ marginTop: 8 }}>
                {roleList.length ? (
                  roleList.map((role) => (
                    <span key={role} className="badge">{role}</span>
                  ))
                ) : (
                  <span className="muted">No stored roles.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>Staff Actions</h2>

          <div className="member-action-grid">
            <button
              className="button"
              disabled={busy}
              onClick={() => copyText(memberId, "User ID copied.")}
            >
              Copy User ID
            </button>

            <button
              className="button"
              disabled={busy}
              onClick={() => copyText(buildMention(memberId), "Mention copied.")}
            >
              Copy Mention
            </button>

            <button
              className="button"
              disabled={busy}
              onClick={triggerRoleSync}
            >
              Run Role Sync
            </button>

            <button
              className="button"
              disabled={busy}
              onClick={searchTicketsForMember}
            >
              Prep Ticket Search
            </button>

            <button
              className="button"
              disabled={busy}
              onClick={openStaffTicketTemplate}
            >
              Copy Staff Summary
            </button>

            <button
              className="button ghost"
              disabled
              title="True mod actions come next once we wire the moderation routes."
            >
              Warn / Timeout / Ban
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
