"use client";

import { useMemo, useState } from "react";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS = 10;

function normalizeText(value) {
  return String(value || "").trim();
}

function truncateText(value, max = 120) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function isLikelyUrl(value) {
  const text = normalizeText(value);
  if (!text) return false;

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseAttachments(value) {
  const rows = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const attachments = [];
  const invalid = [];

  rows.forEach((url, index) => {
    if (!isLikelyUrl(url)) {
      invalid.push(url);
      return;
    }

    attachments.push({
      name: `attachment-${index + 1}`,
      url,
    });
  });

  return {
    attachments: attachments.slice(0, MAX_ATTACHMENTS),
    invalid,
    totalEntered: rows.length,
    trimmedCount: Math.max(0, attachments.length - MAX_ATTACHMENTS),
  };
}

function ToneBanner({ children, tone = "info" }) {
  if (!children) return null;

  const className =
    tone === "error"
      ? "error-banner"
      : tone === "warn"
        ? "warn-banner"
        : "info-banner";

  return <div className={className}>{children}</div>;
}

function AttachmentPreview({ attachments }) {
  if (!attachments.length) {
    return <div className="muted">No attachments queued.</div>;
  }

  return (
    <div className="attachment-preview-list">
      {attachments.map((item, index) => (
        <div key={`${item.url}-${index}`} className="attachment-preview-chip">
          <span className="attachment-preview-index">#{index + 1}</span>
          <span className="attachment-preview-url" title={item.url}>
            {truncateText(item.url, 80)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TicketReplyBox({ ticketId, onPosted }) {
  const [message, setMessage] = useState("");
  const [attachmentInput, setAttachmentInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");

  const parsedAttachments = useMemo(
    () => parseAttachments(attachmentInput),
    [attachmentInput]
  );

  const remainingCharacters = MAX_MESSAGE_LENGTH - message.length;
  const attachmentCount = parsedAttachments.attachments.length;
  const invalidAttachmentCount = parsedAttachments.invalid.length;

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Reply message cannot be empty.");
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Reply is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    if (invalidAttachmentCount > 0) {
      setError("One or more attachment URLs are invalid. Fix them before sending.");
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
          message: trimmedMessage,
          attachments: parsedAttachments.attachments,
        }),
      });

      const json = await res.json().catch(() => null);

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
      setError(err?.message || "Failed to send reply.");
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
            rows="7"
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
            rows="4"
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
              {parsedAttachments.trimmedCount} attachment URL(s) exceed the{" "}
              {MAX_ATTACHMENTS} attachment limit and will be ignored.
            </div>
          ) : null}

          <AttachmentPreview attachments={parsedAttachments.attachments} />
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
              !message.trim() ||
              message.trim().length > MAX_MESSAGE_LENGTH ||
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

        .attachment-preview-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .attachment-preview-chip {
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
        }

        .attachment-preview-index {
          color: var(--muted, #9fb0c3);
          flex-shrink: 0;
        }

        .attachment-preview-url {
          overflow-wrap: anywhere;
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
      `}</style>
    </div>
  );
}
