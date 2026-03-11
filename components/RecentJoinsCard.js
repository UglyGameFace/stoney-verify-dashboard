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
    <>
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
            <h2 style={{ margin: 0 }}>Fresh Entrants</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              Recent member flow with accurate live state
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <div className="muted" style={{ fontSize: 14 }}>
              {joins.length} tracked
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
          <div className="empty-state">No fresh joins tracked yet.</div>
        ) : (
          <div
            className="space"
            style={{
              maxHeight: showAll ? 520 : "none",
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
                  className="recent-join-card"
                  onClick={() => setSelected(join)}
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

                      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                        <div className="recent-join-name">
                          {displayName}
                        </div>

                        <div className="recent-join-id">
                          {join.user_id || "No user id"}
                        </div>
                      </div>
                    </div>

                    <div className="recent-join-time">
                      {joinedLabel}
                    </div>
                  </div>

                  <div className="recent-join-badges">
                    <span className={`badge ${inGuild ? "claimed" : "closed"}`}>
                      {inGuild ? "In Server" : "Left"}
                    </span>

                    <span className={`badge ${join.has_verified_role ? "low" : "medium"}`}>
                      {join.has_verified_role ? "Verified" : "Pending"}
                    </span>

                    <span className={`badge ${join.has_staff_role ? "claimed" : "open"}`}>
                      {join.has_staff_role ? "Staff" : "Member"}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />
    </>
  )
}
