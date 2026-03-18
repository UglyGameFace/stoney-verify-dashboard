"use client";

import { useMemo, useState } from "react";
import {
  assignTicketAction,
  closeTicketAction,
  deleteTicketAction,
  reopenTicketAction,
} from "@/lib/dashboardActions";

type TicketLike = {
  id?: string;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  title?: string | null;
  username?: string | null;
  category?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  claimed_by?: string | null;
  closed_by?: string | null;
  closed_reason?: string | null;
  closed_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  transcript_url?: string | null;
  transcript_message_id?: string | null;
  transcript_channel_id?: string | null;
  source?: string | null;
  is_ghost?: boolean | null;
};

type TicketControlsProps = {
  ticket: TicketLike;
  currentStaffId?: string | null;
  className?: string;
  onChanged?: () => void | Promise<void>;
};

type ActionState =
  | "idle"
  | "assigning"
  | "closing"
  | "reopening"
  | "deleting";

function getChannelId(ticket: TicketLike): string {
  return String(ticket.channel_id || ticket.discord_thread_id || "").trim();
}

function isClosed(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "closed";
}

function isDeleted(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "deleted";
}

function isOpen(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "open";
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function buttonClass(
  kind: "primary" | "danger" | "secondary" | "success",
  disabled = false
): string {
  const base = "button";
  const tone =
    kind === "primary"
      ? " primary"
      : kind === "danger"
      ? " danger"
      : kind === "success"
      ? " primary"
      : " ghost";

  return `${base}${tone}${disabled ? " is-disabled" : ""}`;
}

function panelClass(): string {
  return "ticket-controls-panel";
}

function inputClass(): string {
  return "input";
}

function detailCardClass(): string {
  return "member-detail-item";
}

function miniLabelClass(): string {
  return "ticket-info-label";
}

function miniValueClass(): string {
  return "ticket-controls-mini-value";
}

export default function TicketControls({
  ticket,
  currentStaffId,
  className = "",
  onChanged,
}: TicketControlsProps) {
  const channelId = useMemo(() => getChannelId(ticket), [ticket]);
  const ghost = normalizeBoolean(ticket.is_ghost);
  const closed = isClosed(ticket.status);
  const deleted = isDeleted(ticket.status);
  const open = isOpen(ticket.status);

  const transcriptUrl = safeText(ticket.transcript_url, "");
  const transcriptMessageId = safeText(ticket.transcript_message_id, "");
  const transcriptChannelId = safeText(ticket.transcript_channel_id, "");
  const hasTranscript =
    !!transcriptUrl || !!transcriptMessageId || !!transcriptChannelId;

  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deleteReason, setDeleteReason] = useState("Deleted from dashboard");
  const [forceTranscript, setForceTranscript] = useState(false);

  const [showClosePanel, setShowClosePanel] = useState(false);
  const [closeReason, setCloseReason] = useState("Resolved");

  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);

  const busy = actionState !== "idle";
  const assignDisabled = busy || !channelId || !currentStaffId || deleted;
  const closeDisabled = busy || !channelId || deleted || closed;
  const reopenDisabled = busy || !channelId || deleted || open;
  const deleteDisabled = busy || !channelId || deleted;

  async function afterChange(ok: boolean) {
    if (!ok) return;
    if (onChanged) {
      await onChanged();
    }
  }

  async function handleAssign() {
    if (!channelId || !currentStaffId) {
      setError("Missing channel ID or current staff ID.");
      return;
    }

    setError("");
    setMessage("");
    setActionState("assigning");

    try {
      const result = await assignTicketAction({
        channelId,
        staffId: currentStaffId,
        requestedBy: currentStaffId,
      });

      if (!result.ok) {
        throw new Error(result.command?.error || "Failed to assign ticket.");
      }

      setMessage("Ticket assigned.");
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleClose() {
    if (!channelId) {
      setError("Missing channel ID.");
      return;
    }

    setError("");
    setMessage("");
    setActionState("closing");

    try {
      const result = await closeTicketAction({
        channelId,
        reason: closeReason.trim() || "Resolved",
        staffId: currentStaffId ?? null,
        requestedBy: currentStaffId ?? null,
      });

      if (!result.ok) {
        throw new Error(result.command?.error || "Failed to close ticket.");
      }

      setMessage("Ticket closed.");
      setShowClosePanel(false);
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleReopen() {
    if (!channelId) {
      setError("Missing channel ID.");
      return;
    }

    setError("");
    setMessage("");
    setActionState("reopening");

    try {
      const result = await reopenTicketAction({
        channelId,
        staffId: currentStaffId ?? null,
        requestedBy: currentStaffId ?? null,
      });

      if (!result.ok) {
        throw new Error(result.command?.error || "Failed to reopen ticket.");
      }

      setMessage("Ticket reopened.");
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleDelete() {
    if (!channelId) {
      setError("Missing channel ID.");
      return;
    }

    setError("");
    setMessage("");
    setActionState("deleting");

    try {
      const result = await deleteTicketAction({
        channelId,
        ghost,
        forceTranscript: ghost ? forceTranscript : true,
        reason: deleteReason.trim() || "Deleted from dashboard",
        staffId: currentStaffId ?? null,
        requestedBy: currentStaffId ?? null,
      });

      if (!result.ok) {
        throw new Error(result.command?.error || "Failed to delete ticket.");
      }

      setMessage(
        ghost
          ? forceTranscript
            ? "Ghost ticket deleted with transcript."
            : "Ghost ticket deleted."
          : "Ticket deleted after transcript posted."
      );

      setShowDeletePanel(false);
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket.");
    } finally {
      setActionState("idle");
    }
  }

  return (
    <div className={`ticket-controls ${className}`}>
      <div className="ticket-controls-bar">
        <button
          type="button"
          className={buttonClass("primary", assignDisabled)}
          disabled={assignDisabled}
          onClick={handleAssign}
        >
          {actionState === "assigning" ? "Assigning..." : "Assign / Claim"}
        </button>

        <button
          type="button"
          className={buttonClass("secondary", closeDisabled)}
          disabled={closeDisabled}
          onClick={() => {
            setError("");
            setMessage("");
            setShowClosePanel((v) => !v);
            if (showDeletePanel) setShowDeletePanel(false);
          }}
        >
          {closed ? "Already Closed" : "Close"}
        </button>

        <button
          type="button"
          className={buttonClass("success", reopenDisabled)}
          disabled={reopenDisabled}
          onClick={handleReopen}
        >
          {actionState === "reopening" ? "Reopening..." : "Reopen"}
        </button>

        <button
          type="button"
          className={buttonClass("danger", deleteDisabled)}
          disabled={deleteDisabled}
          onClick={() => {
            setError("");
            setMessage("");
            setShowDeletePanel((v) => !v);
            if (showClosePanel) setShowClosePanel(false);
          }}
        >
          Delete
        </button>

        <button
          type="button"
          className={buttonClass("secondary", false)}
          onClick={() => {
            setShowTranscriptPanel((v) => !v);
          }}
        >
          {showTranscriptPanel ? "Hide Transcript" : "Transcript"}
        </button>
      </div>

      {showClosePanel && !deleted && (
        <div className={panelClass()}>
          <div className="ticket-controls-title">Close Ticket</div>
          <div className="ticket-controls-copy">
            This keeps the ticket record and channel, but marks the ticket as
            closed.
          </div>
          <input
            className={inputClass()}
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Reason for closing"
          />
          <div className="ticket-controls-actions">
            <button
              type="button"
              className={buttonClass("secondary", busy)}
              disabled={busy}
              onClick={() => setShowClosePanel(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass("primary", busy)}
              disabled={busy}
              onClick={handleClose}
            >
              {actionState === "closing" ? "Closing..." : "Confirm Close"}
            </button>
          </div>
        </div>
      )}

      {showDeletePanel && !deleted && (
        <div className={panelClass()}>
          <div className="ticket-controls-title">
            {ghost ? "Delete Ghost Ticket" : "Delete Ticket"}
          </div>

          <div className="ticket-controls-copy">
            {ghost
              ? "Ghost tickets do not require transcript posting, but staff can choose to include one."
              : "Normal tickets must post a transcript before the channel is deleted, just like the Discord workflow."}
          </div>

          <input
            className={inputClass()}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Reason for deletion"
          />

          {ghost && (
            <label className="ticket-controls-check">
              <input
                type="checkbox"
                checked={forceTranscript}
                onChange={(e) => setForceTranscript(e.target.checked)}
              />
              <span>Post transcript before deleting this ghost ticket</span>
            </label>
          )}

          {!ghost && (
            <div className="info-banner">
              Transcript posting is automatically required for normal tickets.
            </div>
          )}

          <div className="ticket-controls-actions">
            <button
              type="button"
              className={buttonClass("secondary", busy)}
              disabled={busy}
              onClick={() => setShowDeletePanel(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass("danger", busy)}
              disabled={busy}
              onClick={handleDelete}
            >
              {actionState === "deleting" ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      )}

      {showTranscriptPanel && (
        <div className={panelClass()}>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="ticket-controls-title">
                Transcript & Ticket History
              </div>
              <div className="ticket-controls-copy">
                Mirrors your Discord-side workflow: transcript details,
                closure, and deletion history.
              </div>
            </div>

            <div className="roles" style={{ justifyContent: "flex-end" }}>
              {hasTranscript ? (
                <span className="badge claimed">Transcript Available</span>
              ) : (
                <span className="badge">No Transcript Yet</span>
              )}

              {deleted ? (
                <span className="badge danger">Deleted</span>
              ) : closed ? (
                <span className="badge medium">Closed</span>
              ) : (
                <span className="badge open">Open</span>
              )}
            </div>
          </div>

          <div className="ticket-controls-info-grid">
            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Ticket</div>
              <div className={miniValueClass()}>
                {safeText(ticket.title || ticket.channel_name, "Untitled")}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Category</div>
              <div className={miniValueClass()}>{safeText(ticket.category)}</div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Channel ID</div>
              <div className={miniValueClass()}>{safeText(channelId)}</div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Transcript URL</div>
              <div className={miniValueClass()}>
                {transcriptUrl ? (
                  <a
                    href={transcriptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ticket-inline-link"
                  >
                    Open Transcript
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Transcript Message ID</div>
              <div className={miniValueClass()}>
                {transcriptMessageId || "—"}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Transcript Channel ID</div>
              <div className={miniValueClass()}>
                {transcriptChannelId || "—"}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Closed By</div>
              <div className={miniValueClass()}>{safeText(ticket.closed_by)}</div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Closed At</div>
              <div className={miniValueClass()}>
                {formatDateTime(ticket.closed_at)}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Closed Reason</div>
              <div className={miniValueClass()}>
                {safeText(ticket.closed_reason)}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Deleted By</div>
              <div className={miniValueClass()}>{safeText(ticket.deleted_by)}</div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Deleted At</div>
              <div className={miniValueClass()}>
                {formatDateTime(ticket.deleted_at)}
              </div>
            </div>

            <div className={detailCardClass()}>
              <div className={miniLabelClass()}>Source</div>
              <div className={miniValueClass()}>{safeText(ticket.source)}</div>
            </div>
          </div>

          {hasTranscript ? (
            <div className="ticket-controls-actions">
              {transcriptUrl ? (
                <a
                  href={transcriptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("primary", false)}
                >
                  Open Transcript
                </a>
              ) : null}

              {transcriptMessageId ? (
                <button
                  type="button"
                  className={buttonClass("secondary", false)}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(transcriptMessageId);
                      setMessage("Transcript message ID copied.");
                      setError("");
                    } catch {
                      setError("Could not copy transcript message ID.");
                    }
                  }}
                >
                  Copy Message ID
                </button>
              ) : null}

              {transcriptChannelId ? (
                <button
                  type="button"
                  className={buttonClass("secondary", false)}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(transcriptChannelId);
                      setMessage("Transcript channel ID copied.");
                      setError("");
                    } catch {
                      setError("Could not copy transcript channel ID.");
                    }
                  }}
                >
                  Copy Channel ID
                </button>
              ) : null}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 12 }}>
              Transcript data will appear here after the ticket is closed or
              deleted through the bot workflow.
            </div>
          )}
        </div>
      )}

      {!!message && <div className="info-banner">{message}</div>}
      {!!error && <div className="error-banner">{error}</div>}

      <div className="ticket-controls-footnote">
        <div>
          <span className="ticket-controls-footnote-label">Ticket:</span>{" "}
          {ticket.title || ticket.channel_name || "Untitled"}
        </div>
        <div>
          <span className="ticket-controls-footnote-label">Channel ID:</span>{" "}
          {channelId || "Missing"}
        </div>
        <div>
          <span className="ticket-controls-footnote-label">Status:</span>{" "}
          {ticket.status || "unknown"}
        </div>
        <div>
          <span className="ticket-controls-footnote-label">Ghost:</span>{" "}
          {ghost ? "yes" : "no"}
        </div>
      </div>
    </div>
  );
}
