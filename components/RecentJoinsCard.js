"use client";

import { useMemo, useState } from "react";
import MemberDrawer from "@/components/MemberDrawer";
import { timeAgo, initials } from "@/lib/format";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function displayMemberName(join) {
  return (
    join?.display_name ||
    join?.nickname ||
    join?.username ||
    join?.user_id ||
    "Unknown Member"
  );
}

function displayJoinKey(join, index) {
  return `${join?.user_id || "unknown"}-${join?.joined_at || join?.created_at || index}`;
}

export default function RecentJoinsCard({ joins = [] }) {
  const safeJoins = safeArray(joins);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visibleJoins = useMemo(() => {
    if (!expanded) {
      return safeJoins.slice(0, 3);
    }

    if (showAll) {
      return safeJoins;
    }

    return safeJoins.slice(0, 8);
  }, [safeJoins, expanded, showAll]);

  const counts = useMemo(() => {
    const tracked = safeJoins.length;
    const active = safeJoins.filter((j) => j?.in_guild !== false).length;
    const pending = safeJoins.filter((j) => !j?.has_verified_role).length;
    const verified = safeJoins.filter((j) => !!j?.has_verified_role).length;

    return {
      tracked,
      active,
      pending,
      verified,
    };
  }, [safeJoins]);

  return (
    <>
      <div className="card" id="recent-joins">
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              minWidth: 0,
              flex: 1,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Fresh Entrants</h2>
              <div className="muted" style={{ marginTop: 6 }}>
                {expanded
                  ? "Recent member flow with live verification state"
                  : `${counts.tracked} tracked • ${counts.pending} pending • ${counts.verified} verified`}
              </div>
            </div>
          </button>

          <div
            className="row"
            style={{
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <span className="badge">{counts.tracked} tracked</span>
            <span className="badge claimed">{counts.active} active</span>

            <button
              className="button ghost"
              type="button"
              style={{ width: "auto", minWidth: 110 }}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>

            {expanded && safeJoins.length > 8 ? (
              <button
                className="button ghost"
                type="button"
                style={{ width: "auto", minWidth: 110 }}
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? "Show Less" : "Show All"}
              </button>
            ) : null}
          </div>
        </div>

        {!safeJoins.length ? (
          <div className="empty-state">No fresh joins tracked yet.</div>
        ) : (
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
                <span className="ticket-info-label">Tracked</span>
                <span>{counts.tracked}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Active</span>
                <span>{counts.active}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Pending</span>
                <span>{counts.pending}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Verified</span>
                <span>{counts.verified}</span>
              </div>
            </div>

            <div
              className="space"
              style={{
                maxHeight: expanded && showAll ? 520 : "none",
                overflowY: expanded && showAll ? "auto" : "visible",
                paddingRight: expanded && showAll ? 4 : 0,
              }}
            >
              {visibleJoins.map((join, index) => {
                const name = displayMemberName(join);
                const inGuild = join?.in_guild !== false;
                const verified = !!join?.has_verified_role;
                const staff = !!join?.has_staff_role;
                const avatarUrl = join?.avatar_url || null;
                const joinedLabel = timeAgo(join?.joined_at || join?.created_at);

                return (
                  <button
                    key={displayJoinKey(join, index)}
                    type="button"
                    className="recent-join-card"
                    onClick={() => setSelected(join)}
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
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
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
                            initials(name)
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            className="recent-join-name"
                            style={{
                              fontWeight: 800,
                              overflowWrap: "anywhere",
                              lineHeight: 1.15,
                            }}
                          >
                            {name}
                          </div>

                          <div
                            className="recent-join-id muted"
                            style={{
                              marginTop: 4,
                              fontSize: 13,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {join?.user_id || "No user id"}
                          </div>
                        </div>
                      </div>

                      <div
                        className="recent-join-time muted"
                        style={{
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        {joinedLabel}
                      </div>
                    </div>

                    <div
                      className="recent-join-badges"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <span className={`badge ${inGuild ? "claimed" : "closed"}`}>
                        {inGuild ? "In Server" : "Left"}
                      </span>

                      <span className={`badge ${verified ? "low" : "medium"}`}>
                        {verified ? "Verified" : "Pending"}
                      </span>

                      <span className={`badge ${staff ? "claimed" : "open"}`}>
                        {staff ? "Staff" : "Member"}
                      </span>
                    </div>

                    {expanded ? (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div className="member-detail-item">
                          <span className="ticket-info-label">Joined</span>
                          <span>{join?.joined_at ? new Date(join.joined_at).toLocaleString() : "Unknown"}</span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">Updated</span>
                          <span>
                            {join?.updated_at
                              ? new Date(join.updated_at).toLocaleString()
                              : join?.synced_at
                              ? new Date(join.synced_at).toLocaleString()
                              : "Unknown"}
                          </span>
                        </div>

                        <div className="member-detail-item">
                          <span className="ticket-info-label">State</span>
                          <span>{join?.role_state || "unknown"}</span>
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </>
  );
}
