export default function StatCard({ title, value, subtitle }) {
  return (
    <div className="card">
      <div className="muted" style={{ marginBottom: 8 }}>{title}</div>
      <div className="stat-value">{value}</div>
      <div className="muted" style={{ marginTop: 8 }}>{subtitle}</div>
    </div>
  )
}
