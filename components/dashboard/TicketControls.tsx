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

function buttonClass(kind: "primary" | "danger" | "secondary" | "success", disabled = false) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition border";
  const palette =
    kind === "primary"
      ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
      : kind === "danger"
      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
      : kind === "success"
      ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
      : "bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800";
  const off = disabled ? " opacity-50 cursor-not-allowed hover:bg-inherit" : "";
  return `${base} ${palette}${off}`;
}

function panelClass() {
  return "rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3";
}

function inputClass() {
  return "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500";
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

  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deleteReason, setDeleteReason] = useState("Deleted from dashboard");
  const [forceTranscript, setForceTranscript] = useState(false);

  const [showClosePanel, setShowClosePanel] = useState(false);
  const [closeReason, setCloseReason] = useState("Resolved");

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
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap gap-2">
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
      </div>

      {showClosePanel && !deleted && (
        <div className={panelClass()}>
          <div className="mb-2 text-sm font-semibold text-white">
            Close Ticket
          </div>
          <div className="mb-2 text-xs text-zinc-400">
            This keeps the ticket record and channel, but marks the ticket as closed.
          </div>
          <input
            className={inputClass()}
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Reason for closing"
          />
          <div className="mt-3 flex flex-wrap gap-2">
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
          <div className="mb-2 text-sm font-semibold text-white">
            {ghost ? "Delete Ghost Ticket" : "Delete Ticket"}
          </div>

          <div className="mb-2 text-xs text-zinc-400">
            {ghost
              ? "Ghost tickets do not require transcript posting, but staff can choose to include one."
              : "Normal tickets must post a transcript before the channel is deleted."}
          </div>

          <input
            className={inputClass()}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Reason for deletion"
          />

          {ghost && (
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={forceTranscript}
                onChange={(e) => setForceTranscript(e.target.checked)}
              />
              Post transcript before deleting this ghost ticket
            </label>
          )}

          {!ghost && (
            <div className="mt-3 rounded-xl border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
              Transcript posting is automatically required for normal tickets.
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
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

      {!!message && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {!!error && (
        <div className="rounded-xl border border-red-800 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
        <div>
          <span className="font-semibold text-zinc-300">Ticket:</span>{" "}
          {ticket.title || ticket.channel_name || "Untitled"}
        </div>
        <div>
          <span className="font-semibold text-zinc-300">Channel ID:</span>{" "}
          {channelId || "Missing"}
        </div>
        <div>
          <span className="font-semibold text-zinc-300">Status:</span>{" "}
          {ticket.status || "unknown"}
        </div>
        <div>
          <span className="font-semibold text-zinc-300">Ghost:</span>{" "}
          {ghost ? "yes" : "no"}
        </div>
      </div>
    </div>
  );
}
