"use client";

import { useMemo, useState } from "react";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

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

function timeAgo(value) {
  if (!value) return "—";
  try {
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) return "—";
    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

function initials(value) {
  const raw = String(value || "?").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean).slice(0, 2);
  return (
    parts.map((part) => part[0]?.toUpperCase() || "").join("") ||
    raw.slice(0, 1).toUpperCase()
  );
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

function getRoleLabel(member) {
  return (
    member?.top_role ||
    member?.highest_role_name ||
    (Array.isArray(member?.role_names) && member.role_names[0]) ||
    "No top role"
  );
}

function getJoinTone(member) {
  if (member?.in_guild === false) return "closed";
  if (String(member?.role_state || "").toLowerCase().includes("conflict")) {
    return "danger";
  }
  if (member?.has_verified_role) return "low";
  if (member?.has_unverified) return "medium";
  return "open";
}

function getJoinStateLabel(member) {
  if (member?.in_guild === false) return "Former";
  if (String(member?.role_state || "").toLowerCase().includes("conflict")) {
    return "Conflict";
  }
  if (member?.has_verified_role) return "Verified";
  if (member?.has_unverified) return "Pending";
  return safeText(member?.role_state, "Tracked");
}

function filterJoin(member, mode) {
  if (mode === "all") return true;
  if (mode === "verified") return !!member?.has_verified_role;
  if (mode === "pending") return !!member?.has_unverified;
  if (mode === "conflict") {
    return String(member?.role_state || "").toLowerCase().includes("conflict");
  }
  if (mode === "former") return member?.in_guild === false;
  return true;
}

export default function RecentJoinsCard({ joins = [] }) {
  const [filterMode, setFilterMode] = useState("all");
  const [expandedId, setExpandedId] = useState("");

  const rows = useMemo(() => safeArray(joins), [joins]);

  const filtered = useMemo(
    () => rows.filter((row) => filterJoin(row, filterMode)),
    [rows, filterMode]
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const verified = rows.filter((row) => !!row?.has_verified_role).length;
    const pending = rows.filter((row) => !!row?.has_unverified).length;
    const conflicts = rows.filter((row) =>
      String(row?.role_state || "").toLowerCase().includes("conflict")
    ).length;
    const former = rows.filter((row) => row?.in_guild === false).length;

    return { total, verified, pending, conflicts, former };
  }, [rows]);

  return (
    <div className="card recent-joins-shell">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Recent Joins Review</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Quick triage surface for fresh entrants, pending verification, and suspicious member state.
          </div>
        </div>

        <div className="joins-filter-row">
          <button
            type="button"
            className={filterMode === "all" ? "button" : "button ghost"}
            onClick={() => setFilterMode("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filterMode === "pending" ? "button" : "button ghost"}
            onClick={() => setFilterMode("pending")}
          >
            Pending
          </button>
          <button
            type="button"
            className={filterMode === "verified" ? "button" : "button ghost"}
            onClick={() => setFilterMode("verified")}
          >
            Verified
          </button>
          <button
            type="button"
            className={filterMode === "conflict" ? "button danger" : "button ghost"}
            onClick={() => setFilterMode("conflict")}
          >
            Conflict
          </button>
        </div>
      </div>

      <div className="joins-summary-grid">
        <div className="joins-summary-card">
          <div className="ticket-info-label">Tracked</div>
          <div className="joins-summary-value">{stats.total}</div>
        </div>
        <div className="joins-summary-card low">
          <div className="ticket-info-label">Verified</div>
          <div className="joins-summary-value">{stats.verified}</div>
        </div>
        <div className="joins-summary-card medium">
          <div className="ticket-info-label">Pending</div>
          <div className="joins-summary-value">{stats.pending}</div>
        </div>
        <div className="joins-summary-card danger">
          <div className="ticket-info-label">Conflicts</div>
          <div className="joins-summary-value">{stats.conflicts}</div>
        </div>
        <div className="joins-summary-card">
          <div className="ticket-info-label">Former</div>
          <div className="joins-summary-value">{stats.former}</div>
        </div>
      </div>

      {!filtered.length ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          No recent join records match the current filter.
        </div>
      ) : (
        <div className="space recent-joins-list" style={{ marginTop: 14 }}>
          {filtered.map((member, index) => {
            const userId = String(member?.user_id || `join-${index}`);
            const expanded = expandedId === userId;
            const displayName = getDisplayName(member);
            const avatarUrl = member?.avatar_url || "";
            const roleLabel = getRoleLabel(member);

            return (
              <div
                key={userId}
                className={`recent-join-card premium ${expanded ? "expanded" : ""}`}
              >
                <button
                  type="button"
                  className="recent-join-toggle"
                  onClick={() =>
                    setExpandedId((prev) => (prev === userId ? "" : userId))
                  }
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "nowrap",
                    }}
                  >
                    <div
                      className="row"
                      style={{ minWidth: 0, flex: 1, gap: 12, alignItems: "center" }}
                    >
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
                          initials(displayName)
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="recent-join-name">{displayName}</div>
                        <div className="recent-join-id">{safeText(member?.user_id)}</div>
                      </div>
                    </div>

                    <div className="recent-join-time">
                      {timeAgo(member?.joined_at || member?.created_at)}
                    </div>
                  </div>

                  <div className="recent-join-badges">
                    <span className={`badge ${getJoinTone(member)}`}>
                      {getJoinStateLabel(member)}
                    </span>
                    <span className="badge">{roleLabel}</span>
                    {member?.has_staff_role ? (
                      <span className="badge claimed">Staff</span>
                    ) : null}
                    {member?.source === "guild_members_fallback" ? (
                      <span className="badge">Live Fallback</span>
                    ) : null}
                  </div>
                </button>

                {expanded ? (
                  <div className="recent-join-expand">
                    <div className="member-detail-grid">
                      <div className="member-detail-item">
                        <span className="ticket-info-label">Joined</span>
                        <span>{formatDateTime(member?.joined_at || member?.created_at)}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Updated</span>
                        <span>{formatDateTime(member?.updated_at || member?.last_seen_at)}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Role State</span>
                        <span>{safeText(member?.role_state)}</span>
                      </div>

                      <div className="member-detail-item">
                        <span className="ticket-info-label">Top Role</span>
                        <span>{safeText(roleLabel)}</span>
                      </div>

                      <div className="member-detail-item full">
                        <span className="ticket-info-label">State Reason</span>
                        <span>{safeText(member?.role_state_reason, "No extra notes.")}</span>
                      </div>
                    </div>

                    {Array.isArray(member?.role_names) && member.role_names.length ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="ticket-info-label" style={{ marginBottom: 8 }}>
                          Role Preview
                        </div>
                        <div className="roles">
                          {member.role_names.slice(0, 8).map((roleName) => (
                            <span key={`${userId}-${roleName}`} className="badge">
                              {roleName}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .recent-joins-shell {
          overflow: visible;
        }

        .recent-joins-list {
          overflow: visible;
        }

        .joins-filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          width: 100%;
          max-width: 420px;
        }

        .joins-filter-row :global(button) {
          width: auto !important;
          min-width: 0 !important;
        }

        .joins-summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .joins-summary-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
          border-radius: 16px;
          padding: 12px;
          min-width: 0;
        }

        .joins-summary-card.low {
          background: rgba(74, 222, 128, 0.08);
          border-color: rgba(74, 222, 128, 0.18);
        }

        .joins-summary-card.medium {
          background: rgba(251, 191, 36, 0.08);
          border-color: rgba(251, 191, 36, 0.18);
        }

        .joins-summary-card.danger {
          background: rgba(248, 113, 113, 0.08);
          border-color: rgba(248, 113, 113, 0.2);
        }

        .joins-summary-value {
          margin-top: 6px;
          font-size: 22px;
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .recent-join-card.premium {
          border-radius: 22px;
          padding: 14px;
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.06), transparent 36%),
            rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: visible;
        }

        .recent-join-card.expanded {
          background:
            radial-gradient(circle at top right, rgba(99, 213, 255, 0.08), transparent 36%),
            rgba(99, 213, 255, 0.05);
          border-color: rgba(99, 213, 255, 0.18);
          box-shadow: 0 0 18px rgba(99, 213, 255, 0.08);
        }

        .recent-join-toggle {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          width: 100%;
          padding: 0;
          margin: 0;
          text-align: left;
          color: inherit;
          cursor: pointer;
        }

        .recent-join-name,
        .recent-join-id,
        .recent-join-time {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .recent-join-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .recent-join-expand {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          overflow: visible;
        }

        @media (max-width: 860px) {
          .joins-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .joins-filter-row {
            max-width: none;
          }

          .joins-filter-row :global(button) {
            flex: 1 1 calc(50% - 8px);
          }
        }

        @media (max-width: 560px) {
          .joins-summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .recent-join-time {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
