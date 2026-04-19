"use client";

import { useEffect, useMemo, useState } from "react";

type Attachment = {
  name?: string | null;
  url?: string | null;
  proxy_url?: string | null;
  content_type?: string | null;
  mime_type?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

type MessageRow = {
  id?: string | number | null;
  ticket_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  author_avatar_url?: string | null;
  avatar_url?: string | null;
  content?: string | null;
  message_type?: string | null;
  created_at?: string | null;
  attachments?: Attachment[] | null;
  source?: string | null;
};

type TicketMessageListProps = {
  messages?: MessageRow[];
};

type FilterMode =
  | "all"
  | "staff"
  | "member"
  | "system"
  | "with_attachments"
  | "with_media";

type AttachmentKind = "image" | "video" | "audio" | "file";

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function safeMessages(value: unknown): MessageRow[] {
  return Array.isArray(value) ? (value as MessageRow[]) : [];
}

function safeAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? (value as Attachment[]) : [];
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

function dateMs(value: unknown): number {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function truncateText(value: unknown, max = 120): string {
  const text = safeText(value, "");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function formatBytes(value: unknown): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let current = bytes;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const digits = current >= 10 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(digits)} ${units[unitIndex]}`;
}

function getMessageBucket(
  message: MessageRow
): Exclude<FilterMode, "all" | "with_attachments" | "with_media"> {
  const type = normalizeText(message?.message_type);
  const source = normalizeText(message?.source);
  const author = normalizeText(message?.author_name);

  if (
    type === "staff" ||
    source.includes("dashboard") ||
    source.includes("staff") ||
    author.includes("staff") ||
    source.includes("mod")
  ) {
    return "staff";
  }

  if (
    type === "user" ||
    type === "member" ||
    source.includes("discord") ||
    source.includes("member") ||
    source.includes("user")
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

function getInitials(name: unknown): string {
  const text = String(name || "").trim();
  if (!text) return "?";

  const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";

  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function decimalStringMod(value: string, mod: number): number {
  let remainder = 0;

  for (let i = 0; i < value.length; i += 1) {
    const digit = value.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return 0;
    remainder = (remainder * 10 + digit) % mod;
  }

  return remainder;
}

function getDiscordDefaultAvatarUrl(userId: unknown): string {
  const raw = String(userId || "").trim();
  if (!raw || !/^\d+$/.test(raw)) return "";

  try {
    const bucketSize = 4194304;
    const cycleSize = bucketSize * 6;
    const reduced = decimalStringMod(raw, cycleSize);
    const index = Math.floor(reduced / bucketSize);

    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "";
  }
}

function getAuthorAvatar(message: MessageRow): string {
  return (
    String(message?.author_avatar_url || "").trim() ||
    String(message?.avatar_url || "").trim() ||
    getDiscordDefaultAvatarUrl(message?.author_id) ||
    ""
  );
}

function getAttachmentUrl(attachment: Attachment): string {
  return (
    String(attachment?.url || "").trim() ||
    String(attachment?.proxy_url || "").trim() ||
    ""
  );
}

function getAttachmentMime(attachment: Attachment): string {
  return (
    String(attachment?.content_type || "").trim() ||
    String(attachment?.mime_type || "").trim() ||
    ""
  ).toLowerCase();
}

function getAttachmentName(attachment: Attachment, index: number): string {
  return safeText(
    attachment?.name,
    truncateText(getAttachmentUrl(attachment), 72) || `attachment-${index + 1}`
  );
}

function getAttachmentExtension(attachment: Attachment): string {
  const name = getAttachmentName(attachment, 0).toLowerCase();
  const url = getAttachmentUrl(attachment).toLowerCase();
  const source = name || url;
  const match = source.match(/\.([a-z0-9]{2,8})(?:\?|#|$)/i);
  return match?.[1] || "";
}

function getAttachmentKind(attachment: Attachment): AttachmentKind {
  const mime = getAttachmentMime(attachment);
  const ext = getAttachmentExtension(attachment);

  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)
  ) {
    return "image";
  }

  if (
    mime.startsWith("video/") ||
    ["mp4", "webm", "mov", "m4v", "avi"].includes(ext)
  ) {
    return "video";
  }

  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)
  ) {
    return "audio";
  }

  return "file";
}

function hasMediaAttachment(message: MessageRow): boolean {
  return safeAttachments(message?.attachments).some((attachment) => {
    const kind = getAttachmentKind(attachment);
    return kind === "image" || kind === "video" || kind === "audio";
  });
}

function Lightbox({
  open,
  src,
  alt,
  onClose,
}: {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div className="message-lightbox-backdrop" onClick={onClose}>
      <div
        className="message-lightbox-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="message-lightbox-close"
          onClick={onClose}
          aria-label="Close media preview"
        >
          ✕
        </button>

        <img
          src={src}
          alt={alt}
          className="message-lightbox-image"
        />
      </div>

      <style jsx>{`
        .message-lightbox-backdrop {
          position: fixed;
          inset: 0;
          z-index: 300;
          background: rgba(0, 0, 0, 0.82);
          backdrop-filter: blur(10px);
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .message-lightbox-shell {
          position: relative;
          width: min(1200px, 100%);
          max-height: min(92vh, 100%);
          display: grid;
          place-items: center;
        }

        .message-lightbox-close {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          background: rgba(12, 18, 26, 0.88);
          color: white;
          cursor: pointer;
          font-size: 16px;
          font-weight: 800;
        }

        .message-lightbox-image {
          display: block;
          max-width: 100%;
          max-height: 88vh;
          width: auto;
          height: auto;
          object-fit: contain;
          object-position: center;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}

function AuthorAvatar({ message }: { message: MessageRow }) {
  const [failed, setFailed] = useState(false);
  const avatar = failed ? "" : getAuthorAvatar(message);
  const initials = getInitials(message?.author_name || message?.author_id);

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={safeText(message?.author_name || message?.author_id, "Author")}
        className="message-author-avatar"
        onError={() => setFailed(true)}
      />
    );
  }

  return <div className="message-author-avatar fallback">{initials}</div>;
}

function AttachmentCard({
  attachment,
  index,
  onOpenImage,
}: {
  attachment: Attachment;
  index: number;
  onOpenImage: (src: string, alt: string) => void;
}) {
  const url = getAttachmentUrl(attachment);
  const name = getAttachmentName(attachment, index);
  const kind = getAttachmentKind(attachment);
  const sizeLabel = formatBytes(attachment?.size);
  const mime = getAttachmentMime(attachment);

  if (!url) return null;

  if (kind === "image") {
    return (
      <div className="message-media-card image">
        <button
          type="button"
          className="message-media-image-button"
          onClick={() => onOpenImage(url, name)}
          title="Open image preview"
        >
          <img
            src={url}
            alt={name}
            className="message-media-image"
            loading="lazy"
          />
        </button>

        <div className="message-media-meta">
          <div className="message-media-name">{name}</div>
          <div className="message-media-submeta">
            <span>Image</span>
            {sizeLabel !== "—" ? <span>• {sizeLabel}</span> : null}
          </div>
        </div>

        <div className="message-media-actions">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="message-media-link"
          >
            Open
          </a>
          <a
            href={url}
            download={name}
            className="message-media-link"
          >
            Download
          </a>
        </div>
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="message-media-card video">
        <video
          controls
          preload="metadata"
          className="message-media-video"
        >
          <source src={url} type={mime || undefined} />
        </video>

        <div className="message-media-meta">
          <div className="message-media-name">{name}</div>
          <div className="message-media-submeta">
            <span>Video</span>
            {sizeLabel !== "—" ? <span>• {sizeLabel}</span> : null}
          </div>
        </div>

        <div className="message-media-actions">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="message-media-link"
          >
            Open
          </a>
          <a href={url} download={name} className="message-media-link">
            Download
          </a>
        </div>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="message-file-card audio">
        <div className="message-file-card-top">
          <div className="message-file-icon">🎵</div>
          <div style={{ minWidth: 0 }}>
            <div className="message-media-name">{name}</div>
            <div className="message-media-submeta">
              <span>Audio</span>
              {sizeLabel !== "—" ? <span>• {sizeLabel}</span> : null}
            </div>
          </div>
        </div>

        <audio controls preload="metadata" className="message-media-audio">
          <source src={url} type={mime || undefined} />
        </audio>

        <div className="message-media-actions">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="message-media-link"
          >
            Open
          </a>
          <a href={url} download={name} className="message-media-link">
            Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="message-file-card"
      title={url}
    >
      <div className="message-file-card-top">
        <div className="message-file-icon">📎</div>
        <div style={{ minWidth: 0 }}>
          <div className="message-media-name">{name}</div>
          <div className="message-media-submeta">
            <span>File</span>
            {sizeLabel !== "—" ? <span>• {sizeLabel}</span> : null}
          </div>
        </div>
      </div>
    </a>
  );
}

export default function TicketMessageList({
  messages = [],
}: TicketMessageListProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const cleanedMessages = useMemo(() => {
    return [...safeMessages(messages)].sort(
      (a, b) => dateMs(a?.created_at) - dateMs(b?.created_at)
    );
  }, [messages]);

  const stats = useMemo(() => {
    const latest = [...cleanedMessages].sort(
      (a, b) => dateMs(b?.created_at) - dateMs(a?.created_at)
    )[0];

    return {
      total: cleanedMessages.length,
      latestAt: latest?.created_at || null,
      staff: cleanedMessages.filter((message) => getMessageBucket(message) === "staff")
        .length,
      member: cleanedMessages.filter((message) => getMessageBucket(message) === "member")
        .length,
      attachments: cleanedMessages.filter(
        (message) => safeAttachments(message?.attachments).length > 0
      ).length,
      media: cleanedMessages.filter((message) => hasMediaAttachment(message)).length,
    };
  }, [cleanedMessages]);

  const filteredMessages = useMemo(() => {
    const query = normalizeText(search);

    return cleanedMessages.filter((message) => {
      const bucket = getMessageBucket(message);
      const attachments = safeAttachments(message?.attachments);
      const hasAttachments = attachments.length > 0;
      const hasMedia = attachments.some((attachment) => {
        const kind = getAttachmentKind(attachment);
        return kind === "image" || kind === "video" || kind === "audio";
      });

      if (filterMode === "staff" && bucket !== "staff") return false;
      if (filterMode === "member" && bucket !== "member") return false;
      if (filterMode === "system" && bucket !== "system") return false;
      if (filterMode === "with_attachments" && !hasAttachments) return false;
      if (filterMode === "with_media" && !hasMedia) return false;

      if (!query) return true;

      const haystack = [
        message?.author_name,
        message?.author_id,
        message?.content,
        message?.message_type,
        message?.source,
        message?.created_at,
        ...attachments.flatMap((attachment) => [
          attachment?.name,
          attachment?.url,
          attachment?.content_type,
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
          placeholder="Search messages, authors, or attachments..."
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
          <option value="with_media">With Media</option>
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
          <div className="message-stat-label">Media</div>
          <div className="message-stat-value">{stats.media}</div>
        </div>

        <div className="message-stat-card full-latest">
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
                  <AuthorAvatar message={message} />

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
                          {attachments.length} attachment
                          {attachments.length === 1 ? "" : "s"}
                        </span>
                      ) : null}

                      {hasMediaAttachment(message) ? (
                        <span className="message-kind-pill media">media</span>
                      ) : null}
                    </div>

                    <div className="message-thread-meta">
                      <span>{safeText(message?.source, "unknown")}</span>
                      <span>•</span>
                      <span>{formatDateTime(message?.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className={`message-thread-icon ${tone}`}>
                  {getMessageIcon(message)}
                </div>
              </div>

              <div className="message-thread-body">
                {safeText(message?.content, "No message content.")}
              </div>

              {attachments.length ? (
                <div className="message-attachment-block">
                  <div className="message-attachment-title">Attachments</div>

                  <div className="message-attachment-grid">
                    {attachments.map((attachment, attachmentIndex) => (
                      <AttachmentCard
                        key={`${getAttachmentUrl(attachment)}-${attachmentIndex}`}
                        attachment={attachment}
                        index={attachmentIndex}
                        onOpenImage={(src, alt) => setLightbox({ src, alt })}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Lightbox
        open={Boolean(lightbox?.src)}
        src={lightbox?.src || ""}
        alt={lightbox?.alt || "Attachment preview"}
        onClose={() => setLightbox(null)}
      />

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
          grid-template-columns: repeat(7, minmax(0, 1fr));
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

        .full-latest {
          grid-column: span 1;
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
          line-height: 1.4;
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
        }

        .message-thread-head-left {
          display: flex;
          gap: 12px;
          min-width: 0;
          flex: 1;
          align-items: flex-start;
        }

        .message-author-avatar {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          max-width: 40px;
          max-height: 40px;
          border-radius: 999px;
          object-fit: cover;
          object-position: center;
          display: block;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          flex-shrink: 0;
        }

        .message-author-avatar.fallback {
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 13px;
          color: #fff;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%),
            linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98));
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

        .message-kind-pill.media {
          border-color: rgba(244,114,182,0.22);
          background: rgba(244,114,182,0.08);
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
          line-height: 1.6;
          color: var(--text, #dbe4ee);
        }

        .message-attachment-block {
          display: grid;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .message-attachment-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
        }

        .message-attachment-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .message-media-card,
        .message-file-card {
          display: grid;
          gap: 10px;
          padding: 10px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
          min-width: 0;
        }

        .message-media-card.image {
          border-color: rgba(99,213,255,0.16);
        }

        .message-media-card.video {
          border-color: rgba(93,255,141,0.16);
        }

        .message-file-card.audio {
          border-color: rgba(244,114,182,0.16);
        }

        .message-media-image-button {
          padding: 0;
          margin: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          width: 100%;
        }

        .message-media-image {
          width: 100%;
          height: 220px;
          border-radius: 14px;
          object-fit: cover;
          object-position: center;
          display: block;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .message-media-video {
          width: 100%;
          max-height: 280px;
          border-radius: 14px;
          background: rgba(0,0,0,0.28);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .message-media-audio {
          width: 100%;
        }

        .message-file-card-top {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          min-width: 0;
        }

        .message-file-icon {
          width: 36px;
          height: 36px;
          min-width: 36px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        .message-media-meta {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .message-media-name {
          font-weight: 700;
          color: var(--text-strong, #f8fafc);
          overflow-wrap: anywhere;
          line-height: 1.35;
        }

        .message-media-submeta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          color: var(--muted, #9fb0c3);
          font-size: 12px;
          line-height: 1.4;
        }

        .message-media-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .message-media-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text, #dbe4ee);
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 1180px) {
          .message-stats-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .message-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .message-attachment-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .message-toolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .message-stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .message-thread-head {
            grid-template-columns: 1fr;
          }

          .message-thread-icon {
            display: none;
          }

          .message-media-image {
            height: 180px;
          }
        }

        @media (max-width: 520px) {
          .message-stats-grid {
            grid-template-columns: 1fr;
          }

          .message-media-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .message-media-link {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
