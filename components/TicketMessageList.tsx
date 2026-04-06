import { formatDateTime } from "@/lib/format";

type Attachment = {
  name?: string | null;
  url?: string | null;
};

type TicketMessage = {
  id?: string | number | null;
  author_id?: string | null;
  author_name?: string | null;
  content?: string | null;
  created_at?: string | null;
  message_type?: string | null;
  attachments?: Attachment[] | null;
};

type TicketMessageListProps = {
  messages?: TicketMessage[];
};

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? (value as Attachment[]) : [];
}

export default function TicketMessageList({
  messages = [],
}: TicketMessageListProps) {
  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Conversation</h2>
          <div className="muted" style={{ overflowWrap: "anywhere" }}>
            Staff replies and member responses tied to this ticket.
          </div>
        </div>

        <div className="badge">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="messages">
        {!messages.length ? (
          <div className="empty-state">No messages yet.</div>
        ) : null}

        {messages.map((message, index) => {
          const attachments = safeAttachments(message?.attachments);
          const authorLabel = safeText(
            message?.author_name || message?.author_id,
            "Unknown"
          );
          const kind =
            String(message?.message_type || "").toLowerCase() === "staff"
              ? "staff"
              : "user";

          return (
            <div
              key={String(message?.id || `${message?.created_at || "message"}-${index}`)}
              className={`message ${kind}`}
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    overflowWrap: "anywhere",
                  }}
                >
                  {authorLabel}
                </div>

                <div className="muted" style={{ fontSize: 13 }}>
                  {formatDateTime(message?.created_at)}
                </div>
              </div>

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {safeText(message?.content, "") || "No message content."}
              </div>

              {attachments.length ? (
                <div className="message-attachments">
                  {attachments.map((attachment, attachmentIndex) => {
                    const url = safeText(attachment?.url, "");
                    const name = safeText(
                      attachment?.name || attachment?.url,
                      `Attachment ${attachmentIndex + 1}`
                    );

                    if (!url) return null;

                    return (
                      <a
                        key={`${url}-${attachmentIndex}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="message-attachment-chip"
                      >
                        📎 {name}
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .message-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .message-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
          border-radius: 999px;
          padding: 7px 10px;
          border: 1px solid rgba(99, 213, 255, 0.14);
          background: rgba(99, 213, 255, 0.06);
          color: var(--text, #dbe4ee);
          font-size: 12px;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .message-attachment-chip:hover {
          border-color: rgba(99, 213, 255, 0.28);
          background: rgba(99, 213, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
