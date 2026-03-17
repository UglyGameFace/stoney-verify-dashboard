"use client"

import { useEffect, useMemo, useState } from "react"

function buildMention(id) {
  return id ? `<@${id}>` : ""
}

function normalizeRoleLabel(role) {
  if (!role) return ""
  if (typeof role === "string") return role
  if (typeof role === "object") {
    if (typeof role.name === "string" && role.name.trim()) return role.name
    if (typeof role.id === "string" && role.id.trim()) return role.id
  }
  return ""
}

function formatTime(value) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "—"
  }
}

function truthBadgeTone(active, positive = "claimed", negative = "open") {
  return active ? positive : negative
}

function getRoleIds(payload) {
  return Array.isArray(payload?.role_ids) ? payload.role_ids.map(String) : []
}

function getRoleNames(payload) {
  return Array.isArray(payload?.role_names)
    ? payload.role_names.map((value) => String(value || "").trim()).filter(Boolean)
    : []
}

function getDisplayName(member) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.name ||
    member?.user_id ||
    member?.id ||
    "Unknown Member"
  )
}

export default function MemberDrawer({ member, onClose, onMemberUpdated }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [modReason, setModReason] = useState("Dashboard moderation action")
  const [timeoutMinutes, setTimeoutMinutes] = useState("10")
  const [liveMember, setLiveMember] = useState(null)
  const [loadingLive, setLoadingLive] = useState(false)
  const [discordUnavailable, setDiscordUnavailable] = useState(false)
  const [guildRoles, setGuildRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState("")

  const displayName = getDisplayName(liveMember || member)
  const sourceMember = liveMember || member || null
  const memberId = sourceMember?.user_id || sourceMember?.id || ""
  const avatarUrl = sourceMember?.avatar_url || sourceMember?.avatar || null
  const inGuild = sourceMember?.in_guild !== false

  useEffect(() => {
    setLiveMember(member || null)
    setMessage("")
    setError("")
    setSelectedRoleId("")
  }, [member])

  useEffect(() => {
    let cancelled = false

    async function loadLiveMember() {
      if (!memberId) {
        setLiveMember(null)
        return
      }

      setLoadingLive(true)
      setDiscordUnavailable(false)

      try {
        const res = await fetch(`/api/discord/member-details?user_id=${encodeURIComponent(memberId)}`, {
          cache: "no-store"
        })

        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || "Failed to load live member roles.")
        }

        if (!cancelled) {
          const nextMember = json.member || null
          setLiveMember(nextMember)
          setDiscordUnavailable(Boolean(nextMember?.discord_unavailable))
          if (nextMember && typeof onMemberUpdated === "function") {
            onMemberUpdated(nextMember)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDiscordUnavailable(true)
          setError(err?.message || "Failed to load live member roles.")
        }
      } finally {
        if (!cancelled) {
          setLoadingLive(false)
        }
      }
    }

    if (member) {
      loadLiveMember()
    }

    return () => {
      cancelled = true
    }
  }, [member, memberId, onMemberUpdated])

  useEffect(() => {
    let cancelled = false

    async function loadGuildRoles() {
      setLoadingRoles(true)

      try {
        const res = await fetch("/api/dashboard/live", { cache: "no-store" })
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || "Failed to load role catalog.")
        }

        if (!cancelled) {
          const rows = Array.isArray(json?.roles) ? json.roles : []
          setGuildRoles(rows)
        }
      } catch (err) {
        if (!cancelled) {
          setGuildRoles([])
        }
      } finally {
        if (!cancelled) {
          setLoadingRoles(false)
        }
      }
    }

    if (member) {
      loadGuildRoles()
    }

    return () => {
      cancelled = true
    }
  }, [member])

  const roleIds = useMemo(() => getRoleIds(sourceMember), [sourceMember])
  const roleList = useMemo(() => {
    const rawRoles =
      (Array.isArray(sourceMember?.role_names) && sourceMember.role_names.length && sourceMember.role_names) ||
      (Array.isArray(member?.roles) && member.roles.length ? member.roles : null) ||
      (Array.isArray(member?.role_names) && member.role_names.length ? member.role_names : []) ||
      []

    return rawRoles
      .map((role) => normalizeRoleLabel(role))
      .filter(Boolean)
  }, [sourceMember, member])

  const assignableRoles = useMemo(() => {
    const assigned = new Set(roleIds)
    return (Array.isArray(guildRoles) ? guildRoles : [])
      .map((role) => ({
        id: String(role.role_id || role.id || ""),
        name: String(role.name || "Unnamed Role"),
        position: Number(role.position || 0),
      }))
      .filter((role) => role.id && role.name && !assigned.has(role.id))
      .sort((a, b) => b.position - a.position)
  }, [guildRoles, roleIds])

  const selectedRoleName = useMemo(() => {
    return assignableRoles.find((role) => role.id === selectedRoleId)?.name || ""
  }, [assignableRoles, selectedRoleId])

  const truth = useMemo(() => {
    return {
      hasVerified: Boolean(sourceMember?.has_verified_role),
      hasUnverified: Boolean(sourceMember?.has_unverified),
      hasStaff: Boolean(sourceMember?.has_staff_role),
      roleState: sourceMember?.role_state || "unknown",
      roleStateReason: sourceMember?.role_state_reason || "",
      dataHealth: sourceMember?.data_health || "unknown",
      topRole:
        sourceMember?.top_role ||
        sourceMember?.highest_role_name ||
        member?.top_role ||
        member?.highest_role_name ||
        "—",
      joinedAt: sourceMember?.joined_at || member?.joined_at || null,
      updatedAt: sourceMember?.updated_at || sourceMember?.last_seen_at || member?.updated_at || null,
    }
  }, [sourceMember, member])

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

  async function refreshMemberDetails({ silent = false } = {}) {
    if (!memberId) return null
    if (!silent) {
      setMessage("")
      setError("")
    }

    const res = await fetch(`/api/discord/member-details?user_id=${encodeURIComponent(memberId)}`, {
      cache: "no-store"
    })
    const json = await res.json()

    if (!res.ok) {
      throw new Error(json.error || "Failed to refresh member details.")
    }

    const nextMember = json.member || null
    setLiveMember(nextMember)
    setDiscordUnavailable(Boolean(nextMember?.discord_unavailable))
    if (nextMember && typeof onMemberUpdated === "function") {
      onMemberUpdated(nextMember)
    }
    return nextMember
  }

  async function syncMemberNow({ successText = "Member sync completed.", silent = false } = {}) {
    if (!memberId) return null

    setSyncing(true)
    if (!silent) {
      setBusy(true)
      setMessage("")
      setError("")
    }

    try {
      const res = await fetch("/api/discord/member-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: memberId, reason: modReason.trim() || "Dashboard member sync" }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error || "Member sync failed.")
      }

      if (json.member) {
        setLiveMember(json.member)
        setDiscordUnavailable(Boolean(json.member?.discord_unavailable))
        if (typeof onMemberUpdated === "function") {
          onMemberUpdated(json.member)
        }
      } else {
        await refreshMemberDetails({ silent: true })
      }

      if (!silent) {
        setMessage(successText)
      }

      return json.member || null
    } catch (err) {
      if (!silent) {
        setError(err?.message || "Member sync failed.")
        setMessage("")
      }
      throw err
    } finally {
      setSyncing(false)
      if (!silent) {
        setBusy(false)
      }
    }
  }

  async function triggerFullRoleSync() {
    setBusy(true)
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/discord/role-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || "Role sync failed.")
      }

      await syncMemberNow({ successText: "Full role sync ran and this member was refreshed." })
    } catch (err) {
      setError(err?.message || "Role sync failed.")
      setMessage("")
      setBusy(false)
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
      `Role State: ${truth.roleState}`,
      `Health: ${truth.dataHealth}`,
      `Top Role: ${truth.topRole}`,
      `Live Roles: ${roleList.join(", ") || "none"}`,
    ]

    await copyText(lines.join("\n"), "Staff summary copied.")
  }

  async function runModAction(action, extra = {}) {
    if (!memberId) return

    setBusy(true)
    setMessage("")
    setError("")

    try {
      const payload = {
        action,
        user_id: memberId,
        username: displayName,
        reason: modReason.trim() || "Dashboard moderation action",
        minutes: Number(timeoutMinutes || 10),
        ...extra,
      }

      const res = await fetch("/api/discord/mod-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || `${action} failed`)
      }

      if (action === "timeout") {
        setMessage(`Timed out ${displayName} for ${json.timeout_minutes || payload.minutes} minute(s).`)
      } else if (action === "warn") {
        setMessage(`Warn recorded for ${displayName}.`)
      } else if (action === "kick") {
        setMessage(`${displayName} was kicked.`)
      } else if (action === "ban") {
        setMessage(`${displayName} was banned.`)
      } else if (action === "add_role") {
        setMessage(`Added ${selectedRoleName || "role"} to ${displayName}.`)
      } else if (action === "remove_role") {
        setMessage(`Removed ${extra.role_name || "role"} from ${displayName}.`)
      }

      if (["add_role", "remove_role", "timeout", "kick", "ban"].includes(action)) {
        await syncMemberNow({ successText: action === "add_role" || action === "remove_role" ? `Discord action confirmed and member refreshed.` : undefined, silent: true })
        await refreshMemberDetails({ silent: true }).catch(() => null)
      }
    } catch (err) {
      setError(err?.message || "Moderation action failed.")
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
          style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Member Smoke Sheet</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Truth-first member tools with direct Discord role control
            </div>
          </div>

          <button className="button ghost" onClick={onClose} style={{ width: "auto", minWidth: 88 }}>
            Close
          </button>
        </div>

        {discordUnavailable ? (
          <div className="warning-banner" style={{ marginBottom: 12 }}>
            Discord no longer reports this member. Showing the latest stored record.
          </div>
        ) : null}

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
                  overflowWrap: "anywhere",
                }}
              >
                {displayName}
              </div>

              <div className="muted" style={{ overflowWrap: "anywhere", marginTop: 4 }}>
                {(sourceMember?.nickname || member.nickname || "No nickname")} • {memberId || "No user id"}
              </div>

              <div className="member-drawer-badges">
                <span className={`badge ${inGuild ? "claimed" : "closed"}`}>{inGuild ? "In Server" : "Former Member"}</span>
                <span className={`badge ${truthBadgeTone(truth.hasVerified, "low", "medium")}`}>
                  {truth.hasVerified ? "Verified" : truth.hasUnverified ? "Unverified" : "Unknown Verification"}
                </span>
                <span className={`badge ${truthBadgeTone(truth.hasStaff, "claimed", "open")}`}>
                  {truth.hasStaff ? "Staff" : "Member"}
                </span>
                {truth.roleState && truth.roleState.includes("conflict") ? (
                  <span className="badge danger">Conflict</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="member-detail-grid" style={{ marginTop: 16 }}>
            <div className="member-detail-item">
              <span className="ticket-info-label">Top Role</span>
              <span>{truth.topRole}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Role State</span>
              <span>{truth.roleState}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Health</span>
              <span>{truth.dataHealth}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Joined</span>
              <span>{formatTime(truth.joinedAt)}</span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Reason</span>
              <span style={{ overflowWrap: "anywhere" }}>{truth.roleStateReason || "—"}</span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Last Refresh</span>
              <span>{loadingLive || syncing ? "Refreshing…" : formatTime(truth.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Live Discord Roles</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              {loadingRoles ? "Loading catalog…" : `${roleList.length} assigned`}
            </div>
          </div>

          <div className="roles" style={{ marginBottom: 12 }}>
            {roleList.length ? (
              roleList.map((roleName, index) => {
                const roleId = roleIds[index] || ""
                return (
                  <button
                    key={`${roleId || roleName}-${index}`}
                    type="button"
                    className="badge"
                    disabled={busy || !roleId || !inGuild}
                    title={roleId ? `Remove ${roleName}` : roleName}
                    onClick={() => runModAction("remove_role", { role_id: roleId, role_name: roleName })}
                    style={{ cursor: roleId && inGuild ? "pointer" : "default" }}
                  >
                    {roleName}
                    {roleId && inGuild ? " ×" : ""}
                  </button>
                )
              })
            ) : (
              <span className="muted">No roles found.</span>
            )}
          </div>

          <div className="space">
            <div className="row" style={{ alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
              <select
                className="input"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                disabled={busy || !inGuild || loadingRoles}
                style={{ flex: 1, minWidth: 180 }}
              >
                <option value="">Add a server role…</option>
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>

              <button
                className="button"
                disabled={busy || !inGuild || !selectedRoleId}
                style={{ width: "auto", minWidth: 120 }}
                onClick={async () => {
                  await runModAction("add_role", { role_id: selectedRoleId })
                  setSelectedRoleId("")
                }}
              >
                Add Role
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Tap an assigned role to remove it. Discord permission and hierarchy failures will return exact errors instead of fake success.
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
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

            <button className="button" disabled={busy || !memberId} onClick={() => syncMemberNow()}>
              {syncing ? "Syncing Member..." : "Sync Member Now"}
            </button>

            <button className="button ghost" disabled={busy || !memberId} onClick={triggerFullRoleSync}>
              Full Role Sync
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
              <button className="button" disabled={busy || !memberId} onClick={() => runModAction("warn")}>
                Warn
              </button>

              <button className="button danger" disabled={busy || !memberId} onClick={() => runModAction("kick")}>
                Kick
              </button>

              <button className="button danger" disabled={busy || !memberId} onClick={() => runModAction("ban")}>
                Ban
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
