"use client"

import { useMemo, useState } from "react"
import MemberDrawer from "@/components/MemberDrawer"
import { timeAgo, initials } from "@/lib/format"

export default function RecentJoinsCard({ joins = [] }) {
  const [selected, setSelected] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const visibleJoins = useMemo(() => {
    if (showAll) return joins
    return joins.slice(0, 5)
  }, [joins, showAll])

  return (
    <div className="card" id="recent-joins">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Recent Joins</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Recent member flow with live active/left-server state
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="muted" style={{ fontSize: 14 }}>
            {joins.length} recent join{joins.length === 1 ? "" : "s"}
          </div>

          {joins.length > 5 ? (
            <button
              className="button ghost"
              type="button"
              style={{ width: "auto", minWidth: 96 }}
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Show Less" : "Show All"}
            </button>
          ) : null}
        </div>
      </div>

      {!joins.length ? (
        <div className="empty-state">No recent joins yet.</div>
      ) : (
        <div
          className="space"
          style={{
            maxHeight: showAll ? 540 : "none",
            overflowY: showAll ? "auto" : "visible",
            paddingRight: showAll ? 4 : 0
          }}
        >
          {visibleJoins.map((join, index) => {
            const displayName =
              join.display_name ||
              join.nickname ||
              join.username ||
              join.user_id ||
              "Unknown Member"

            const inGuild = join.in_guild !== false
            const joinedLabel = timeAgo(join.joined_at || join.created_at)
            const avatarUrl = join.avatar_url || null

            return (
              <button
                key={`${join.user_id || "unknown"}-${join.joined_at || join.created_at || index}`}
                type="button"
                className="message"
                onClick={() => setSelected(join)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  cursor: "pointer",
                  border: "1px solid var(--line)"
                }}
              >
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12
                  }}
                >
                  <div className="row" style={{ minWidth: 0, flex: 1 }}>
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
                      <div
                        style={{
                          fontWeight: 800,
                          overflowWrap: "anywhere"
                        }}
                      >
                        {displayName}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          overflowWrap: "anywhere"
                        }}
                      >
                        {join.user_id || "No user id"}
                      </div>
                    </div>
                  </div>

                  <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {joinedLabel}
                  </div>
                </div>

                <div
                  className="row"
                  style={{
                    marginTop: 12,
                    gap: 8,
                    flexWrap: "wrap"
                  }}
                >
                  <span className={`badge ${inGuild ? "claimed" : "closed"}`}>
                    {inGuild ? "In Server" : "Left Server"}
                  </span>

                  <span className={`badge ${join.has_verified_role ? "low" : "medium"}`}>
                    {join.has_verified_role ? "Verified" : "Pending Verification"}
                  </span>

                  <span className={`badge ${join.has_staff_role ? "claimed" : "open"}`}>
                    {join.has_staff_role ? "Staff" : "Member"}
                  </span>

                  <span className="badge">
                    State: {join.role_state || "unknown"}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
