import AuthStatus from "@/components/AuthStatus"

export default function Topbar() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
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
          <div className="muted" style={{ marginBottom: 8 }}>Operations command center</div>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.03em" }}>
            Deployment-ready moderation dashboard
          </h1>
        </div>

        <div style={{ width: "100%", maxWidth: 360 }}>
          <AuthStatus />
        </div>
      </div>
    </div>
  )
}
