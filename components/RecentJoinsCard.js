"use client"

function timeAgo(value) {
  if (!value) return "Unknown"
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.max(1, Math.floor(diffMs / 1000))

  if (diffSec < 60) return `${diffSec}s ago`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`

  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function initialsFromName(value) {
  const raw = String(value || "?").trim()
  if (!raw) return "?"
  return raw.slice(0, 1).toUpperCase()
}

export default function RecentJoinsCard({ joins = [] }) {
  return (
    <div className="card" id="members">
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
            Live feed of the newest members entering the server
          </div>
        </div>

        <div className="muted" style={{ fontSize: 14 }}>
          {joins.length} recent join{joins.length === 1 ? "" : "s"}
        </div>
      </div>

      {!joins.length ? (
        <div className="empty-state">No recent joins yet.</div>
      ) : (
        <div className="space">
          {joins.map((join, index) => {
            const displayName =
              join.display_name ||
              join.nickname ||
              join.username ||
              join.user_id ||
              "Unknown Member"

            const avatarUrl = join.avatar_url || null
            const health = join.data_health || "ok"
            const roleState = join.role_state || "unknown"

            return (
              <div
                key={`${join.user_id || "unknown"}-${join.joined_at || join.created_at || index}`}
                className="message"
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
                    {avatarUrl ? (
                      <div className="avatar">
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          width="38"
                          height="38"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div className="avatar">
                        {initialsFromName(displayName)}
                      </div>
                    )}

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

                  <div
                    className="muted"
                    style={{
                      fontSize: 12,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {timeAgo(join.joined_at || join.created_at)}
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
                  <span className={`badge ${join.has_staff_role ? "claimed" : "open"}`}>
                    {join.has_staff_role ? "Staff" : "Member"}
                  </span>

                  <span className={`badge ${join.has_verified_role ? "low" : "medium"}`}>
                    {join.has_verified_role ? "Verified" : "Pending Verification"}
                  </span>

                  <span className="badge">
                    Health: {health}
                  </span>

                  <span className="badge">
                    State: {roleState}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
