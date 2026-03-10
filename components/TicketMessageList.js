import { formatDateTime } from "@/lib/format"

export default function TicketMessageList({ messages = [] }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Conversation</h2>
      <div className="messages">
        {!messages.length ? <div className="empty-state">No messages yet.</div> : null}
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.message_type === "staff" ? "staff" : "user"}`}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>{message.author_name || message.author_id}</div>
              <div className="muted" style={{ fontSize: 13 }}>{formatDateTime(message.created_at)}</div>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
