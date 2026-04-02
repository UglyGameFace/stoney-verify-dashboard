"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assignTicketAction,
  closeTicketAction,
  deleteTicketAction,
  reopenTicketAction,
} from "@/lib/dashboardActions";

type TicketCategory = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  description?: string | null;
  intake_type?: string | null;
  match_keywords?: string[] | null;
  button_label?: string | null;
  sort_order?: number | null;
  is_default?: boolean | null;
};

type TicketLike = {
  id?: string;
  channel_id?: string | null;
  discord_thread_id?: string | null;
  channel_name?: string | null;
  title?: string | null;
  username?: string | null;
  category?: string | null;
  category_id?: string | null;
  category_override?: boolean | null;
  category_set_by?: string | null;
  category_set_at?: string | null;
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
  matched_category_id?: string | null;
  matched_category_name?: string | null;
  matched_category_slug?: string | null;
  matched_intake_type?: string | null;
  matched_category_reason?: string | null;
  matched_category_score?: number | null;
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
  | "deleting"
  | "saving-category";

type PanelName = "overview" | "category" | "transcript" | "close" | "delete";

const MOBILE_LAYOUT_MAX_WIDTH = 1023;

function getChannelId(ticket: TicketLike): string {
  return String(ticket.channel_id || ticket.discord_thread_id || "").trim();
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
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

function isClosed(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "closed";
}

function isDeleted(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "deleted";
}

function isOpen(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "open";
}

function isClaimed(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "claimed";
}

function getStatusTone(status?: string | null): string {
  const value = String(status || "").toLowerCase();
  if (value === "open") return "open";
  if (value === "claimed") return "claimed";
  if (value === "closed") return "medium";
  if (value === "deleted") return "danger";
  return "";
}

function getCurrentCategoryId(ticket: TicketLike): string {
  return (
    normalizeString(ticket.category_id) ||
    normalizeString(ticket.matched_category_id) ||
    ""
  );
}

function getCurrentCategoryName(ticket: TicketLike): string {
  return (
    normalizeString(ticket.matched_category_name) ||
    normalizeString(ticket.category) ||
    "Uncategorized"
  );
}

function getCurrentCategoryReason(ticket: TicketLike): string {
  return normalizeString(ticket.matched_category_reason) || "No match reason";
}

function sortCategories(categories: TicketCategory[]): TicketCategory[] {
  return [...categories].sort((a, b) => {
    const sortA = Number(a?.sort_order ?? 9999);
    const sortB = Number(b?.sort_order ?? 9999);

    if (sortA !== sortB) return sortA - sortB;
    if (Boolean(b?.is_default) !== Boolean(a?.is_default)) {
      return b?.is_default ? 1 : -1;
    }

    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

function ActionAccordion({
  title,
  subtitle,
  badge,
  open,
  onToggle,
  children,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`ticket-action-accordion ${open ? "open" : ""} ${
        danger ? "danger" : ""
      }`}
    >
      <button
        type="button"
        className="ticket-action-accordion-head"
        onClick={onToggle}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ticket-action-accordion-title">{title}</div>
          {subtitle ? (
            <div className="muted ticket-action-accordion-copy">{subtitle}</div>
          ) : null}
        </div>

        <div className="ticket-action-accordion-side">
          {badge}
          <span className={`ticket-action-chevron ${open ? "open" : ""}`}>
            ⌄
          </span>
        </div>
      </button>

      {open ? (
        <div className="ticket-action-accordion-body">{children}</div>
      ) : null}
    </div>
  );
}

export default function TicketControls({
  ticket,
  currentStaffId,
  className = "",
  onChanged,
}: TicketControlsProps) {
  const channelId = useMemo(() => getChannelId(ticket), [ticket]);

  const derived = useMemo(() => {
    const ghost = normalizeBoolean(ticket.is_ghost);
    const closed = isClosed(ticket.status);
    const deleted = isDeleted(ticket.status);
    const open = isOpen(ticket.status);
    const claimed = isClaimed(ticket.status);

    const transcriptUrl = normalizeString(ticket.transcript_url);
    const transcriptMessageId = normalizeString(ticket.transcript_message_id);
    const transcriptChannelId = normalizeString(ticket.transcript_channel_id);

    const hasTranscript =
      !!transcriptUrl || !!transcriptMessageId || !!transcriptChannelId;

    return {
      ghost,
      closed,
      deleted,
      open,
      claimed,
      transcriptUrl,
      transcriptMessageId,
      transcriptChannelId,
      hasTranscript,
    };
  }, [ticket]);

  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState("");
  const [categoryLoadError, setCategoryLoadError] = useState("");
  const [message, setMessage] = useState("");

  const [deleteReason, setDeleteReason] = useState("Deleted from dashboard");
  const [forceTranscript, setForceTranscript] = useState(false);
  const [closeReason, setCloseReason] = useState("Resolved");

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    getCurrentCategoryId(ticket)
  );

  const [openPanels, setOpenPanels] = useState<Record<PanelName, boolean>>({
    overview: true,
    category: false,
    transcript: false,
    close: false,
    delete: false,
  });

  useEffect(() => {
    setSelectedCategoryId(getCurrentCategoryId(ticket));
    setError("");
    setMessage("");
    setForceTranscript(false);
    setOpenPanels((prev) => ({
      ...prev,
      overview: true,
      close: false,
      delete: false,
    }));
  }, [ticket?.id, ticket?.category_id, ticket?.matched_category_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      setCategoryLoadError("");

      try {
        const res = await fetch("/api/ticket-categories", {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load categories.");
        }

        if (!cancelled) {
          setCategories(sortCategories((json?.categories || []) as TicketCategory[]));
        }
      } catch (err) {
        if (!cancelled) {
          setCategoryLoadError(
            err instanceof Error ? err.message : "Failed to load categories."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const busy = actionState !== "idle";

  const assignDisabled =
    busy || !channelId || !currentStaffId || derived.deleted;
  const closeDisabled = busy || !channelId || derived.deleted || derived.closed;
  const reopenDisabled = busy || !channelId || derived.deleted || derived.open;
  const deleteDisabled = busy || !channelId || derived.deleted;
  const saveCategoryDisabled =
    busy || !ticket?.id || !selectedCategoryId || loadingCategories;

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) => String(category?.id || "") === String(selectedCategoryId)
      ) || null,
    [categories, selectedCategoryId]
  );

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function togglePanel(name: PanelName) {
    clearFeedback();
    setOpenPanels((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }

  function openPanel(name: PanelName) {
    clearFeedback();
    setOpenPanels((prev) => ({
      ...prev,
      [name]: true,
    }));
  }

  async function afterChange(ok: boolean) {
    if (!ok) return;
    if (onChanged) {
      await onChanged();
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setMessage(successMessage);
    } catch {
      setError("Could not copy to clipboard on this device.");
    }
  }

  async function handleAssign() {
    if (!channelId || !currentStaffId) {
      setError("Missing channel ID or current staff ID.");
      return;
    }

    clearFeedback();
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

    clearFeedback();
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
      setOpenPanels((prev) => ({
        ...prev,
        close: false,
        transcript: true,
      }));
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

    clearFeedback();
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

    clearFeedback();
    setActionState("deleting");

    try {
      const result = await deleteTicketAction({
        channelId,
        ghost: derived.ghost,
        forceTranscript: derived.ghost ? forceTranscript : true,
        reason: deleteReason.trim() || "Deleted from dashboard",
        staffId: currentStaffId ?? null,
        requestedBy: currentStaffId ?? null,
      });

      if (!result.ok) {
        throw new Error(result.command?.error || "Failed to delete ticket.");
      }

      setMessage(
        derived.ghost
          ? forceTranscript
            ? "Ghost ticket deleted with transcript."
            : "Ghost ticket deleted."
          : "Ticket deleted after transcript posted."
      );

      setOpenPanels((prev) => ({ ...prev, delete: false }));
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleSaveCategory() {
    if (!ticket?.id) {
      setError("Missing ticket ID.");
      return;
    }

    if (!selectedCategory) {
      setError("Choose a category first.");
      return;
    }

    clearFeedback();
    setActionState("saving-category");

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
        body: JSON.stringify({
          action: "update-category",
          category_id: selectedCategory.id,
          category: selectedCategory.slug || selectedCategory.name,
          category_override: true,
          category_set_by: currentStaffId ?? "",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update ticket category.");
      }

      setMessage("Ticket category updated.");
      await afterChange(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update ticket category."
      );
    } finally {
      setActionState("idle");
    }
  }

  return (
    <div className={`ticket-controls ${className}`}>
      <div className="ticket-controls-header-card">
        <div className="ticket-controls-header-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ticket-controls-header-title">Ticket Actions</div>
            <div className="muted ticket-controls-header-copy">
              Cleaner mobile-first control sheet for status, category,
              transcript, and deletion workflow.
            </div>
          </div>

          <div className="ticket-controls-status-row">
            <span className={`badge ${getStatusTone(ticket.status)}`}>
              {safeText(ticket.status, "unknown")}
            </span>
            {derived.ghost ? <span className="badge">Ghost</span> : null}
            {derived.hasTranscript ? (
              <span className="badge claimed">Transcript</span>
            ) : (
              <span className="badge">No Transcript</span>
            )}
          </div>
        </div>

        <div className="ticket-primary-actions">
          <button
            type="button"
            className="button primary"
            disabled={assignDisabled}
            onClick={handleAssign}
          >
            {actionState === "assigning"
              ? "Assigning..."
              : derived.claimed
                ? "Re-Assign"
                : "Assign / Claim"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={closeDisabled}
            onClick={() => openPanel("close")}
          >
            {derived.closed ? "Already Closed" : "Close"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={reopenDisabled}
            onClick={handleReopen}
          >
            {actionState === "reopening" ? "Reopening..." : "Reopen"}
          </button>

          <button
            type="button"
            className="button danger"
            disabled={deleteDisabled}
            onClick={() => openPanel("delete")}
          >
            Delete
          </button>
        </div>
      </div>

      <ActionAccordion
        title="Overview"
        subtitle="Current ticket state, channel identity, and quick copy actions."
        badge={<span className="badge open">Info</span>}
        open={openPanels.overview}
        onToggle={() => togglePanel("overview")}
      >
        <div className="ticket-controls-info-grid">
          <div className="member-detail-item">
            <div className="ticket-info-label">Ticket</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.title || ticket.channel_name, "Untitled")}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Category</div>
            <div className="ticket-controls-mini-value">
              {getCurrentCategoryName(ticket)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Channel ID</div>
            <div className="ticket-controls-mini-value">
              {safeText(channelId, "Missing")}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Claimed By</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.claimed_by)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Current Reason</div>
            <div className="ticket-controls-mini-value">
              {getCurrentCategoryReason(ticket)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Source</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.source)}
            </div>
          </div>
        </div>

        <div className="ticket-controls-actions">
          {channelId ? (
            <button
              type="button"
              className="button ghost"
              onClick={() => copyText(channelId, "Channel ID copied.")}
            >
              Copy Channel ID
            </button>
          ) : null}

          {!!ticket.title ? (
            <button
              type="button"
              className="button ghost"
              onClick={() =>
                copyText(String(ticket.title), "Ticket title copied.")
              }
            >
              Copy Title
            </button>
          ) : null}

          {!!ticket.claimed_by ? (
            <button
              type="button"
              className="button ghost"
              onClick={() =>
                copyText(String(ticket.claimed_by), "Claimed-by value copied.")
              }
            >
              Copy Claimed By
            </button>
          ) : null}
        </div>
      </ActionAccordion>

      <ActionAccordion
        title="Category Override"
        subtitle="Fix a wrong auto-match and assign the category staff actually want."
        badge={
          ticket?.category_override ? (
            <span className="badge claimed">Manual Override</span>
          ) : (
            <span className="badge">Auto Match</span>
          )
        }
        open={openPanels.category}
        onToggle={() => togglePanel("category")}
      >
        <div className="ticket-controls-info-grid" style={{ marginBottom: 12 }}>
          <div className="member-detail-item">
            <div className="ticket-info-label">Current Category</div>
            <div className="ticket-controls-mini-value">
              {getCurrentCategoryName(ticket)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Current Reason</div>
            <div className="ticket-controls-mini-value">
              {getCurrentCategoryReason(ticket)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Matched Intake Type</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket?.matched_intake_type)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Override Set At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(ticket?.category_set_at)}
            </div>
          </div>
        </div>

        {categoryLoadError ? (
          <div className="warning-banner">{categoryLoadError}</div>
        ) : null}

        <div className="ticket-controls-select-row">
          <select
            className="input"
            value={selectedCategoryId}
            disabled={loadingCategories || busy}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="">
              {loadingCategories ? "Loading categories..." : "Choose category"}
            </option>

            {categories.map((category) => (
              <option key={String(category.id)} value={String(category.id)}>
                {safeText(category.name, "Unnamed")}
                {normalizeString(category.intake_type)
                  ? ` • ${normalizeString(category.intake_type)}`
                  : ""}
                {category.is_default ? " • default" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="button primary"
            disabled={saveCategoryDisabled}
            onClick={handleSaveCategory}
          >
            {actionState === "saving-category" ? "Saving..." : "Save Category"}
          </button>
        </div>

        {selectedCategory ? (
          <div className="ticket-controls-info-grid" style={{ marginTop: 12 }}>
            <div className="member-detail-item">
              <div className="ticket-info-label">Selected Name</div>
              <div className="ticket-controls-mini-value">
                {safeText(selectedCategory.name)}
              </div>
            </div>

            <div className="member-detail-item">
              <div className="ticket-info-label">Selected Slug</div>
              <div className="ticket-controls-mini-value">
                {safeText(selectedCategory.slug)}
              </div>
            </div>

            <div className="member-detail-item">
              <div className="ticket-info-label">Selected Intake Type</div>
              <div className="ticket-controls-mini-value">
                {safeText(selectedCategory.intake_type)}
              </div>
            </div>

            <div className="member-detail-item">
              <div className="ticket-info-label">Description</div>
              <div className="ticket-controls-mini-value">
                {safeText(selectedCategory.description)}
              </div>
            </div>
          </div>
        ) : null}
      </ActionAccordion>

      <ActionAccordion
        title="Transcript & History"
        subtitle="Closure, deletion, transcript links, and archival proof."
        badge={
          derived.hasTranscript ? (
            <span className="badge claimed">Available</span>
          ) : (
            <span className="badge">Pending</span>
          )
        }
        open={openPanels.transcript}
        onToggle={() => togglePanel("transcript")}
      >
        <div className="ticket-controls-info-grid">
          <div className="member-detail-item">
            <div className="ticket-info-label">Transcript URL</div>
            <div className="ticket-controls-mini-value">
              {derived.transcriptUrl ? (
                <a
                  href={derived.transcriptUrl}
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

          <div className="member-detail-item">
            <div className="ticket-info-label">Transcript Message ID</div>
            <div className="ticket-controls-mini-value">
              {derived.transcriptMessageId || "—"}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Transcript Channel ID</div>
            <div className="ticket-controls-mini-value">
              {derived.transcriptChannelId || "—"}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Closed By</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.closed_by)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Closed At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(ticket.closed_at)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Closed Reason</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.closed_reason)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Deleted By</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.deleted_by)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Deleted At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(ticket.deleted_at)}
            </div>
          </div>
        </div>

        {derived.hasTranscript ? (
          <div className="ticket-controls-actions">
            {derived.transcriptUrl ? (
              <a
                href={derived.transcriptUrl}
                target="_blank"
                rel="noreferrer"
                className="button primary"
              >
                Open Transcript
              </a>
            ) : null}

            {derived.transcriptMessageId ? (
              <button
                type="button"
                className="button ghost"
                onClick={() =>
                  copyText(
                    derived.transcriptMessageId,
                    "Transcript message ID copied."
                  )
                }
              >
                Copy Message ID
              </button>
            ) : null}

            {derived.transcriptChannelId ? (
              <button
                type="button"
                className="button ghost"
                onClick={() =>
                  copyText(
                    derived.transcriptChannelId,
                    "Transcript channel ID copied."
                  )
                }
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
      </ActionAccordion>

      <ActionAccordion
        title="Close Ticket"
        subtitle="Marks the ticket as resolved while preserving the ticket record and channel."
        badge={<span className="badge medium">Resolve</span>}
        open={openPanels.close}
        onToggle={() => togglePanel("close")}
      >
        <input
          className="input"
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder="Reason for closing"
        />

        <div className="ticket-controls-actions">
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => togglePanel("close")}
          >
            Cancel
          </button>

          <button
            type="button"
            className="button primary"
            disabled={busy || closeDisabled}
            onClick={handleClose}
          >
            {actionState === "closing" ? "Closing..." : "Confirm Close"}
          </button>
        </div>
      </ActionAccordion>

      <ActionAccordion
        title={derived.ghost ? "Delete Ghost Ticket" : "Delete Ticket"}
        subtitle={
          derived.ghost
            ? "Ghost tickets can skip transcript posting unless staff explicitly want one."
            : "Normal tickets should delete only after transcript workflow is complete."
        }
        badge={<span className="badge danger">Danger</span>}
        open={openPanels.delete}
        onToggle={() => togglePanel("delete")}
        danger
      >
        <input
          className="input"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="Reason for deletion"
        />

        {derived.ghost ? (
          <label className="ticket-controls-check">
            <input
              type="checkbox"
              checked={forceTranscript}
              onChange={(e) => setForceTranscript(e.target.checked)}
            />
            <span>Post transcript before deleting this ghost ticket</span>
          </label>
        ) : (
          <div className="info-banner">
            Transcript posting is automatically required for normal tickets.
          </div>
        )}

        <div className="ticket-controls-actions">
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => togglePanel("delete")}
          >
            Cancel
          </button>

          <button
            type="button"
            className="button danger"
            disabled={busy || deleteDisabled}
            onClick={handleDelete}
          >
            {actionState === "deleting" ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </ActionAccordion>

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
          {derived.ghost ? "yes" : "no"}
        </div>
      </div>

      <style jsx>{`
        .ticket-controls {
          display: grid;
          gap: 12px;
        }

        .ticket-controls-header-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 14px;
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.06), transparent 36%),
            rgba(255, 255, 255, 0.025);
        }

        .ticket-controls-header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .ticket-controls-header-title {
          font-weight: 900;
          font-size: 18px;
          line-height: 1.05;
          color: var(--text-strong, #f8fafc);
          letter-spacing: -0.02em;
        }

        .ticket-controls-header-copy {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.5;
          max-width: 720px;
        }

        .ticket-controls-status-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .ticket-primary-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .ticket-action-accordion {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(99, 213, 255, 0.04), transparent 34%),
            rgba(255, 255, 255, 0.02);
        }

        .ticket-action-accordion.danger {
          border-color: rgba(248, 113, 113, 0.18);
          background:
            radial-gradient(circle at top right, rgba(248, 113, 113, 0.06), transparent 34%),
            rgba(255, 255, 255, 0.02);
        }

        .ticket-action-accordion.open {
          box-shadow: 0 0 18px rgba(99, 213, 255, 0.06);
        }

        .ticket-action-accordion-head {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          width: 100%;
          border: 0 !important;
          outline: none !important;
          box-shadow: none !important;
          background:
            radial-gradient(circle at top right, rgba(99, 213, 255, 0.04), transparent 36%),
            rgba(255, 255, 255, 0.015) !important;
          color: var(--text-strong, #f8fafc) !important;
          text-align: left;
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          border-radius: 0 !important;
          font: inherit !important;
        }

        .ticket-action-accordion-head:hover {
          background:
            radial-gradient(circle at top right, rgba(99, 213, 255, 0.08), transparent 36%),
            rgba(255, 255, 255, 0.03) !important;
        }

        .ticket-action-accordion-title {
          font-weight: 900;
          color: var(--text-strong, #f8fafc) !important;
          line-height: 1.08;
          letter-spacing: -0.02em;
        }

        .ticket-action-accordion-copy {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-muted, rgba(255, 255, 255, 0.72)) !important;
        }

        .ticket-action-accordion-side {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .ticket-action-chevron {
          font-size: 22px;
          line-height: 1;
          transition: transform 0.16s ease;
          color: var(--text-strong, #f8fafc) !important;
        }

        .ticket-action-chevron.open {
          transform: rotate(180deg);
        }

        .ticket-action-accordion-body {
          padding: 0 14px 14px;
          display: grid;
          gap: 12px;
          background: transparent;
        }

        .ticket-controls-select-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }

        .ticket-controls-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .ticket-controls-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .ticket-controls-check {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text);
          font-size: 13px;
          line-height: 1.4;
        }

        .ticket-controls-mini-value {
          margin-top: 2px;
          color: var(--text-strong, #f8fafc);
          font-size: 14px;
          overflow-wrap: anywhere;
          line-height: 1.45;
        }

        .ticket-inline-link {
          color: #c8f1ff;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .ticket-controls-footnote {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
          display: grid;
          gap: 4px;
        }

        .ticket-controls-footnote-label {
          font-weight: 700;
          color: var(--text-strong, #f8fafc);
        }

        @media (max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px) {
          .ticket-primary-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ticket-controls-info-grid,
          .ticket-controls-select-row {
            grid-template-columns: 1fr;
          }

          .ticket-controls-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .ticket-controls-actions :global(.button),
          .ticket-controls-actions a {
            width: 100%;
            min-width: 0;
            text-align: center;
          }
        }

        @media (max-width: 520px) {
          .ticket-primary-actions {
            grid-template-columns: 1fr;
          }

          .ticket-controls-header-card,
          .ticket-action-accordion-head,
          .ticket-action-accordion-body {
            padding-left: 12px;
            padding-right: 12px;
          }
        }
      `}</style>
    </div>
  );
}
