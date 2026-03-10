import AuthStatus from "@/components/AuthStatus"

export default function Topbar() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div className="muted" style={{ marginBottom: 8 }}>Operations command center</div>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.03em" }}>
            Deployment-ready pass with stronger auth, controls, and runtime safety
          </h1>
        </div>
        <AuthStatus />
      </div>
    </div>
  )
}
