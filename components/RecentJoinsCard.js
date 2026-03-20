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

function formatDateTime(value) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

export default function RecentJoinsCard({ joins = [] }) {
  const safeJoins = safeArray(joins);
  const [selected, setSelected] = useState(null);
  const [showAll, setShowAll] = useState(false);

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

  const visibleJoins = useMemo(() => {
    if (showAll) return safeJoins;
    return safeJoins.slice(0, 8);
  }, [safeJoins, showAll]);

  return (
    <>
      {!safeJoins.length ? (
        <div className="empty-state">
          No recent joins are available yet. Run a member sync if this should not be empty.
        </div>
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

          <div className="space">
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

                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div className="member-detail-item">
                      <span className="ticket-info-label">Joined</span>
                      <span>{formatDateTime(join?.joined_at || join?.created_at)}</span>
                    </div>

                    <div className="member-detail-item">
                      <span className="ticket-info-label">Updated</span>
                      <span>
                        {formatDateTime(
                          join?.updated_at || join?.synced_at || join?.last_seen_at
                        )}
                      </span>
                    </div>

                    <div className="member-detail-item">
                      <span className="ticket-info-label">State</span>
                      <span>{join?.role_state || "unknown"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {safeJoins.length > 8 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 14,
              }}
            >
              <button
                className="button ghost"
                type="button"
                style={{ width: "auto", minWidth: 140 }}
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? "Show Less" : `Show All (${safeJoins.length})`}
              </button>
            </div>
          ) : null}
        </>
      )}

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </>
  );
}
