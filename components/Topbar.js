import AuthStatus from "@/components/AuthStatus"

export default function Topbar() {
  return (
    <div className="card stoner-topbar" style={{ marginBottom: 18 }}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            Operations smoke circle
          </div>

          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.03em" }}>
            Stoney Verify moderation dashboard
          </h1>

          <div className="muted" style={{ marginTop: 10, maxWidth: 760 }}>
            Premium green-room control for tickets, members, fraud review,
            realtime queue handling, and staff workflow without the cluttered feel
            on mobile.
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 360 }}>
          <AuthStatus />
        </div>
      </div>
    </div>
  )
}
