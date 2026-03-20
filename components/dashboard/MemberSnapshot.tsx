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

function sortMembers(rows, mode) {
  const list = [...rows];

  list.sort((a, b) => {
    if (mode === "recent") {
      const aTime = new Date(
        a?.updated_at || a?.last_seen_at || a?.joined_at || 0
      ).getTime();
      const bTime = new Date(
        b?.updated_at || b?.last_seen_at || b?.joined_at || 0
      ).getTime();
      return bTime - aTime;
    }

    if (mode === "roles") {
      return getRoleCount(b) - getRoleCount(a);
    }

    return getMemberName(a).localeCompare(getMemberName(b));
  });

  return list;
}

export default function MemberSnapshot({ members = [] }) {
  const safeMembers = safeArray(members);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");
  const [selected, setSelected] = useState(null);

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
    let rows = [...safeMembers];

    if (query.trim()) {
      const q = query.trim().toLowerCase();

      rows = rows.filter((member) =>
        [
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
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }

    if (stateFilter !== "all") {
      rows = rows.filter((member) => {
        if (stateFilter === "active") return member?.in_guild !== false;
        if (stateFilter === "former") return member?.in_guild === false;
        if (stateFilter === "staff") return !!member?.has_staff_role;
        if (stateFilter === "verified") return !!member?.has_verified_role;
        if (stateFilter === "pending") return !!member?.has_unverified;
        return true;
      });
    }

    return sortMembers(rows, sortMode).slice(0, 60);
  }, [safeMembers, query, stateFilter, sortMode]);

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
          <span>{summary.total}</span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Active</span>
          <span>{summary.active}</span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Former</span>
          <span>{summary.former}</span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Staff</span>
          <span>{summary.staff}</span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Verified</span>
          <span>{summary.verified}</span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Pending</span>
          <span>{summary.pending}</span>
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
        />

        <select
          className="input"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="all">All members</option>
          <option value="active">Active only</option>
          <option value="former">Former only</option>
          <option value="staff">Staff only</option>
          <option value="verified">Verified only</option>
          <option value="pending">Pending only</option>
        </select>

        <select
          className="input"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
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
        <div className="space">
          {filteredMembers.map((member, index) => {
            const name = getMemberName(member);
            const avatar = getMemberAvatar(member);
            const state = getMemberState(member);
            const tone = getStateTone(member);

            return (
              <button
                key={`${member?.user_id || "member"}-${index}`}
                type="button"
                onClick={() => setSelected(member)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 18,
                  padding: 12,
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
                        }}
                      >
                        {name}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          overflowWrap: "anywhere",
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
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 10,
                  }}
                >
                  <div className="member-detail-item">
                    <span className="ticket-info-label">Top Role</span>
                    <span>
                      {safeText(
                        member?.top_role || member?.highest_role_name,
                        "None"
                      )}
                    </span>
                  </div>

                  <div className="member-detail-item">
                    <span className="ticket-info-label">Roles</span>
                    <span>{getRoleCount(member)}</span>
                  </div>

                  <div className="member-detail-item">
                    <span className="ticket-info-label">Joined</span>
                    <span>{formatDateTime(member?.joined_at)}</span>
                  </div>

                  <div className="member-detail-item">
                    <span className="ticket-info-label">Updated</span>
                    <span>
                      {formatDateTime(
                        member?.updated_at || member?.last_seen_at || member?.synced_at
                      )}
                    </span>
                  </div>
                </div>

                {member?.role_state_reason ? (
                  <div
                    className="muted"
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {member.role_state_reason}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div
          style={{
            marginTop: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 20,
            padding: 16,
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
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {getMemberName(selected)}
              </div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
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
              <span>{safeText(selected?.display_name, "Unknown")}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Username</span>
              <span>{safeText(selected?.username, "Unknown")}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Nickname</span>
              <span>{safeText(selected?.nickname, "None")}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">State</span>
              <span>{safeText(selected?.role_state, "unknown")}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">In Guild</span>
              <span>{selected?.in_guild === false ? "No" : "Yes"}</span>
            </div>

            <div className="member-detail-item">
              <span className="ticket-info-label">Last Seen</span>
              <span>
                {formatDateTime(
                  selected?.last_seen_at || selected?.updated_at || selected?.synced_at
                )}
              </span>
            </div>
          </div>

          <div className="member-detail-item" style={{ marginBottom: 12 }}>
            <span className="ticket-info-label">Current Roles</span>
            <span>
              {safeArray(selected?.role_names).length
                ? safeArray(selected.role_names).join(", ")
                : "No roles tracked"}
            </span>
          </div>

          {safeArray(selected?.previous_usernames).length ? (
            <div className="member-detail-item" style={{ marginBottom: 12 }}>
              <span className="ticket-info-label">Previous Usernames</span>
              <span>{safeArray(selected.previous_usernames).join(", ")}</span>
            </div>
          ) : null}

          {safeArray(selected?.previous_display_names).length ? (
            <div className="member-detail-item" style={{ marginBottom: 12 }}>
              <span className="ticket-info-label">Previous Display Names</span>
              <span>{safeArray(selected.previous_display_names).join(", ")}</span>
            </div>
          ) : null}

          {safeArray(selected?.previous_nicknames).length ? (
            <div className="member-detail-item">
              <span className="ticket-info-label">Previous Nicknames</span>
              <span>{safeArray(selected.previous_nicknames).join(", ")}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
