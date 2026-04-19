"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS = 10;

type Attachment = {
  name?: string | null;
  url?: string | null;
  proxy_url?: string | null;
  content_type?: string | null;
  mime_type?: string | null;
  size?: number | null;
};

type ReplyResponse = {
  ok?: boolean;
  error?: string;
  mirroredToDiscord?: boolean;
  mirrorError?: string;
  message?: {
    id?: string | null;
    ticket_id?: string | null;
    author_id?: string | null;
    author_name?: string | null;
    author_avatar_url?: string | null;
    content?: string | null;
    message_type?: string | null;
    attachments?: Attachment[] | null;
    source?: string | null;
    created_at?: string | null;
  } | null;
};

type TicketReplyBoxProps = {
  ticketId: string;
  onPosted?: (() => Promise<void> | void) | null;
};

type ToneBannerProps = {
  children: ReactNode;
  tone?: "info" | "warn" | "error";
};

type AttachmentPreviewProps = {
  attachments: Attachment[];
  onRemove: (index: number) => void;
};

type ParsedAttachments = {
  attachments: Attachment[];
  invalid: string[];
  totalEntered: number;
  trimmedCount: number;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function truncateText(value: unknown, max = 120): string {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function isLikelyUrl(value: unknown): boolean {
  const text = normalizeText(value);
  if (!text) return false;

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseAttachmentNameFromUrl(url: string, index: number): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || "";
    const tail = pathname.split("/").filter(Boolean).pop();
    if (tail) return decodeURIComponent(tail);
  } catch {
    // ignore
  }
  return `attachment-${index + 1}`;
}

function getAttachmentMimeFromUrl(url: string): string {
  const lower = url.toLowerCase();

  if (
    lower.includes(".png") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".gif") ||
    lower.includes(".webp") ||
    lower.includes(".bmp") ||
    lower.includes(".svg")
  ) {
    return "image/*";
  }

  if (
    lower.includes(".mp4") ||
    lower.includes(".webm") ||
    lower.includes(".mov") ||
    lower.includes(".m4v")
  ) {
    return "video/*";
  }

  if (
    lower.includes(".mp3") ||
    lower.includes(".wav") ||
    lower.includes(".ogg") ||
    lower.includes(".m4a") ||
    lower.includes(".flac")
  ) {
    return "audio/*";
  }

  return "";
}

function parseAttachments(value: unknown): ParsedAttachments {
  const rows = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const attachments: Attachment[] = [];
  const invalid: string[] = [];

  rows.forEach((url) => {
    if (!isLikelyUrl(url)) {
      invalid.push(url);
      return;
    }

    attachments.push({
      name: parseAttachmentNameFromUrl(url, attachments.length),
      url,
      content_type: getAttachmentMimeFromUrl(url),
    });
  });

  const keptAttachments = attachments.slice(0, MAX_ATTACHMENTS);

  return {
    attachments: keptAttachments,
    invalid,
    totalEntered: rows.length,
    trimmedCount: Math.max(0, attachments.length - keptAttachments.length),
  };
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

function getAttachmentKind(
  attachment: Attachment
): "image" | "video" | "audio" | "file" {
  const mime = String(
    attachment?.content_type || attachment?.mime_type || ""
  ).toLowerCase();
  const url = String(attachment?.url || "").toLowerCase();

  if (
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].some((ext) =>
      url.includes(ext)
    )
  ) {
    return "image";
  }

  if (
    mime.startsWith("video/") ||
    [".mp4", ".webm", ".mov", ".m4v"].some((ext) => url.includes(ext))
  ) {
    return "video";
  }

  if (
    mime.startsWith("audio/") ||
    [".mp3", ".wav", ".ogg", ".m4a", ".flac"].some((ext) => url.includes(ext))
  ) {
    return "audio";
  }

  return "file";
}

function ToneBanner({ children, tone = "info" }: ToneBannerProps) {
  if (!children) return null;

  const className =
    tone === "error"
      ? "error-banner"
      : tone === "warn"
        ? "warn-banner"
        : "info-banner";

  return <div className={className}>{children}</div>;
}

function AttachmentPreview({
  attachments,
  onRemove,
}: AttachmentPreviewProps) {
  if (!attachments.length) {
    return <div className="muted">No attachments queued.</div>;
  }

  return (
    <div className="reply-attachment-grid">
      {attachments.map((item, index) => {
        const kind = getAttachmentKind(item);
        const name = truncateText(item.name || item.url, 80);
        const url = normalizeText(item.url);

        return (
          <div key={`${item.url}-${index}`} className="reply-attachment-card">
            {kind === "image" ? (
              <img
                src={url}
                alt={item.name || `Attachment ${index + 1}`}
                className="reply-attachment-thumb"
                loading="lazy"
              />
            ) : (
              <div className="reply-attachment-thumb fallback">
                {kind === "video" ? "🎬" : kind === "audio" ? "🎵" : "📎"}
              </div>
            )}

            <div className="reply-attachment-meta">
              <div className="reply-attachment-name">{name}</div>
              <div className="reply-attachment-submeta">
                <span>#{index + 1}</span>
                <span>•</span>
                <span>{kind}</span>
                {formatBytes(item.size) !== "—" ? (
                  <>
                    <span>•</span>
                    <span>{formatBytes(item.size)}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="reply-attachment-actions">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="reply-mini-link"
              >
                Open
              </a>

              <button
                type="button"
                className="reply-mini-link danger"
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TicketReplyBox({
  ticketId,
  onPosted,
}: TicketReplyBoxProps) {
  const [message, setMessage] = useState<string>("");
  const [attachmentInput, setAttachmentInput] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [warning, setWarning] = useState<string>("");

  const parsedAttachments = useMemo<ParsedAttachments>(
    () => parseAttachments(attachmentInput),
    [attachmentInput]
  );

  const trimmedMessage = message.trim();
  const remainingCharacters = MAX_MESSAGE_LENGTH - message.length;
  const attachmentCount = parsedAttachments.attachments.length;
  const invalidAttachmentCount = parsedAttachments.invalid.length;

  function removeAttachment(index: number) {
    const next = parsedAttachments.attachments.filter((_, i) => i !== index);
    setAttachmentInput(next.map((item) => item.url || "").filter(Boolean).join("\n"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedMessage) {
      setError("Reply message cannot be empty.");
      setSuccess("");
      setWarning("");
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Reply is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`);
      setSuccess("");
      setWarning("");
      return;
    }

    if (invalidAttachmentCount > 0) {
      setError("One or more attachment URLs are invalid. Fix them before sending.");
      setSuccess("");
      setWarning("");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    setWarning("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          content: trimmedMessage,
          attachments: parsedAttachments.attachments,
        }),
      });

      const json = (await res.json().catch(() => null)) as ReplyResponse | null;

      if (!res.ok) {
        throw new Error(json?.error || "Failed to send reply.");
      }

      setMessage("");
      setAttachmentInput("");

      if (json?.mirroredToDiscord) {
        setSuccess("Reply saved and mirrored to Discord.");
      } else {
        setSuccess("Reply saved to the dashboard.");
      }

      if (json?.mirrorError) {
        setWarning(`Saved, but Discord mirror had an issue: ${json.mirrorError}`);
      }

      if (onPosted) {
        await onPosted();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card premium-reply-box">
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
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Reply to Ticket</h2>
          <div className="muted" style={{ overflowWrap: "anywhere" }}>
            Send a staff response, keep the dashboard transcript clean, and mirror the
            reply into Discord when the ticket is linked.
          </div>
        </div>

        <div className="reply-toolbar-pills">
          <span className={`reply-pill ${remainingCharacters < 300 ? "warn" : ""}`}>
            {remainingCharacters} chars left
          </span>
          <span className={`reply-pill ${invalidAttachmentCount > 0 ? "danger" : ""}`}>
            {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <ToneBanner tone="error">{error}</ToneBanner>
      <ToneBanner tone="info">{success}</ToneBanner>
      <ToneBanner tone="warn">{warning}</ToneBanner>

      <form onSubmit={handleSubmit} className="space">
        <div className="reply-section">
          <div className="reply-section-title">Message</div>
          <textarea
            className="textarea reply-textarea"
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your staff reply here..."
            maxLength={MAX_MESSAGE_LENGTH + 50}
          />
          <div className="reply-help-row">
            <div className="muted" style={{ fontSize: 13 }}>
              Keep it clear, human, and useful. This becomes part of the premium staff
              workspace history.
            </div>
            <div
              className={`reply-counter ${
                remainingCharacters < 0
                  ? "danger"
                  : remainingCharacters < 300
                    ? "warn"
                    : ""
              }`}
            >
              {message.length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>
        </div>

        <div className="reply-section">
          <div className="reply-section-title">Attachment URLs</div>
          <textarea
            className="textarea reply-textarea small"
            rows={4}
            value={attachmentInput}
            onChange={(e) => setAttachmentInput(e.target.value)}
            placeholder="Optional attachment URLs, one per line..."
          />
          <div className="reply-help-row">
            <div className="muted" style={{ fontSize: 13 }}>
              Up to {MAX_ATTACHMENTS} attachment URLs. Only valid http/https links will
              be used.
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {parsedAttachments.totalEntered} entered
            </div>
          </div>

          {invalidAttachmentCount > 0 ? (
            <div className="reply-inline-warning">
              Invalid URLs detected: {parsedAttachments.invalid.slice(0, 3).join(" • ")}
              {invalidAttachmentCount > 3
                ? ` • +${invalidAttachmentCount - 3} more`
                : ""}
            </div>
          ) : null}

          {parsedAttachments.trimmedCount > 0 ? (
            <div className="reply-inline-warning">
              {parsedAttachments.trimmedCount} attachment URL(s) exceed the {MAX_ATTACHMENTS} attachment limit and will be ignored.
            </div>
          ) : null}

          <AttachmentPreview
            attachments={parsedAttachments.attachments}
            onRemove={removeAttachment}
          />
        </div>

        <div className="reply-footer">
          <div className="muted reply-footer-note">
            Replies are saved to <strong>ticket_messages</strong>, logged into activity
            history, and mirrored to Discord when the ticket is linked.
          </div>

          <button
            type="submit"
            className="button primary"
            disabled={
              busy ||
              !trimmedMessage ||
              trimmedMessage.length > MAX_MESSAGE_LENGTH ||
              invalidAttachmentCount > 0
            }
            style={{ width: "auto", minWidth: 160 }}
          >
            {busy ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .premium-reply-box {
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .reply-toolbar-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .reply-pill {
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

        .reply-pill.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .reply-pill.danger {
          border-color: rgba(248,113,113,0.24);
          background: rgba(248,113,113,0.08);
        }

        .reply-section {
          display: grid;
          gap: 10px;
        }

        .reply-section-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
        }

        .reply-textarea {
          min-height: 150px;
        }

        .reply-textarea.small {
          min-height: 96px;
        }

        .reply-help-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .reply-counter {
          font-size: 12px;
          color: var(--muted, #9fb0c3);
        }

        .reply-counter.warn {
          color: #fbbf24;
        }

        .reply-counter.danger {
          color: #f87171;
        }

        .reply-inline-warning {
          border-radius: 14px;
          border: 1px solid rgba(251,191,36,0.18);
          background: rgba(251,191,36,0.08);
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.35;
          color: #fde68a;
          overflow-wrap: anywhere;
        }

        .reply-attachment-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .reply-attachment-card {
          display: grid;
          gap: 10px;
          padding: 10px;
          border-radius: 16px;
          border: 1px solid rgba(99,213,255,0.14);
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.08), transparent 42%),
            rgba(99,213,255,0.04);
          min-width: 0;
        }

        .reply-attachment-thumb {
          width: 100%;
          height: 160px;
          border-radius: 14px;
          object-fit: cover;
          object-position: center;
          display: block;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .reply-attachment-thumb.fallback {
          display: grid;
          place-items: center;
          font-size: 28px;
          color: #fff;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%),
            linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98));
        }

        .reply-attachment-meta {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .reply-attachment-name {
          font-weight: 700;
          color: var(--text-strong, #f8fafc);
          overflow-wrap: anywhere;
          line-height: 1.35;
        }

        .reply-attachment-submeta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          color: var(--muted, #9fb0c3);
          font-size: 12px;
          line-height: 1.4;
        }

        .reply-attachment-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .reply-mini-link {
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
          cursor: pointer;
        }

        .reply-mini-link.danger {
          border-color: rgba(248,113,113,0.24);
          background: rgba(248,113,113,0.08);
          color: #fecaca;
        }

        .reply-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .reply-footer-note {
          min-width: 0;
          flex: 1;
          overflow-wrap: anywhere;
        }

        :global(.warn-banner) {
          border-radius: 14px;
          border: 1px solid rgba(251,191,36,0.2);
          background: rgba(251,191,36,0.08);
          padding: 12px 14px;
          color: #fde68a;
          margin-bottom: 12px;
        }

        @media (max-width: 860px) {
          .reply-attachment-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .reply-footer {
            display: grid;
            grid-template-columns: 1fr;
          }

          .reply-footer :global(.button) {
            width: 100% !important;
            min-width: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
