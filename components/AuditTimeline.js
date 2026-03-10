import { timeAgo } from "@/lib/format"

export default function AuditTimeline({ events = [] }) {
  return (
    <div className="card" id="timeline">
      <h2 style={{ marginTop: 0 }}>Audit Timeline</h2>
      <div className="timeline">
        {events.map((event) => (
          <div key={event.id} className="timeline-item">
            <div style={{ fontWeight: 800 }}>{event.title}</div>
            <div className="muted" style={{ marginTop: 4 }}>{event.description}</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{timeAgo(event.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
