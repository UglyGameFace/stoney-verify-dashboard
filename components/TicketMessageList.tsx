"use client";

import { useMemo, useState } from "react";

type MessageRow = {
  id?: string | number | null;
  source?: string | null;
  role?: string | null;
  author_name?: string | null;
  author_id?: string | null;
  username?: string | null;
  content?: string | null;
  created_at?: string | null;
  attachments?: Array<{
    name?: string | null;
    url?: string | null;
  }> | null;
  metadata?: Record<string, unknown> | null;
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

function getMessageTone(message: MessageRow): "staff" | "member" | "system" {
  const role = normalizeText(message?.role);
  const source = normalizeText(message?.source);
  const author = normalizeText(message?.author_name || message?.username);

  if (
    role.includes("staff") ||
    source.includes("staff") ||
    source.includes("dashboard") ||
    source.includes("moderator")
  ) {
    return "staff";
  }

  if (
    role.includes("member") ||
    role.includes("user") ||
    source.includes("member") ||
    source.includes("discord_user") ||
    author.includes("member")
  ) {
    return "member";
  }

  return "system";
}

function getMessageAuthor(message: MessageRow): string {
  return (
    safeText(message?.author_name, "") ||
    safeText(message?.username, "") ||
    safeText(message?.author_id, "") ||
    "Unknown"
  );
}

function getMessageSource(message: MessageRow): string {
  return safeText(message?.source, "system");
}

function getAttachmentList(message: MessageRow) {
  return Array.isArray(message?.attachments) ? message.attachments : [];
}

function getAttachmentCount(messages: MessageRow[]): number {
  return messages.reduce((count, message) => {
    return count + getAttachmentList(message).length;
  }, 0);
}

function MessagePill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "staff" | "member" | "system";
}) {
  return <span className={`message-list-pill ${tone}`}>{children}</span>;
}

export default function TicketMessageList({
  messages = [],
}: TicketMessageListProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const cleanedMessages = useMemo(() => safeMessages(messages), [messages]);

  const stats = useMemo(() => {
    const staff = cleanedMessages.filter(
      (message) => getMessageTone(message) === "staff"
    ).length;

    const member = cleanedMessages.filter(
      (message) => getMessageTone(message) === "member"
    ).length;

    const system = cleanedMessages.filter(
      (message) => getMessageTone(message) === "system"
    ).length;

    const latest = [...cleanedMessages].sort((a, b) => {
      const aTime = new Date(String(a?.created_at || "")).getTime() || 0;
      const bTime = new Date(String(b?.created_at || "")).getTime() || 0;
      return bTime - aTime;
    })[0];

    return {
      total: cleanedMessages.length,
      staff,
      member,
      system,
      attachments: getAttachmentCount(cleanedMessages),
      latestAt: latest?.created_at || null,
    };
  }, [cleanedMessages]);

  const filteredMessages = useMemo(() => {
    const query = normalizeText(search);

    return cleanedMessages.filter((message) => {
      const tone = getMessageTone(message);
      const attachments = getAttachmentList(message);

      if (filterMode === "staff" && tone !== "staff") return false;
      if (filterMode === "member" && tone !== "member") return false;
      if (filterMode === "system" && tone !== "system") return false;
      if (filterMode === "with_attachments" && attachments.length === 0) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        message?.author_name,
        message?.author_id,
        message?.username,
        message?.source,
        message?.role,
        message?.content,
      ]
        .map((value) => safeText(value, ""))
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [cleanedMessages, filterMode, search]);

  return (
    <div className="card ticket-message-panel">
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
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Transcript Messages</h2>
          <div className="muted" style={{ overflowWrap: "anywhere" }}>
            Full ticket conversation history from dashboard, member, and system
            sources.
          </div>
        </div>

        <div className="message-list-pills">
          <MessagePill tone="system">{stats.total} total</MessagePill>
          <MessagePill tone="staff">{stats.staff} staff</MessagePill>
          <MessagePill tone="member">{stats.member} member</MessagePill>
          <MessagePill tone="system">{stats.system} system</MessagePill>
          <MessagePill tone="system">{stats.attachments} attachments</MessagePill>
        </div>
      </div>

      <div className="message-toolbar">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcript..."
        />

        <select
          className="input"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
        >
          <option value="all">All Messages</option>
          <option value="staff">Staff Only</option>
          <option value="member">Member Only</option>
          <option value="system">System Only</option>
          <option value="with_attachments">With Attachments</option>
        </select>
      </div>

      <div className="message-stats-grid">
        <div className="message-stat-card">
          <div className="message-stat-label">Visible Messages</div>
          <div className="message-stat-value">{filteredMessages.length}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Latest Message</div>
          <div className="message-stat-value">{formatDateTime(stats.latestAt)}</div>
        </div>

        <div className="message-stat-card">
          <div className="message-stat-label">Attachment Count</div>
          <div className="message-stat-value">{stats.attachments}</div>
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
          const attachments = getAttachmentList(message);

          return (
            <div
              key={String(message?.id || `${message?.created_at || "message"}-${index}`)}
              className={`message-item-card ${tone}`}
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="message-item-head">
                    <div className="message-item-author">
                      {getMessageAuthor(message)}
                    </div>

                    <MessagePill tone={tone}>
                      {tone === "staff"
                        ? "Staff"
                        : tone === "member"
                          ? "Member"
                          : "System"}
                    </MessagePill>

                    <span className="message-item-source">
                      {getMessageSource(message)}
                    </span>
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {formatDateTime(message?.created_at)}
                  </div>
                </div>
              </div>

              <div className="message-item-body">
                {safeText(message?.content, "No message content.")}
              </div>

              {attachments.length ? (
                <div className="message-attachment-list">
                  {attachments.map((attachment, attachmentIndex) => {
                    const url = safeText(attachment?.url, "");
                    const name =
                      safeText(attachment?.name, "") ||
                      `attachment-${attachmentIndex + 1}`;

                    return (
                      <a
                        key={`${url}-${attachmentIndex}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="message-attachment-chip"
                      >
                        <span className="message-attachment-index">
                          #{attachmentIndex + 1}
                        </span>
                        <span className="message-attachment-name">{name}</span>
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
        .ticket-message-panel {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.06), transparent 28%),
            radial-gradient(circle at bottom left, rgba(93,255,141,0.05), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .message-list-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .message-list-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .message-list-pill.staff {
          border-color: rgba(93,255,141,0.24);
          background: rgba(93,255,141,0.08);
        }

        .message-list-pill.member {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .message-list-pill.system {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
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

        .message-list {
          display: grid;
          gap: 12px;
        }

        .message-item-card {
          display: grid;
          gap: 10px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .message-item-card.staff {
          border-color: rgba(93,255,141,0.16);
        }

        .message-item-card.member {
          border-color: rgba(99,213,255,0.16);
        }

        .message-item-card.system {
          border-color: rgba(255,255,255,0.10);
        }

        .message-item-head {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .message-item-author {
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .message-item-source {
          font-size: 12px;
          color: var(--muted, #9fb0c3);
          overflow-wrap: anywhere;
        }

        .message-item-body {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.55;
          color: var(--text, #dbe4ee);
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
          border: 1px solid rgba(99,213,255,0.14);
          background: rgba(99,213,255,0.06);
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
