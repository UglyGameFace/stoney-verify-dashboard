"use client"

import { useMemo, useState } from "react"

function buildMention(id) {
  return id ? `<@${id}>` : ""
}

export default function MemberDrawer({ member, onClose }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [modReason, setModReason] = useState("Dashboard moderation action")
  const [timeoutMinutes, setTimeoutMinutes] = useState("10")

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
    if (!member) return []
    return Array.isArray(member.roles) && member.roles.length
      ? member.roles
      : Array.isArray(member.role_names)
        ? member.role_names
        : []
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
    setSyncing(true)
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/discord/role-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error || "Role sync failed.")
      }

      setMessage("Role sync started. Refresh the dashboard in a few seconds to pull updated member state.")
    } catch (err) {
      setError(err.message || "Role sync failed.")
      setMessage("")
    } finally {
      setBusy(false)
      setSyncing(false)
    }
  }

  async function prepTicketSearch() {
    await copyText(memberId, "User ID copied. Paste it into ticket search.")
  }

  async function copyStaffSummary() {
    const lines = [
      `Member: ${displayName}`,
      `User ID: ${memberId || "unknown"}`,
      `Status: ${inGuild ? "In Server" : "Left / Removed"}`,
      `Role State: ${member.role_state || "unknown"}`,
      `Health: ${member.data_health || "unknown"}`,
      `Top Role: ${member.top_role || member.highest_role_name || "none"}`
    ]

    await copyText(lines.join("\n"), "Staff summary copied.")
  }

  async function runModAction(action) {
    setBusy(true)
    setMessage("")
    setError("")

    try {
      const payload = {
        action,
        user_id: memberId,
        username: displayName,
        reason: modReason.trim() || "Dashboard moderation action",
        minutes: Number(timeoutMinutes || 10)
      }

      const res = await fetch("/api/discord/mod-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error || `${action} failed`)
      }

      if (action === "timeout") {
        setMessage(`Timed out ${displayName} for ${payload.minutes} minute(s).`)
      } else if (action === "warn") {
        setMessage(`Warn recorded for ${displayName}.`)
      } else if (action === "kick") {
        setMessage(`${displayName} was kicked.`)
      } else if (action === "ban") {
        setMessage(`${displayName} was banned.`)
      }
    } catch (err) {
      setError(err.message || "Moderation action failed.")
      setMessage("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer member-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Member details"
      >
        <div className="member-drawer-handle" />

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Member Smoke Sheet</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Quick staff view and member helper actions
            </div>
          </div>

          <button
            className="button ghost"
            onClick={onClose}
            style={{ width: "auto", minWidth: 88 }}
          >
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

            <div style={{ minWidth: 0, flex: 1 }}>
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

              <div
                className="muted"
                style={{
                  overflowWrap: "anywhere",
                  marginTop: 4
                }}
              >
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
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: 0 }}>Staff Tools</h2>
            {syncing ? <span className="muted" style={{ fontSize: 13 }}>Syncing...</span> : null}
          </div>

          <div className="member-action-grid" style={{ marginBottom: 12 }}>
            <button className="button" disabled={busy} onClick={() => copyText(memberId, "User ID copied.")}>
              Copy User ID
            </button>

            <button className="button" disabled={busy} onClick={() => copyText(buildMention(memberId), "Mention copied.")}>
              Copy Mention
            </button>

            <button className="button" disabled={busy} onClick={triggerRoleSync}>
              {syncing ? "Running Sync..." : "Run Role Sync"}
            </button>

            <button className="button" disabled={busy} onClick={prepTicketSearch}>
              Prep Ticket Search
            </button>

            <button className="button" disabled={busy} onClick={copyStaffSummary}>
              Copy Staff Summary
            </button>
          </div>

          <div className="space">
            <textarea
              className="textarea"
              rows="3"
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
              placeholder="Moderation reason..."
            />

            <div className="row" style={{ alignItems: "stretch" }}>
              <input
                className="input"
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(e.target.value)}
                placeholder="Timeout minutes"
                inputMode="numeric"
              />
              <button
                className="button"
                disabled={busy || !memberId}
                onClick={() => runModAction("timeout")}
                style={{ width: "auto", minWidth: 120 }}
              >
                Timeout
              </button>
            </div>

            <div className="member-action-grid">
              <button
                className="button"
                disabled={busy || !memberId}
                onClick={() => runModAction("warn")}
              >
                Warn
              </button>

              <button
                className="button danger"
                disabled={busy || !memberId}
                onClick={() => runModAction("kick")}
              >
                Kick
              </button>

              <button
                className="button danger"
                disabled={busy || !memberId}
                onClick={() => runModAction("ban")}
              >
                Ban
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
