"use client";

import { useMemo, useState } from "react";

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
  const roles = safeArray(member?.role_names || member?.roles || member?.role_ids);
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
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
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
      style={{
        textAlign: "left",
        width: "100%",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 18,
        padding: 12,
        color: "var(--text-strong, #f8fafc)",
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

    return {
      total,
      active,
      former,
      staff,
      verified,
      pending,
    };
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
                <div
                  style={{
                    fontWeight: 800,
                    color: "var(--text-strong, #f8fafc)",
                  }}
                >
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
                  <div
                    style={{
                      fontWeight: 800,
                      color: "var(--text-strong, #f8fafc)",
                    }}
                  >
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

      {selected ? (
        <div
          style={{
            marginTop: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 20,
            padding: 16,
            color: "var(--text-strong, #f8fafc)",
          }}
        >
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 18,
                  color: "var(--text-strong, #f8fafc)",
                }}
              >
                {getMemberName(selected)}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "var(--text-muted, rgba(255,255,255,0.72))",
                }}
              >
                {safeText(selected?.user_id, "No member ID")}
              </div>
            </div>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 110 }}
              onClick={() => setSelected(null)}
            >
              Close
            </button>
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
                {safeText(selected?.display_name, "Unknown")}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Username</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {safeText(selected?.username, "Unknown")}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Nickname</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {safeText(selected?.nickname, "None")}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">State</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {safeText(selected?.role_state, "unknown")}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">In Guild</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {selected?.in_guild === false ? "No" : "Yes"}
              </span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Last Seen</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {formatDateTime(
                  selected?.last_seen_at || selected?.updated_at || selected?.synced_at
                )}
              </span>
            </div>
          </div>

          <div className="member-detail-item" style={{ marginBottom: 12 }}>
            <span className="ticket-info-label">Current Roles</span>
            <span style={{ color: "var(--text-strong, #f8fafc)" }}>
              {safeArray(selected?.role_names).length
                ? safeArray(selected.role_names).join(", ")
                : "No roles tracked"}
            </span>
          </div>

          {safeArray(selected?.previous_usernames).length ? (
            <div className="member-detail-item" style={{ marginBottom: 12 }}>
              <span className="ticket-info-label">Previous Usernames</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {safeArray(selected.previous_usernames).join(", ")}
              </span>
            </div>
          ) : null}

          {safeArray(selected?.previous_display_names).length ? (
            <div className="member-detail-item" style={{ marginBottom: 12 }}>
              <span className="ticket-info-label">Previous Display Names</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {safeArray(selected.previous_display_names).join(", ")}
              </span>
            </div>
          ) : null}

          {safeArray(selected?.previous_nicknames).length ? (
            <div className="member-detail-item">
              <span className="ticket-info-label">Previous Nicknames</span>
              <span style={{ color: "var(--text-strong, #f8fafc)" }}>
                {safeArray(selected.previous_nicknames).join(", ")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
