"use client";

import { useMemo, useState } from "react";

type Attachment = {
  name?: string | null;
  url?: string | null;
};

type MessageRow = {
  id?: string | number | null;
  ticket_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  content?: string | null;
  message_type?: string | null;
  created_at?: string | null;
  attachments?: Attachment[] | null;
  source?: string | null;
};

type TicketMessageListProps = {
  messages?: MessageRow[];
};

type FilterMode = "all" | "staff" | "member" | "system" | "with_attachments";

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function safeMessages(value: unknown): MessageRow[] {
  return Array.isArray(value) ? (value as MessageRow[]) : [];
}

function safeAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? (value as Attachment[]) : [];
}

function getMessageBucket(message: MessageRow): Exclude<FilterMode, "all" | "with_attachments"> {
  const type = normalizeText(message?.message_type);
  const source = normalizeText(message?.source);
  const author = normalizeText(message?.author_name);

  if (
    type === "staff" ||
    source.includes("dashboard") ||
    source.includes("staff") ||
    author.includes("staff")
  ) {
    return "staff";
  }

  if (
    type === "user" ||
    type === "member" ||
    source.includes("discord") ||
    source.includes("member")
  ) {
    return "member";
  }

  return "system";
}

function getMessageTone(message: MessageRow): "staff" | "member" | "system" {
  const bucket = getMessageBucket(message);
  if (bucket === "staff") return "staff";
  if (bucket === "member") return "member";
  return "system";
}

function getMessageIcon(message: MessageRow): string {
  const tone = getMessageTone(message);
  if (tone === "staff") return "🛠️";
  if (tone === "member") return "💬";
  return "🧩";
}

function truncateText(value: unknown, max = 120): string {
  const text = safeText(value, "");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export default function TicketMessageList({
  messages = [],
}: TicketMessageListProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const cleanedMessages = useMemo(() => safeMessages(messages), [messages]);

  const stats = useMemo(() => {
    const latest = [...cleanedMessages].sort((a, b) => {
      const aTime = new Date(String(a?.created_at || "")).getTime() || 0;
      const bTime = new Date(String(b?.created_at || "")).getTime() || 0;
      return bTime - aTime;
    })[0];

    return {
      total: cleanedMessages.length,
      latestAt: latest?.created_at || null,
      staff: cleanedMessages.filter((message) => getMessageBucket(message) === "staff").length,
      member: cleanedMessages.filter((message) => getMessageBucket(message) === "member").length,
      attachments: cleanedMessages.filter(
        (message) => safeAttachments(message?.attachments).length > 0
      ).length,
    };
  }, [cleanedMessages]);

  const filteredMessages = useMemo(() => {
    const query = normalizeText(search);

    return cleanedMessages.filter((message) => {
      const bucket = getMessageBucket(message);
      const hasAttachments = safeAttachments(message?.attachments).length > 0;

      if (filterMode === "staff" && bucket !== "staff") return false;
      if (filterMode === "member" && bucket !== "member") return false;
      if (filterMode === "system" && bucket !== "system") return false;
      if (filterMode === "with_attachments" && !hasAttachments) return false;

      if (!query) return true;

      const haystack = [
        message?.author_name,
        message?.author_id,
        message?.content,
        message?.message_type,
        message?.source,
        message?.created_at,
        ...safeAttachments(message?.attachments).flatMap((attachment) => [
          attachment?.name,
          attachment?.url,
        ]),
      ]
        .map((value) => safeText(value, ""))
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [cleanedMessages, filterMode, search]);

  return (
    <div className="message-list-shell">
      <div className="message-toolbar">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages..."
        />

        <select
          className="input"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
        >
          <option value="all">All Messages</option>
          <option value="staff">Staff Replies</option>
          <option value="member">Member Messages</option>
          <option value="system">System / Other</option>
          <option value="with_attachments">With Attachments</option>
        </select>
      </div>

      <div className="message-stats-grid">
        <div className="message-stat-card">
          <div className="message-stat-label">Visible</div>
          <div className="message-stat-value">{filteredMessages.length}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Total</div>
          <div className="message-stat-value">{stats.total}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Staff</div>
          <div className="message-stat-value">{stats.staff}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Member</div>
          <div className="message-stat-value">{stats.member}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Attachments</div>
          <div className="message-stat-value">{stats.attachments}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Latest</div>
          <div className="message-stat-value">{formatDateTime(stats.latestAt)}</div>
        </div>
      </div>

      <div className="message-list">
        {!filteredMessages.length ? (
          <div className="empty-state">
            {cleanedMessages.length
              ? "No messages match the current filter."
              : "No ticket messages yet."}
          </div>
        ) : null}

        {filteredMessages.map((message, index) => {
          const tone = getMessageTone(message);
          const attachments = safeAttachments(message?.attachments);

          return (
            <div
              key={String(message?.id || `${message?.created_at || "message"}-${index}`)}
              className={`message-thread-card ${tone}`}
            >
              <div className="message-thread-head">
                <div className="message-thread-head-left">
                  <div className={`message-thread-icon ${tone}`}>
                    {getMessageIcon(message)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="message-thread-author-row">
                      <div className="message-thread-author">
                        {safeText(message?.author_name || message?.author_id, "Unknown")}
                      </div>
                      <span className={`message-kind-pill ${tone}`}>
                        {safeText(message?.message_type, tone)}
                      </span>
                      {attachments.length ? (
                        <span className="message-kind-pill attachments">
                          {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>

                    <div className="message-thread-meta">
                      <span>{safeText(message?.source, "unknown")}</span>
                      <span>•</span>
                      <span>{formatDateTime(message?.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="message-thread-body">
                {safeText(message?.content, "No message content.")}
              </div>

              {attachments.length ? (
                <div className="message-attachment-block">
                  <div className="message-attachment-title">Attachments</div>
                  <div className="message-attachment-list">
                    {attachments.map((attachment, attachmentIndex) => {
                      const name = safeText(
                        attachment?.name,
                        truncateText(attachment?.url, 72) || `attachment-${attachmentIndex + 1}`
                      );
                      const url = safeText(attachment?.url, "");

                      return (
                        <a
                          key={`${url}-${attachmentIndex}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="message-attachment-chip"
                          title={url}
                        >
                          <span className="message-attachment-index">
                            #{attachmentIndex + 1}
                          </span>
                          <span className="message-attachment-name">{name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .message-list-shell {
          display: grid;
          gap: 14px;
        }

        .message-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px;
          gap: 10px;
        }

        .message-stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
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

        .message-list {
          display: grid;
          gap: 12px;
        }

        .message-thread-card {
          display: grid;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .message-thread-card.staff {
          border-color: rgba(99,213,255,0.18);
        }

        .message-thread-card.member {
          border-color: rgba(93,255,141,0.18);
        }

        .message-thread-card.system {
          border-color: rgba(251,191,36,0.18);
        }

        .message-thread-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }

        .message-thread-head-left {
          display: flex;
          gap: 12px;
          min-width: 0;
          flex: 1;
          align-items: flex-start;
        }

        .message-thread-icon {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 15px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          flex-shrink: 0;
        }

        .message-thread-icon.staff {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .message-thread-icon.member {
          border-color: rgba(93,255,141,0.22);
          background: rgba(93,255,141,0.08);
        }

        .message-thread-icon.system {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .message-thread-author-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .message-thread-author {
          font-weight: 800;
          color: var(--text-strong, #f8fafc);
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
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .message-kind-pill.member {
          border-color: rgba(93,255,141,0.22);
          background: rgba(93,255,141,0.08);
        }

        .message-kind-pill.system {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .message-kind-pill.attachments {
          border-color: rgba(168,85,247,0.22);
          background: rgba(168,85,247,0.08);
        }

        .message-thread-meta {
          margin-top: 4px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--muted, #9fb0c3);
          font-size: 12px;
          line-height: 1.4;
        }

        .message-thread-body {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.55;
          color: var(--text, #dbe4ee);
        }

        .message-attachment-block {
          display: grid;
          gap: 10px;
          padding-top: 6px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .message-attachment-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
        }

        .message-attachment-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .message-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 100%;
          border-radius: 999px;
          padding: 7px 10px;
          border: 1px solid rgba(168,85,247,0.18);
          background: rgba(168,85,247,0.08);
          color: var(--text, #dbe4ee);
          font-size: 12px;
          text-decoration: none;
        }

        .message-attachment-index {
          color: var(--muted, #9fb0c3);
          flex-shrink: 0;
        }

        .message-attachment-name {
          overflow-wrap: anywhere;
        }

        @media (max-width: 980px) {
          .message-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .message-toolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .message-stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
