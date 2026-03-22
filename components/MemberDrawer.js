"use client";

import { useEffect, useMemo, useState } from "react";

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function getDisplayName(member) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.user_id ||
    "Unknown Member"
  );
}

function getAvatar(member) {
  return String(member?.avatar_url || "").trim() || "";
}

function initials(value) {
  const raw = String(value || "?").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || raw.slice(0, 1).toUpperCase();
}

function getRoleNames(member) {
  if (Array.isArray(member?.role_names) && member.role_names.length) {
    return member.role_names.filter(Boolean);
  }

  if (Array.isArray(member?.roles) && member.roles.length) {
    return member.roles
      .map((role) => {
        if (typeof role === "string") return role;
        if (role && typeof role === "object") return role.name || null;
        return null;
      })
      .filter(Boolean);
  }

  return [];
}

function getStateTone(member) {
  if (member?.in_guild === false) return "closed";
  if (member?.has_staff_role) return "claimed";
  if (member?.has_verified_role) return "low";
  if (member?.has_unverified) return "medium";
  if (String(member?.role_state || "").toLowerCase().includes("conflict")) return "danger";
  return "open";
}

function getStateLabel(member) {
  if (member?.in_guild === false) return "Former";
  if (member?.has_staff_role) return "Staff";
  if (member?.has_verified_role) return "Verified";
  if (member?.has_unverified) return "Unverified";
  return safeText(member?.role_state, "Tracked");
}

function buildMemberSummary(member) {
  const roles = getRoleNames(member);
  return [
    `Member: ${getDisplayName(member)}`,
    `User ID: ${safeText(member?.user_id || member?.id)}`,
    `Username: ${safeText(member?.username)}`,
    `Display Name: ${safeText(member?.display_name)}`,
    `Nickname: ${safeText(member?.nickname)}`,
    `State: ${safeText(member?.role_state)}`,
    `Top Role: ${safeText(member?.top_role || member?.highest_role_name)}`,
    `Joined: ${formatDateTime(member?.joined_at)}`,
    `Updated: ${formatDateTime(member?.updated_at || member?.last_seen_at)}`,
    `Roles: ${roles.length ? roles.join(", ") : "None"}`,
  ].join("\n");
}

function SectionAccordion({ title, subtitle, badge, open, onToggle, children, danger = false }) {
  return (
    <div className={`drawer-accordion ${open ? "open" : ""} ${danger ? "danger" : ""}`}>
      <button type="button" className="drawer-accordion-head" onClick={onToggle}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="drawer-accordion-title">{title}</div>
          {subtitle ? <div className="muted drawer-accordion-copy">{subtitle}</div> : null}
        </div>

        <div className="drawer-accordion-side">
          {badge}
          <span className={`drawer-chevron ${open ? "open" : ""}`}>⌄</span>
        </div>
      </button>

      {open ? <div className="drawer-accordion-body">{children}</div> : null}
    </div>
  );
}

function QuickActionButton({ label, onClick, busy, danger = false }) {
  return (
    <button
      type="button"
      className={danger ? "button danger" : "button ghost"}
      onClick={onClick}
      disabled={!!busy}
    >
      {busy ? "Working..." : label}
    </button>
  );
}

export default function MemberDrawer({
  member,
  onClose,
  onMemberUpdated,
}) {
  const [openPanels, setOpenPanels] = useState({
    overview: true,
    roles: false,
    moderation: true,
    identity: false,
    history: false,
  });

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("Dashboard moderation action");
  const [timeoutMinutes, setTimeoutMinutes] = useState("10");

  const displayName = useMemo(() => getDisplayName(member), [member]);
  const avatarUrl = useMemo(() => getAvatar(member), [member]);
  const roleNames = useMemo(() => getRoleNames(member), [member]);
  const userId = String(member?.user_id || member?.id || "").trim();

  useEffect(() => {
    if (!member) return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    function handleKey(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      window.removeEventListener("keydown", handleKey);
    };
  }, [member, onClose]);

  if (!member) return null;

  function togglePanel(name) {
    setOpenPanels((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      setError("");
      setMessage(successMessage);
    } catch {
      setError("Could not copy on this device.");
    }
  }

  async function refreshLiveMember() {
    if (!userId) return;

    setBusy("refresh");
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/discord/member-details?user_id=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to refresh member.");
      }

      if (json?.member && onMemberUpdated) {
        onMemberUpdated(json.member);
      }

      setMessage("Member refreshed.");
    } catch (err) {
      setError(err?.message || "Failed to refresh member.");
    } finally {
      setBusy("");
    }
  }

  async function runAction(action, payload = {}) {
    if (!userId) return;

    setBusy(action);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/dashboard/mod-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          action,
          payload: {
            user_id: userId,
            reason: String(reason || "").trim(),
            minutes: Number(timeoutMinutes || 10),
            ...payload,
          },
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to queue action.");
      }

      setMessage(
        action === "timeout_member"
          ? `Timeout queued for ${displayName}.`
          : action === "remove_timeout"
            ? `Timeout removal queued for ${displayName}.`
            : action === "mute_member"
              ? `Voice mute queued for ${displayName}.`
              : action === "disconnect_member"
                ? `Voice disconnect queued for ${displayName}.`
                : action === "strip_roles"
                  ? `Role strip queued for ${displayName}.`
                  : `Action queued for ${displayName}.`
      );

      await refreshLiveMember();
    } catch (err) {
      setError(err?.message || "Failed to queue action.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="member-drawer-overlay" onClick={onClose}>
      <div className="member-drawer-shell" onClick={(e) => e.stopPropagation()}>
        <div className="member-drawer-handle" />

        <div className="member-drawer-top">
          <div className="row" style={{ minWidth: 0, flex: 1, gap: 12, alignItems: "center" }}>
            <div className="avatar member-drawer-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  width="54"
                  height="54"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials(displayName)
              )}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="member-drawer-name">{displayName}</div>
              <div className="muted member-drawer-id">
                {safeText(userId, "No user id")}
              </div>

              <div className="member-drawer-badges">
                <span className={`badge ${getStateTone(member)}`}>{getStateLabel(member)}</span>
                <span className={`badge ${member?.in_guild === false ? "closed" : "claimed"}`}>
                  {member?.in_guild === false ? "Former" : "In Server"}
                </span>
                {String(member?.role_state || "").toLowerCase().includes("conflict") ? (
                  <span className="badge danger">Conflict</span>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 110 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
        {message ? <div className="info-banner">{message}</div> : null}

        <div className="member-drawer-primary-actions">
          <button
            type="button"
            className="button primary"
            disabled={!!busy}
            onClick={refreshLiveMember}
          >
            {busy === "refresh" ? "Refreshing..." : "Refresh Member"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={!!busy}
            onClick={() => copyText(userId, "User ID copied.")}
          >
            Copy User ID
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={!!busy}
            onClick={() => copyText(`<@${userId}>`, "Mention copied.")}
          >
            Copy Mention
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={!!busy}
            onClick={() => copyText(buildMemberSummary(member), "Member summary copied.")}
          >
            Copy Summary
          </button>
        </div>

        <SectionAccordion
          title="Overview"
          subtitle="Current state, top role, and latest tracked member snapshot."
          badge={<span className="badge open">Info</span>}
          open={openPanels.overview}
          onToggle={() => togglePanel("overview")}
        >
          <div className="member-drawer-grid">
            <div className="member-detail-item">
              <span className="ticket-info-label">Username</span>
              <span>{safeText(member?.username)}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Nickname</span>
              <span>{safeText(member?.nickname)}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Top Role</span>
              <span>{safeText(member?.top_role || member?.highest_role_name)}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Role State</span>
              <span>{safeText(member?.role_state)}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Joined</span>
              <span>{formatDateTime(member?.joined_at)}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Updated</span>
              <span>{formatDateTime(member?.updated_at || member?.last_seen_at)}</span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">State Reason</span>
              <span>{safeText(member?.role_state_reason, "No extra notes.")}</span>
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion
          title="Moderation"
          subtitle="Fast one-hand moderation tools without leaving the member sheet."
          badge={<span className="badge claimed">Quick Actions</span>}
          open={openPanels.moderation}
          onToggle={() => togglePanel("moderation")}
        >
          <div className="member-drawer-form-grid">
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
            />

            <input
              className="input"
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(e.target.value)}
              placeholder="Timeout minutes"
              inputMode="numeric"
            />
          </div>

          <div className="member-drawer-action-grid">
            <QuickActionButton
              label="Timeout"
              busy={busy === "timeout_member"}
              onClick={() => runAction("timeout_member")}
            />

            <QuickActionButton
              label="Remove Timeout"
              busy={busy === "remove_timeout"}
              onClick={() => runAction("remove_timeout")}
            />

            <QuickActionButton
              label="Mute VC"
              busy={busy === "mute_member"}
              onClick={() => runAction("mute_member")}
            />

            <QuickActionButton
              label="Disconnect VC"
              busy={busy === "disconnect_member"}
              onClick={() => runAction("disconnect_member")}
            />

            <QuickActionButton
              label="Strip Roles"
              busy={busy === "strip_roles"}
              onClick={() => runAction("strip_roles")}
              danger
            />
          </div>
        </SectionAccordion>

        <SectionAccordion
          title="Roles"
          subtitle="Tracked role preview for quick context."
          badge={<span className="badge">{roleNames.length} Roles</span>}
          open={openPanels.roles}
          onToggle={() => togglePanel("roles")}
        >
          {roleNames.length ? (
            <div className="roles">
              {roleNames.map((roleName) => (
                <span key={roleName} className="badge">
                  {roleName}
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state">No tracked roles found.</div>
          )}
        </SectionAccordion>

        <SectionAccordion
          title="Identity History"
          subtitle="Useful when members change names or come back later."
          badge={<span className="badge medium">History</span>}
          open={openPanels.identity}
          onToggle={() => togglePanel("identity")}
        >
          <div className="member-drawer-grid">
            <div className="member-detail-item full">
              <span className="ticket-info-label">Previous Usernames</span>
              <span>
                {Array.isArray(member?.previous_usernames) && member.previous_usernames.length
                  ? member.previous_usernames.join(", ")
                  : "None"}
              </span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Previous Display Names</span>
              <span>
                {Array.isArray(member?.previous_display_names) && member.previous_display_names.length
                  ? member.previous_display_names.join(", ")
                  : "None"}
              </span>
            </div>

            <div className="member-detail-item full">
              <span className="ticket-info-label">Previous Nicknames</span>
              <span>
                {Array.isArray(member?.previous_nicknames) && member.previous_nicknames.length
                  ? member.previous_nicknames.join(", ")
                  : "None"}
              </span>
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion
          title="Timestamps"
          subtitle="Tracked join, sync, departure, and rejoin timing."
          badge={<span className="badge open">Timeline</span>}
          open={openPanels.history}
          onToggle={() => togglePanel("history")}
        >
          <div className="member-drawer-grid">
            <div className="member-detail-item">
              <span className="ticket-info-label">Joined</span>
              <span>{formatDateTime(member?.joined_at)}</span>
            </div>
            <div className="member-detail-item">
              <span className="ticket-info-label">Synced</span>
              <span>{formatDateTime(member?.synced_at)}</span>
            </div>
            <div className="member-detail-item">
              <span className="ticket-info-label">Last Seen</span>
              <span>{formatDateTime(member?.last_seen_at)}</span>
            </div>
            <div className="member-detail-item">
              <span className="ticket-info-label">Left At</span>
              <span>{formatDateTime(member?.left_at)}</span>
            </div>
            <div className="member-detail-item">
              <span className="ticket-info-label">Rejoined At</span>
              <span>{formatDateTime(member?.rejoined_at)}</span>
            </div>
          </div>
        </SectionAccordion>

        <style jsx>{`
          .member-drawer-overlay {
            position: fixed;
            inset: 0;
            z-index: 180;
            background: rgba(0, 0, 0, 0.62);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 10px 8px calc(10px + env(safe-area-inset-bottom, 0px));
          }

          .member-drawer-shell {
            width: 100%;
            max-width: 900px;
            max-height: 94vh;
            overflow-y: auto;
            border-radius: 28px;
            border: 1px solid rgba(255,255,255,0.10);
            background:
              radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
              radial-gradient(circle at bottom left, rgba(178,109,255,0.08), transparent 26%),
              linear-gradient(180deg, rgba(18,30,42,0.98), rgba(7,14,24,0.98));
            box-shadow: 0 20px 60px rgba(0,0,0,0.40);
            padding: 14px;
          }

          .member-drawer-handle {
            width: 52px;
            height: 5px;
            border-radius: 999px;
            background: rgba(255,255,255,0.18);
            margin: 0 auto 14px;
          }

          .member-drawer-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 14px;
          }

          .member-drawer-avatar {
            width: 54px;
            height: 54px;
            flex: 0 0 54px;
          }

          .member-drawer-name {
            font-weight: 900;
            font-size: 24px;
            line-height: 1.04;
            letter-spacing: -0.04em;
            color: var(--text-strong, #f8fafc);
            overflow-wrap: anywhere;
          }

          .member-drawer-id {
            margin-top: 6px;
            font-size: 13px;
            overflow-wrap: anywhere;
          }

          .member-drawer-badges {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
          }

          .member-drawer-primary-actions {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 12px;
          }

          .drawer-accordion {
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 20px;
            overflow: hidden;
            background:
              radial-gradient(circle at top right, rgba(99,213,255,0.04), transparent 34%),
              rgba(255,255,255,0.02);
            margin-bottom: 12px;
          }

          .drawer-accordion.danger {
            border-color: rgba(248,113,113,0.18);
            background:
              radial-gradient(circle at top right, rgba(248,113,113,0.06), transparent 34%),
              rgba(255,255,255,0.02);
          }

          .drawer-accordion.open {
            box-shadow: 0 0 18px rgba(99,213,255,0.06);
          }

          .drawer-accordion-head {
            appearance: none;
            -webkit-appearance: none;
            width: 100%;
            border: 0;
            background: transparent;
            color: inherit;
            text-align: left;
            padding: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            cursor: pointer;
          }

          .drawer-accordion-title {
            font-weight: 900;
            color: var(--text-strong, #f8fafc);
            line-height: 1.08;
            letter-spacing: -0.02em;
          }

          .drawer-accordion-copy {
            margin-top: 6px;
            font-size: 13px;
            line-height: 1.45;
          }

          .drawer-accordion-side {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          .drawer-chevron {
            font-size: 22px;
            line-height: 1;
            transition: transform 0.16s ease;
          }

          .drawer-chevron.open {
            transform: rotate(180deg);
          }

          .drawer-accordion-body {
            padding: 0 14px 14px;
            display: grid;
            gap: 12px;
          }

          .member-drawer-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .member-drawer-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .member-drawer-action-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          @media (max-width: 860px) {
            .member-drawer-primary-actions,
            .member-drawer-grid,
            .member-drawer-form-grid,
            .member-drawer-action-grid {
              grid-template-columns: 1fr;
            }

            .member-drawer-shell {
              border-radius: 24px;
              padding: 12px;
            }

            .member-drawer-name {
              font-size: 22px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
