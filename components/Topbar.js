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
            Stoney Balonney control room
          </div>

          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.03em" }}>
            Stoney Verify Dashboard
          </h1>

          <div className="muted" style={{ marginTop: 10, maxWidth: 760 }}>
            Green-room command for tickets, joins, verification flow, role sync,
            fraud checks, and staff actions without bouncing around Discord all day.
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 360 }}>
          <AuthStatus />
        </div>
      </div>
    </div>
  )
}
