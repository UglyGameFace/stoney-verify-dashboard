"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getMemberName(member) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.user_id ||
    "Unknown Member"
  );
}

function getMemberAvatar(member) {
  return normalizeText(member?.avatar_url) || null;
}

function getRoleCount(member) {
  const roles = safeArray(
    member?.role_names || member?.roles || member?.role_ids
  );
  return roles.length;
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function formatCompactDateTime(value) {
  if (!value) return "Unknown";
  try {
    const date = new Date(value);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return "Unknown";
  }
}

function initialsFromName(name) {
  const cleaned = safeText(name, "U");
  const parts = cleaned.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "U";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

function getMemberState(member) {
  if (member?.in_guild === false) return "Former";
  if (member?.has_staff_role) return "Staff";
  if (member?.has_verified_role) return "Verified";
  if (member?.has_unverified) return "Pending";
  return safeText(member?.role_state, "Tracked");
}

function getStateTone(member) {
  if (member?.in_guild === false) return "closed";
  if (member?.has_staff_role) return "claimed";
  if (member?.has_verified_role) return "low";
  if (member?.has_unverified) return "medium";
  return "open";
}

function getSortTimestamp(member) {
  return new Date(
    member?.updated_at || member?.last_seen_at || member?.joined_at || 0
  ).getTime();
}

function memberMatchesQuery(member, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    member?.display_name,
    member?.nickname,
    member?.username,
    member?.user_id,
    ...(safeArray(member?.role_names)),
    ...(safeArray(member?.previous_usernames)),
    ...(safeArray(member?.previous_display_names)),
    ...(safeArray(member?.previous_nicknames)),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function memberMatchesFilter(member, filter) {
  if (filter === "all") return true;
  if (filter === "active") return member?.in_guild !== false;
  if (filter === "former") return member?.in_guild === false;
  if (filter === "staff") return !!member?.has_staff_role;
  if (filter === "verified") return !!member?.has_verified_role;
  if (filter === "pending") return !!member?.has_unverified;
  return true;
}

function sortMembers(rows, mode) {
  const list = [...rows];

  list.sort((a, b) => {
    if (mode === "recent") {
      return getSortTimestamp(b) - getSortTimestamp(a);
    }

    if (mode === "roles") {
      return getRoleCount(b) - getRoleCount(a);
    }

    return getMemberName(a).localeCompare(getMemberName(b));
  });

  return list;
}

function MemberCard({ member, onSelect }) {
  const name = getMemberName(member);
  const avatar = getMemberAvatar(member);
  const state = getMemberState(member);
  const tone = getStateTone(member);

  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      className="member-card-button"
      style={{
        textAlign: "left",
        width: "100%",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 18,
        padding: 12,
        color: "var(--text-strong, #f8fafc)",
        cursor: "pointer",
      }}
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
          style={{
            minWidth: 0,
            flex: 1,
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="avatar">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                width="38"
                height="38"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              initialsFromName(name)
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 800,
                overflowWrap: "anywhere",
                lineHeight: 1.15,
                color: "var(--text-strong, #f8fafc)",
              }}
            >
              {name}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                overflowWrap: "anywhere",
                color: "var(--text-muted, rgba(255,255,255,0.72))",
              }}
            >
              {safeText(member?.user_id, "No member ID")}
            </div>
          </div>
        </div>

        <span className={`badge ${tone}`}>{state}</span>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div className="member-detail-item">
          <span className="ticket-info-label">Top Role</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {safeText(member?.top_role || member?.highest_role_name, "None")}
          </span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Roles</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {getRoleCount(member)}
          </span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Joined</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {formatCompactDateTime(member?.joined_at)}
          </span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Updated</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {formatCompactDateTime(
              member?.updated_at || member?.last_seen_at || member?.synced_at
            )}
          </span>
        </div>
      </div>

      {member?.role_state_reason ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--text-muted, rgba(255,255,255,0.72))",
          }}
        >
          {member.role_state_reason}
        </div>
      ) : null}
    </button>
  );
}

function MemberDrawerInner({ member, onClose }) {
  const name = getMemberName(member);
  const avatar = getMemberAvatar(member);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.58)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "16px 12px calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(19,32,49,0.98), rgba(17,26,41,0.98))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          color: "var(--text-strong, #f8fafc)",
          padding: 16,
        }}
      >
        <div
          style={{
            width: 42,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            margin: "0 auto 14px",
          }}
        />

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            className="row"
            style={{
              alignItems: "center",
              gap: 12,
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              className="avatar"
              style={{ width: 52, height: 52, fontSize: 16 }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  width="52"
                  height="52"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                initialsFromName(name)
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 20,
                  lineHeight: 1.15,
                  overflowWrap: "anywhere",
                }}
              >
                {name}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "var(--text-muted, rgba(255,255,255,0.72))",
                  overflowWrap: "anywhere",
                }}
              >
                {safeText(member?.user_id, "No member ID")}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 100 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span className={`badge ${getStateTone(member)}`}>
            {getMemberState(member)}
          </span>
          <span className={`badge ${member?.in_guild === false ? "closed" : "low"}`}>
            {member?.in_guild === false ? "Former" : "In Server"}
          </span>
          <span className={`badge ${member?.has_verified_role ? "low" : "medium"}`}>
            {member?.has_verified_role ? "Verified" : "Not Verified"}
          </span>
          <span className={`badge ${member?.has_staff_role ? "claimed" : "open"}`}>
            {member?.has_staff_role ? "Staff" : "Member"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div className="member-detail-item">
            <span className="ticket-info-label">Display Name</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeText(member?.display_name, "Unknown")}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Username</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeText(member?.username, "Unknown")}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Nickname</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeText(member?.nickname, "None")}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Top Role</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeText(member?.top_role || member?.highest_role_name, "None")}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Role Count</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {getRoleCount(member)}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Role State</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeText(member?.role_state, "unknown")}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Joined</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {formatDateTime(member?.joined_at)}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Updated</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {formatDateTime(
                member?.updated_at || member?.last_seen_at || member?.synced_at
              )}
            </span>
          </div>

          <div className="member-detail-item">
            <span className="ticket-info-label">Last Seen</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {formatDateTime(member?.last_seen_at)}
            </span>
          </div>
        </div>

        {member?.role_state_reason ? (
          <div className="member-detail-item" style={{ marginBottom: 12 }}>
            <span className="ticket-info-label">Reason</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {member.role_state_reason}
            </span>
          </div>
        ) : null}

        <div className="member-detail-item" style={{ marginBottom: 12 }}>
          <span className="ticket-info-label">Current Roles</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {safeArray(member?.role_names).length
              ? safeArray(member.role_names).join(", ")
              : "No roles tracked"}
          </span>
        </div>

        {safeArray(member?.previous_usernames).length ? (
          <div className="member-detail-item" style={{ marginBottom: 12 }}>
            <span className="ticket-info-label">Previous Usernames</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeArray(member.previous_usernames).join(", ")}
            </span>
          </div>
        ) : null}

        {safeArray(member?.previous_display_names).length ? (
          <div className="member-detail-item" style={{ marginBottom: 12 }}>
            <span className="ticket-info-label">Previous Display Names</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeArray(member.previous_display_names).join(", ")}
            </span>
          </div>
        ) : null}

        {safeArray(member?.previous_nicknames).length ? (
          <div className="member-detail-item">
            <span className="ticket-info-label">Previous Nicknames</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeArray(member.previous_nicknames).join(", ")}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MemberDrawer({ member, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!member || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <MemberDrawerInner member={member} onClose={onClose} />,
    document.body
  );
}

export default function MemberSnapshot({ members = [] }) {
  const safeMembers = safeArray(members);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("active");
  const [sortMode, setSortMode] = useState("recent");
  const [selected, setSelected] = useState(null);
  const [showFormer, setShowFormer] = useState(false);

  const summary = useMemo(() => {
    const total = safeMembers.length;
    const active = safeMembers.filter((m) => m?.in_guild !== false).length;
    const former = safeMembers.filter((m) => m?.in_guild === false).length;
    const staff = safeMembers.filter((m) => !!m?.has_staff_role).length;
    const verified = safeMembers.filter((m) => !!m?.has_verified_role).length;
    const pending = safeMembers.filter((m) => !!m?.has_unverified).length;

    return { total, active, former, staff, verified, pending };
  }, [safeMembers]);

  const filteredMembers = useMemo(() => {
    let rows = safeMembers.filter(
      (member) =>
        memberMatchesQuery(member, query) && memberMatchesFilter(member, stateFilter)
    );

    return sortMembers(rows, sortMode);
  }, [safeMembers, query, stateFilter, sortMode]);

  const activeRows = useMemo(
    () => filteredMembers.filter((member) => member?.in_guild !== false).slice(0, 40),
    [filteredMembers]
  );

  const formerRows = useMemo(
    () => filteredMembers.filter((member) => member?.in_guild === false),
    [filteredMembers]
  );

  const visibleFormerRows = useMemo(
    () => (showFormer ? formerRows.slice(0, 40) : formerRows.slice(0, 8)),
    [formerRows, showFormer]
  );

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div className="member-detail-item">
          <span className="ticket-info-label">Total</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>{summary.total}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Active</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>{summary.active}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Former</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>{summary.former}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Staff</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>{summary.staff}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Verified</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>{summary.verified}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Pending</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>{summary.pending}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <input
          className="input"
          placeholder="Search members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ color: "var(--text-strong, #f8fafc)" }}
        />

        <select
          className="input"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          style={{ color: "var(--text-strong, #f8fafc)" }}
        >
          <option value="active">Active members</option>
          <option value="all">All members</option>
          <option value="former">Former only</option>
          <option value="staff">Staff only</option>
          <option value="verified">Verified only</option>
          <option value="pending">Pending only</option>
        </select>

        <select
          className="input"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          style={{ color: "var(--text-strong, #f8fafc)" }}
        >
          <option value="recent">Recently updated</option>
          <option value="name">Name</option>
          <option value="roles">Role count</option>
        </select>
      </div>

      {!filteredMembers.length ? (
        <div className="empty-state">
          No member records matched your current filters.
        </div>
      ) : (
        <>
          {activeRows.length ? (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 800, color: "var(--text-strong, #f8fafc)" }}>
                  Active Members
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted, rgba(255,255,255,0.72))",
                  }}
                >
                  Showing {activeRows.length} active record{activeRows.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="space">
                {activeRows.map((member, index) => (
                  <MemberCard
                    key={`${member?.user_id || "active"}-${index}`}
                    member={member}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {formerRows.length ? (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "var(--text-strong, #f8fafc)" }}>
                    Former Members
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: "var(--text-muted, rgba(255,255,255,0.72))",
                    }}
                  >
                    Archived separately so they do not take over the live roster
                  </div>
                </div>

                <button
                  type="button"
                  className="button ghost"
                  style={{ width: "auto", minWidth: 130 }}
                  onClick={() => setShowFormer((prev) => !prev)}
                >
                  {showFormer ? "Show Fewer" : `Show More (${formerRows.length})`}
                </button>
              </div>

              <div className="space">
                {visibleFormerRows.map((member, index) => (
                  <MemberCard
                    key={`${member?.user_id || "former"}-${index}`}
                    member={member}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </>
  );
}
