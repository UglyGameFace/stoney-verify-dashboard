"use client";

import { useMemo, useState } from "react";
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
  source?: string | null;
};

type TicketMessageListProps = {
  messages?: TicketMessage[];
};

type FilterMode = "all" | "staff" | "user" | "attachments";

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function safeAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? (value as Attachment[]) : [];
}

function getMessageKind(message: TicketMessage): "staff" | "user" {
  return normalizeText(message?.message_type) === "staff" ? "staff" : "user";
}

function countAttachments(messages: TicketMessage[]): number {
  return messages.reduce((total, message) => {
    return total + safeAttachments(message?.attachments).length;
  }, 0);
}

function latestMessageAt(messages: TicketMessage[]): string {
  if (!messages.length) return "—";

  const sorted = [...messages].sort((a, b) => {
    const aTime = new Date(String(a?.created_at || "")).getTime() || 0;
    const bTime = new Date(String(b?.created_at || "")).getTime() || 0;
    return bTime - aTime;
  });

  return formatDateTime(sorted[0]?.created_at);
}

function isLikelyImage(url: string): boolean {
  const clean = normalizeText(url);
  return (
    clean.endsWith(".png") ||
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".gif") ||
    clean.endsWith(".webp")
  );
}

export default function TicketMessageList({
  messages = [],
}: TicketMessageListProps) {
  const [search, setSearch] = useState<string>("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const totals = useMemo(() => {
    const staffCount = messages.filter(
      (message) => getMessageKind(message) === "staff"
    ).length;
    const userCount = messages.filter(
      (message) => getMessageKind(message) === "user"
    ).length;

    return {
      total: messages.length,
      staff: staffCount,
      user: userCount,
      attachments: countAttachments(messages),
      latestAt: latestMessageAt(messages),
    };
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const query = normalizeText(search);

    return messages.filter((message) => {
      const kind = getMessageKind(message);
      const attachments = safeAttachments(message?.attachments);

      if (filterMode === "staff" && kind !== "staff") return false;
      if (filterMode === "user" && kind !== "user") return false;
      if (filterMode === "attachments" && !attachments.length) return false;

      if (!query) return true;

      const haystack = [
        message?.author_name,
        message?.author_id,
        message?.content,
        message?.message_type,
        message?.source,
        ...attachments.map((attachment) => attachment?.name || attachment?.url || ""),
      ]
        .map((value) => safeText(value, ""))
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [messages, search, filterMode]);

  return (
    <div className="card premium-message-panel">
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
            Staff replies and member responses tied to this ticket, with quick
            filtering and attachment visibility.
          </div>
        </div>

        <div className="message-summary-pills">
          <span className="message-summary-pill">{totals.total} total</span>
          <span className="message-summary-pill claimed">{totals.staff} staff</span>
          <span className="message-summary-pill open">{totals.user} user</span>
          <span className="message-summary-pill">{totals.attachments} files</span>
        </div>
      </div>

      <div className="message-toolbar">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages, authors, or attachments..."
        />

        <select
          className="input"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
        >
          <option value="all">All Messages</option>
          <option value="staff">Staff Only</option>
          <option value="user">User Only</option>
          <option value="attachments">With Attachments</option>
        </select>
      </div>

      <div className="message-stats-grid">
        <div className="message-stat-card">
          <div className="message-stat-label">Latest Message</div>
          <div className="message-stat-value">{totals.latestAt}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Visible Messages</div>
          <div className="message-stat-value">{filteredMessages.length}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Attachment Count</div>
          <div className="message-stat-value">{totals.attachments}</div>
        </div>
      </div>

      <div className="messages">
        {!filteredMessages.length ? (
          <div className="empty-state">
            {messages.length
              ? "No messages match the current filter."
              : "No messages yet."}
          </div>
        ) : null}

        {filteredMessages.map((message, index) => {
          const attachments = safeAttachments(message?.attachments);
          const authorLabel = safeText(
            message?.author_name || message?.author_id,
            "Unknown"
          );
          const kind = getMessageKind(message);

          return (
            <div
              key={String(message?.id || `${message?.created_at || "message"}-${index}`)}
              className={`message ${kind} premium-message-card`}
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
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="message-headline-row">
                    <div className="message-author">{authorLabel}</div>
                    <span className={`message-kind-pill ${kind}`}>
                      {kind === "staff" ? "Staff" : "User"}
                    </span>
                    {message?.source ? (
                      <span className="message-kind-pill neutral">
                        {safeText(message.source)}
                      </span>
                    ) : null}
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {formatDateTime(message?.created_at)}
                  </div>
                </div>
              </div>

              <div className="message-body-text">
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
                        <span className="attachment-emoji">
                          {isLikelyImage(url) ? "🖼️" : "📎"}
                        </span>
                        <span className="attachment-name">{name}</span>
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
        .premium-message-panel {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.06), transparent 28%),
            radial-gradient(circle at bottom left, rgba(93,255,141,0.05), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .message-summary-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .message-summary-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          font-size: 12px;
          color: var(--text, #dbe4ee);
        }

        .message-summary-pill.claimed {
          border-color: rgba(93,255,141,0.22);
          background: rgba(93,255,141,0.08);
        }

        .message-summary-pill.open {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .message-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px;
          gap: 10px;
          margin-bottom: 14px;
        }

        .message-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .message-stat-card {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .message-stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .message-stat-value {
          color: var(--text, #dbe4ee);
          overflow-wrap: anywhere;
        }

        .premium-message-card {
          border-radius: 18px;
          border-width: 1px;
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .message-headline-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .message-author {
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .message-kind-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text, #dbe4ee);
        }

        .message-kind-pill.staff {
          border-color: rgba(93,255,141,0.22);
          background: rgba(93,255,141,0.08);
        }

        .message-kind-pill.user {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .message-kind-pill.neutral {
          border-color: rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .message-body-text {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.5;
        }

        .message-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .message-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 100%;
          border-radius: 999px;
          padding: 8px 12px;
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

        .attachment-emoji {
          flex-shrink: 0;
        }

        .attachment-name {
          overflow-wrap: anywhere;
        }

        @media (max-width: 860px) {
          .message-toolbar,
          .message-stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
