export default function StaffMetricsCard({ metrics = [] }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Staff Performance</h2>
      <div className="space">
        {!metrics.length ? <div className="empty-state">No staff metrics yet.</div> : null}
        {metrics.map((row) => (
          <div key={row.staff_id} className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{row.staff_name || row.staff_id}</div>
              <div className="muted">Avg response: {row.avg_response_minutes || 0}m</div>
            </div>
            <div className="row">
              <span className="badge">{row.tickets_handled} handled</span>
              <span className="badge">{row.approvals} approvals</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
