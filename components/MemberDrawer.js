"use client"

import { useEffect, useMemo, useState } from "react"

function buildMention(id) {
  return id ? `<@${id}>` : ""
}

function formatTime(value) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "—"
  }
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

function getSourceMember(primary, fallback) {
  return primary || fallback || null
}

function getMemberId(member) {
  return String(member?.user_id || member?.id || "").trim()
}

function getRoleNames(member) {
  if (Array.isArray(member?.role_names) && member.role_names.length) {
    return member.role_names.map((value) => String(value || "").trim()).filter(Boolean)
  }

  if (Array.isArray(member?.roles) && member.roles.length) {
    return member.roles
      .map((role) => {
        if (typeof role === "string") return role
        if (role && typeof role === "object") return String(role.name || role.id || "").trim()
        return ""
      })
      .filter(Boolean)
  }

  return []
}

function getRoleIds(member) {
  if (Array.isArray(member?.role_ids) && member.role_ids.length) {
    return member.role_ids.map((value) => String(value || "").trim()).filter(Boolean)
  }

  if (Array.isArray(member?.roles) && member.roles.length) {
    return member.roles
      .map((role) => {
        if (role && typeof role === "object") return String(role.id || "").trim()
        return ""
      })
      .filter(Boolean)
  }

  return []
}

function parseDiscordErrorDetails(message) {
  const raw = String(message || "")
  const statusMatch = raw.match(/Discord API\s+(\d+)/i)
  const status = statusMatch ? Number(statusMatch[1]) : null

  let retryAfter = null
  const jsonStart = raw.indexOf("{")
  if (jsonStart >= 0) {
    try {
      const payload = JSON.parse(raw.slice(jsonStart))
      if (payload && Number.isFinite(Number(payload.retry_after))) {
        retryAfter = Number(payload.retry_after)
      }
    } catch {
      // ignore JSON parse failure
    }
  }

  return {
    status,
    isRateLimited: status === 429 || /rate limit/i.test(raw),
    isMissingMember: status === 404 || /unknown member/i.test(raw),
    retryAfter,
  }
}

function toneForVerification(member) {
  if (member?.has_verified_role) return "low"
  if (member?.has_unverified) return "medium"
  return "open"
}

function labelForVerification(member) {
  if (member?.has_verified_role) return "Verified"
  if (member?.has_unverified) return "Unverified"
  return "Unknown Verification"
}

function normalizeGuildRoles(rows) {
  return Array.isArray(rows)
    ? rows
        .map((role) => ({
          id: String(role?.role_id || role?.id || "").trim(),
          name: String(role?.name || role?.role_name || "").trim(),
          position: Number(role?.position || 0),
          member_count: Number(role?.member_count || 0),
        }))
        .filter((role) => role.id && role.name)
    : []
}

export default function MemberDrawer({ member, onClose, onMemberUpdated }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingLive, setLoadingLive] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [liveMember, setLiveMember] = useState(null)
  const [guildRoles, setGuildRoles] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [modReason, setModReason] = useState("Dashboard moderation action")
  const [timeoutMinutes, setTimeoutMinutes] = useState("10")
  const [rateLimitNotice, setRateLimitNotice] = useState("")
  const [memberMissingOnDiscord, setMemberMissingOnDiscord] = useState(false)

  useEffect(() => {
    setLiveMember(member || null)
    setMessage("")
    setError("")
    setSelectedRoleId("")
    setRateLimitNotice("")
    setMemberMissingOnDiscord(Boolean(member?.discord_unavailable))
  }, [member])

  const sourceMember = getSourceMember(liveMember, member)
  const memberId = getMemberId(sourceMember)
  const displayName = getDisplayName(sourceMember)
  const avatarUrl = sourceMember?.avatar_url || sourceMember?.avatar || null
  const inGuild = sourceMember?.in_guild !== false
  const roleNames = useMemo(() => getRoleNames(sourceMember), [sourceMember])
  const roleIds = useMemo(() => getRoleIds(sourceMember), [sourceMember])

  const assignableRoles = useMemo(() => {
    const assignedIdSet = new Set(roleIds)
    const assignedNameSet = new Set(roleNames.map((name) => name.toLowerCase()))

    return normalizeGuildRoles(guildRoles)
      .filter((role) => role.name !== "@everyone")
      .filter((role) => !assignedIdSet.has(role.id) && !assignedNameSet.has(role.name.toLowerCase()))
      .sort((a, b) => b.position - a.position)
  }, [guildRoles, roleIds, roleNames])

  const selectedRole = useMemo(
    () => assignableRoles.find((role) => role.id === selectedRoleId) || null,
    [assignableRoles, selectedRoleId]
  )

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

  async function loadGuildRoleCatalog({ silent = false } = {}) {
    if (!member) return []

    if (!silent) setLoadingRoles(true)

    try {
      const res = await fetch("/api/dashboard/live", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load role catalog.")
      }

      const nextRoles = normalizeGuildRoles(json?.roles)
      setGuildRoles(nextRoles)
      return nextRoles
    } catch (err) {
      if (!silent) {
        setError((prev) => prev || err?.message || "Failed to load role catalog.")
      }
      return []
    } finally {
      if (!silent) setLoadingRoles(false)
    }
  }

  async function refreshMemberDetails({ silent = false } = {}) {
    if (!memberId) return null

    if (!silent) {
      setLoadingLive(true)
      setError("")
      setMessage("")
    } else {
      setLoadingLive(true)
    }

    try {
      const res = await fetch(`/api/discord/member-details?user_id=${encodeURIComponent(memberId)}`, {
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json?.error || `Failed to load member details (${res.status}).`)
      }

      const nextMember = json?.member || null
      if (nextMember) {
        setLiveMember(nextMember)
        setMemberMissingOnDiscord(Boolean(nextMember?.discord_unavailable))
        setRateLimitNotice("")
        if (typeof onMemberUpdated === "function") {
          onMemberUpdated(nextMember)
        }
      }
      return nextMember
    } catch (err) {
      const details = parseDiscordErrorDetails(err?.message)

      if (details.isMissingMember) {
        setMemberMissingOnDiscord(true)
        setRateLimitNotice("")
      } else if (details.isRateLimited) {
        setMemberMissingOnDiscord(false)
        const waitText = details.retryAfter ? ` Retry after about ${details.retryAfter.toFixed(1)}s.` : ""
        setRateLimitNotice(`Discord rate limited the live refresh. Showing the last good member data instead.${waitText}`)
      } else if (!silent) {
        setMemberMissingOnDiscord(Boolean(sourceMember?.discord_unavailable))
      }

      if (!details.isRateLimited || !silent) {
        setError(err?.message || "Failed to load live member roles.")
      }
      return null
    } finally {
      setLoadingLive(false)
    }
  }

  async function syncMemberNow({ silent = false, successText = "Member sync completed." } = {}) {
    if (!memberId) return null

    setSyncing(true)
    if (!silent) {
      setBusy(true)
      setError("")
      setMessage("")
    }

    try {
      const res = await fetch("/api/discord/member-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: memberId,
          reason: modReason.trim() || "Dashboard member sync",
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json?.error || "Member sync failed.")
      }

      const nextMember = json?.member || null
      if (nextMember) {
        setLiveMember(nextMember)
        setMemberMissingOnDiscord(Boolean(nextMember?.discord_unavailable))
        setRateLimitNotice("")
        if (typeof onMemberUpdated === "function") {
          onMemberUpdated(nextMember)
        }
      }

      if (!silent) {
        setMessage(successText)
      }

      return nextMember
    } catch (err) {
      const details = parseDiscordErrorDetails(err?.message)
      if (details.isRateLimited) {
        const waitText = details.retryAfter ? ` Retry after about ${details.retryAfter.toFixed(1)}s.` : ""
        setRateLimitNotice(`Discord rate limited the sync refresh.${waitText}`)
      } else if (!silent) {
        setError(err?.message || "Member sync failed.")
      }
      return null
    } finally {
      setSyncing(false)
      if (!silent) setBusy(false)
    }
  }

  async function triggerFullRoleSync() {
    setBusy(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/discord/role-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Role sync failed.")
      }

      await syncMemberNow({ silent: true })
      setMessage("Full role sync started and this member was refreshed.")
    } catch (err) {
      setError(err?.message || "Role sync failed.")
    } finally {
      setBusy(false)
    }
  }

  async function runModAction(action, extra = {}) {
    if (!memberId) return

    setBusy(true)
    setError("")
    setMessage("")

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
        throw new Error(json?.error || `${action} failed`)
      }

      if (json?.member) {
        setLiveMember(json.member)
        setMemberMissingOnDiscord(Boolean(json.member?.discord_unavailable))
        setRateLimitNotice(json?.refresh_warning || "")
        if (typeof onMemberUpdated === "function") {
          onMemberUpdated(json.member)
        }
      } else if (["add_role", "remove_role", "timeout", "kick", "ban"].includes(action)) {
        await syncMemberNow({ silent: true })
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
        setSelectedRoleId("")
        setMessage(`Added ${selectedRole?.name || "role"} to ${displayName}.`)
      } else if (action === "remove_role") {
        setMessage(`Removed ${extra.role_name || "role"} from ${displayName}.`)
      }

      await loadGuildRoleCatalog({ silent: true })
    } catch (err) {
      const details = parseDiscordErrorDetails(err?.message)
      if (details.isRateLimited) {
        const waitText = details.retryAfter ? ` Retry after about ${details.retryAfter.toFixed(1)}s.` : ""
        setRateLimitNotice(`Discord rate limited this action refresh.${waitText}`)
      }
      setError(err?.message || "Moderation action failed.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!member) return
      await Promise.all([
        refreshMemberDetails({ silent: true }).catch(() => null),
        loadGuildRoleCatalog({ silent: true }).catch(() => []),
      ])
      if (!cancelled) {
        setLoadingRoles(false)
      }
    }

    setLoadingRoles(true)
    boot()

    return () => {
      cancelled = true
    }
  }, [member?.user_id, member?.id])

  if (!member) return null

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

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
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

        {memberMissingOnDiscord ? (
          <div className="warning-banner" style={{ marginBottom: 12 }}>
            Discord no longer reports this member. Showing the latest stored record.
          </div>
        ) : null}

        {rateLimitNotice ? (
          <div className="warning-banner" style={{ marginBottom: 12 }}>
            {rateLimitNotice}
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
                <img src={avatarUrl} alt={displayName} width="52" height="52" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: "var(--text-strong)", overflowWrap: "anywhere" }}>
                {displayName}
              </div>

              <div className="muted" style={{ overflowWrap: "anywhere", marginTop: 4 }}>
                {(sourceMember?.nickname || member.nickname || "No nickname")} • {memberId || "No user id"}
              </div>

              <div className="member-drawer-badges">
                <span className={`badge ${inGuild ? "claimed" : "closed"}`}>{inGuild ? "In Server" : "Former Member"}</span>
                <span className={`badge ${toneForVerification(sourceMember)}`}>{labelForVerification(sourceMember)}</span>
                <span className={`badge ${sourceMember?.has_staff_role ? "claimed" : "open"}`}>{sourceMember?.has_staff_role ? "Staff" : "Member"}</span>
                {String(sourceMember?.role_state || "").includes("conflict") ? <span className="badge danger">Conflict</span> : null}
              </div>
            </div>
          </div>

          <div className="member-detail-grid" style={{ marginTop: 16 }}>
            <div className="member-detail-item">
              <span className="ticket-info-label">Top Role</span>
              <span>{sourceMember?.top_role || sourceMember?.highest_role_name || "—"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Role State</span>
              <span>{sourceMember?.role_state || "—"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Health</span>
              <span>{sourceMember?.data_health || "—"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Joined</span>
              <span>{formatTime(sourceMember?.joined_at)}</span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Reason</span>
              <span style={{ overflowWrap: "anywhere" }}>{sourceMember?.role_state_reason || "—"}</span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Last Refresh</span>
              <span>{formatTime(sourceMember?.updated_at || sourceMember?.last_seen_at || sourceMember?.synced_at)}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Live Discord Roles</h2>
            <span className="muted" style={{ fontSize: 13 }}>{roleNames.length} assigned</span>
          </div>

          <div className="roles" style={{ marginBottom: 14 }}>
            {roleNames.length ? (
              roleNames.map((roleName, index) => {
                const roleId = roleIds[index] || ""
                return (
                  <button
                    key={`${roleId || roleName}-${index}`}
                    type="button"
                    className="badge"
                    disabled={busy || !inGuild}
                    onClick={() => runModAction("remove_role", { role_id: roleId, role_name: roleName })}
                    title={roleId ? `Remove ${roleName}` : `${roleName} has no stored role id yet`}
                    style={{ cursor: roleId && !busy && inGuild ? "pointer" : "default" }}
                  >
                    {roleName}{roleId ? " ×" : ""}
                  </button>
                )
              })
            ) : (
              <span className="muted">No roles found.</span>
            )}
          </div>

          <div className="space">
            <div className="row" style={{ alignItems: "stretch", gap: 10 }}>
              <select
                className="input"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                disabled={busy || loadingRoles || !assignableRoles.length || !inGuild}
                style={{ flex: 1 }}
              >
                <option value="">
                  {loadingRoles
                    ? "Loading server roles..."
                    : !inGuild
                    ? "Former members cannot receive roles"
                    : assignableRoles.length
                    ? "Add a server role..."
                    : "No assignable roles available"}
                </option>
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="button"
                disabled={busy || !selectedRoleId || !selectedRole || !inGuild}
                onClick={() => runModAction("add_role", { role_id: selectedRoleId, role_name: selectedRole?.name || "" })}
                style={{ width: "auto", minWidth: 120 }}
              >
                Add Role
              </button>
            </div>

            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Tap an assigned role to remove it. Discord permission and hierarchy failures will return exact errors instead of fake success.
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Staff Tools</h2>
            {syncing || loadingLive ? <span className="muted" style={{ fontSize: 13 }}>{syncing ? "Syncing..." : "Refreshing..."}</span> : null}
          </div>

          <div className="member-action-grid" style={{ marginBottom: 12 }}>
            <button className="button" disabled={busy} onClick={() => copyText(memberId, "User ID copied.")}>Copy User ID</button>
            <button className="button" disabled={busy} onClick={() => copyText(buildMention(memberId), "Mention copied.")}>Copy Mention</button>
            <button className="button" disabled={busy || !memberId} onClick={() => syncMemberNow()}>Sync Member Now</button>
            <button className="button" disabled={busy} onClick={triggerFullRoleSync}>Run Role Sync</button>
            <button className="button" disabled={busy} onClick={() => copyText(memberId, "User ID copied. Paste it into ticket search.")}>Prep Ticket Search</button>
            <button
              className="button"
              disabled={busy}
              onClick={() => copyText([
                `Member: ${displayName}`,
                `User ID: ${memberId || "unknown"}`,
                `Status: ${inGuild ? "In Server" : "Left / Removed"}`,
                `Role State: ${sourceMember?.role_state || "unknown"}`,
                `Health: ${sourceMember?.data_health || "unknown"}`,
                `Top Role: ${sourceMember?.top_role || sourceMember?.highest_role_name || "none"}`,
                `Live Roles: ${roleNames.join(", ") || "none"}`,
              ].join("\n"), "Staff summary copied.")}
            >
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
              <button className="button" disabled={busy || !memberId} onClick={() => runModAction("timeout")} style={{ width: "auto", minWidth: 120 }}>
                Timeout
              </button>
            </div>

            <div className="member-action-grid">
              <button className="button" disabled={busy || !memberId} onClick={() => runModAction("warn")}>Warn</button>
              <button className="button danger" disabled={busy || !memberId} onClick={() => runModAction("kick")}>Kick</button>
              <button className="button danger" disabled={busy || !memberId} onClick={() => runModAction("ban")}>Ban</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
