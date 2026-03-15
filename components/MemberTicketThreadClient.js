"use client";

import { useMemo, useState } from "react";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDateTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function timeAgo(value) {
  if (!value) return "—";

  try {
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return "—";

    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();

  if (value === "open") {
    return {
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.35)",
      text: "#86efac",
    };
  }

  if (value === "claimed") {
    return {
      bg: "rgba(59,130,246,0.12)",
      border: "rgba(59,130,246,0.35)",
      text: "#93c5fd",
    };
  }

  if (value === "closed") {
    return {
      bg: "rgba(251,191,36,0.12)",
      border: "rgba(251,191,36,0.35)",
      text: "#fde68a",
    };
  }

  if (value === "deleted") {
    return {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.35)",
      text: "#fca5a5",
    };
  }

  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.14)",
    text: "#e5e7eb",
  };
}

function priorityTone(priority) {
  const value = String(priority || "").toLowerCase();

  if (value === "urgent") {
    return {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.35)",
      text: "#fca5a5",
    };
  }

  if (value === "high") {
    return {
      bg: "rgba(249,115,22,0.12)",
      border: "rgba(249,115,22,0.35)",
      text: "#fdba74",
    };
  }

  if (value === "medium") {
    return {
      bg: "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.35)",
      text: "#fde68a",
    };
  }

  return {
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    text: "#86efac",
  };
}

function getInitials(name) {
  const text = safeText(name, "U");
  const parts = text.split(/\s+/).filter(Boolean);

  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function normalizeMessage(row) {
  return {
    id: row?.id || "",
    ticket_id: row?.ticket_id || "",
    author_id: row?.author_id || "",
    author_name: row?.author_name || "Unknown",
    content: row?.content || "",
    message_type: row?.message_type || "staff",
    created_at: row?.created_at || null,
    attachments: Array.isArray(row?.attachments) ? row.attachments : [],
  };
}

function Bubble({ message, currentUserId }) {
  const isMine =
    String(message?.author_id || "") === String(currentUserId || "");
  const attachments = safeArray(message?.attachments);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "min(100%, 780px)",
          display: "flex",
          gap: 12,
          flexDirection: isMine ? "row-reverse" : "row",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: isMine
              ? "linear-gradient(135deg,#3b82f6,#8b5cf6)"
              : "linear-gradient(135deg,#22c55e,#0ea5e9)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          }}
        >
          {getInitials(message?.author_name)}
        </div>

        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: isMine ? "flex-end" : "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {safeText(message?.author_name, "Unknown")}
            </div>

            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {formatDateTime(message?.created_at)}
            </div>

            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.42)",
              }}
            >
              {timeAgo(message?.created_at)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              padding: "14px 16px",
              background: isMine
                ? "linear-gradient(180deg,#1d4ed8,#1e3a8a)"
                : "rgba(255,255,255,0.06)",
              border: isMine
                ? "1px solid rgba(147,197,253,0.25)"
                : "1px solid rgba(255,255,255,0.09)",
              color: "#fff",
              lineHeight: 1.55,
              boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              width: "100%",
              wordBreak: "break-word",
            }}
          >
            {safeText(message?.content, "No message content")}
          </div>

          {attachments.length ? (
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 8,
                width: "100%",
              }}
            >
              {attachments.map((attachment, index) => {
                const url =
                  attachment?.url ||
                  attachment?.proxy_url ||
                  attachment?.href ||
                  "";
                const filename =
                  attachment?.filename ||
                  attachment?.name ||
                  `Attachment ${index + 1}`;

                if (!url) return null;

                return (
                  <a
                    key={`${filename}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      textDecoration: "none",
                      color: "#93c5fd",
                      border: "1px solid rgba(147,197,253,0.2)",
                      background: "rgba(147,197,253,0.08)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "block",
                    }}
                  >
                    📎 {filename}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontWeight: 700,
          color: "#fff",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function MemberTicketThreadClient({
  user,
  ticket,
  initialMessages,
}) {
  const [messages, setMessages] = useState(
    safeArray(initialMessages).map(normalizeMessage)
  );
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  const statusStyles = useMemo(
    () => statusTone(ticket?.status),
    [ticket?.status]
  );

  const priorityStyles = useMemo(
    () => priorityTone(ticket?.priority),
    [ticket?.priority]
  );

  const transcriptAvailable = Boolean(ticket?.transcript_url);
  const ticketClosed =
    String(ticket?.status || "").toLowerCase() === "closed";
  const ticketDeleted =
    String(ticket?.status || "").toLowerCase() === "deleted";

  async function submitReply(e) {
    e.preventDefault();

    const content = safeText(reply, "");

    if (!content) {
      setSendError("Reply cannot be empty.");
      setSendSuccess("");
      return;
    }

    setIsSending(true);
    setSendError("");
    setSendSuccess("");

    try {
      const res = await fetch(
        `/api/portal/tickets/${ticket.id}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to send reply");
      }

      const newMessage = normalizeMessage(json?.message);

      setMessages((prev) => [...prev, newMessage]);
      setReply("");
      setSendSuccess(
        ticketClosed
          ? "Reply sent. The ticket was reopened."
          : "Reply sent."
      );
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Failed to send reply"
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="thread-shell">
      <section className="thread-main">
        <div className="thread-hero">
          <div className="thread-hero-top">
            <div>
              <div className="thread-kicker">Ticket Thread</div>
              <h1 className="thread-title">
                {safeText(ticket?.title, "Support Ticket")}
              </h1>
              <div className="thread-subtitle">
                {safeText(ticket?.category, "support")} • opened{" "}
                {timeAgo(ticket?.created_at)}
              </div>
            </div>

            <div className="thread-badges">
              <span
                className="pill"
                style={{
                  background: statusStyles.bg,
                  borderColor: statusStyles.border,
                  color: statusStyles.text,
                }}
              >
                {safeText(ticket?.status, "unknown")}
              </span>

              <span
                className="pill"
                style={{
                  background: priorityStyles.bg,
                  borderColor: priorityStyles.border,
                  color: priorityStyles.text,
                }}
              >
                {safeText(ticket?.priority, "medium")}
              </span>
            </div>
          </div>

          <div className="thread-actions">
            {transcriptAvailable ? (
              <a
                href={ticket.transcript_url}
                target="_blank"
                rel="noreferrer"
                className="button-link"
              >
                Open Transcript
              </a>
            ) : null}
          </div>
        </div>

        <div className="message-panel">
          <div className="message-panel-header">
            <div>
              <div className="section-title">Conversation</div>
              <div className="section-subtitle">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {messages.length ? (
            <div className="message-list">
              {messages.map((message) => (
                <Bubble
                  key={message.id}
                  message={message}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No ticket messages were found yet.
            </div>
          )}
        </div>

        <div className="composer-card">
          <div className="section-title" style={{ marginBottom: 6 }}>
            Reply
          </div>
          <div className="section-subtitle" style={{ marginBottom: 14 }}>
            Send a new message to staff from the portal.
          </div>

          {ticketDeleted ? (
            <div className="empty-state">
              This ticket has been deleted and can no longer receive replies.
            </div>
          ) : (
            <form onSubmit={submitReply} className="composer-form">
              <textarea
                className="composer-textarea"
                placeholder={
                  ticketClosed
                    ? "Type your reply here. Sending will reopen the ticket."
                    : "Type your reply here..."
                }
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={6}
                maxLength={4000}
                disabled={isSending}
              />

              <div className="composer-footer">
                <div className="composer-meta">
                  <span>{reply.length}/4000</span>
                  {ticketClosed ? (
                    <span className="reopen-note">
                      This reply will reopen the ticket.
                    </span>
                  ) : null}
                </div>

                <button
                  type="submit"
                  className="button-link"
                  style={{
                    border: "none",
                    cursor: isSending ? "wait" : "pointer",
                    opacity: isSending ? 0.75 : 1,
                  }}
                  disabled={isSending}
                >
                  {isSending ? "Sending..." : "Send Reply"}
                </button>
              </div>

              {sendError ? (
                <div className="form-error">{sendError}</div>
              ) : null}

              {sendSuccess ? (
                <div className="form-success">{sendSuccess}</div>
              ) : null}
            </form>
          )}
        </div>
      </section>

      <aside className="thread-sidebar">
        <div className="sidebar-card">
          <div className="sidebar-title">Ticket Details</div>

          <div className="info-grid">
            <InfoCard
              label="Ticket ID"
              value={safeText(ticket?.id)}
            />
            <InfoCard
              label="Category"
              value={safeText(ticket?.category)}
            />
            <InfoCard
              label="Status"
              value={safeText(ticket?.status)}
            />
            <InfoCard
              label="Priority"
              value={safeText(ticket?.priority)}
            />
            <InfoCard
              label="Created"
              value={formatDateTime(ticket?.created_at)}
            />
            <InfoCard
              label="Updated"
              value={formatDateTime(ticket?.updated_at)}
            />
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-title">Portal View</div>

          <div className="sidebar-copy">
            <div>
              Logged in as <strong>{safeText(user?.username, "Member")}</strong>
            </div>
            <div>
              This view is safe for normal members and only shows your own ticket.
            </div>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="sidebar-title">Thread Status</div>

          <div className="sidebar-copy">
            <div>Channel ID: {safeText(ticket?.channel_id, "Unknown")}</div>
            <div>
              Closed Reason: {safeText(ticket?.closed_reason, "Not closed")}
            </div>
            <div>
              Transcript: {transcriptAvailable ? "Available" : "Not available yet"}
            </div>
            <div>
              Transcript Message ID:{" "}
              {safeText(ticket?.transcript_message_id, "—")}
            </div>
            <div>
              Transcript Channel ID:{" "}
              {safeText(ticket?.transcript_channel_id, "—")}
            </div>
          </div>
        </div>
      </aside>

      <style jsx>{`
        .thread-shell {
          display: grid;
          gap: 18px;
        }

        .thread-main,
        .thread-sidebar {
          min-width: 0;
        }

        .thread-hero,
        .message-panel,
        .composer-card,
        .sidebar-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          border-radius: 20px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.22);
        }

        .thread-hero {
          padding: 18px;
          margin-bottom: 18px;
        }

        .thread-hero-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .thread-kicker {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.48);
          margin-bottom: 6px;
          font-weight: 800;
        }

        .thread-title {
          margin: 0;
          font-size: clamp(26px, 3vw, 38px);
          line-height: 1.05;
        }

        .thread-subtitle {
          margin-top: 8px;
          color: rgba(255,255,255,0.72);
          font-size: 14px;
        }

        .thread-badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pill {
          border: 1px solid rgba(255,255,255,0.12);
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 800;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .thread-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .button-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          text-decoration: none;
          color: #fff;
          font-weight: 800;
          background: linear-gradient(180deg,#2563eb,#1d4ed8);
          border: 1px solid rgba(147,197,253,0.22);
        }

        .message-panel,
        .composer-card {
          padding: 18px;
        }

        .message-panel {
          margin-bottom: 18px;
        }

        .message-panel-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-title,
        .sidebar-title {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }

        .section-subtitle {
          margin-top: 5px;
          font-size: 13px;
          color: rgba(255,255,255,0.58);
        }

        .message-list {
          display: grid;
          gap: 16px;
        }

        .empty-state {
          border: 1px dashed rgba(255,255,255,0.14);
          border-radius: 16px;
          padding: 18px;
          color: rgba(255,255,255,0.64);
          background: rgba(255,255,255,0.02);
        }

        .composer-form {
          display: grid;
          gap: 12px;
        }

        .composer-textarea {
          width: 100%;
          resize: vertical;
          min-height: 140px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: #fff;
          padding: 14px 16px;
          outline: none;
          font: inherit;
          line-height: 1.55;
        }

        .composer-textarea:focus {
          border-color: rgba(147,197,253,0.5);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.16);
        }

        .composer-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .composer-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: rgba(255,255,255,0.6);
          font-size: 13px;
        }

        .reopen-note {
          color: #fde68a;
          font-weight: 700;
        }

        .form-error {
          color: #fca5a5;
          font-size: 13px;
          font-weight: 600;
        }

        .form-success {
          color: #86efac;
          font-size: 13px;
          font-weight: 600;
        }

        .thread-sidebar {
          display: grid;
          gap: 16px;
        }

        .sidebar-card {
          padding: 16px;
        }

        .info-grid {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .sidebar-copy {
          display: grid;
          gap: 10px;
          margin-top: 12px;
          color: rgba(255,255,255,0.74);
          line-height: 1.55;
          font-size: 14px;
        }

        @media (min-width: 1024px) {
          .thread-shell {
            grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.85fr);
            align-items: start;
          }

          .thread-sidebar {
            position: sticky;
            top: 18px;
          }
        }

        @media (max-width: 640px) {
          .thread-hero,
          .message-panel,
          .composer-card,
          .sidebar-card {
            border-radius: 18px;
            padding: 14px;
          }

          .thread-title {
            font-size: 28px;
          }

          .composer-footer {
            align-items: stretch;
          }

          .button-link {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
