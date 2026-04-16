"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  user_id?: string | null;

  category?: string | null;
  raw_category?: string | null;
  category_id?: string | null;
  category_override?: boolean | null;
  category_set_by?: string | null;
  category_set_at?: string | null;

  status?: string | null;
  assigned_to?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  claimed_by?: string | null;
  claimed_by_id?: string | null;
  claimed_by_name?: string | null;

  closed_by?: string | null;
  closed_reason?: string | null;
  closed_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;

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

  is_claimed?: boolean | null;
  is_unclaimed?: boolean | null;

  owner_display_name?: string | null;
  owner_username?: string | null;
  owner_user_id?: string | null;
  owner_verification_label?: string | null;
  owner_entry_method?: string | null;
  owner_invited_by_name?: string | null;
  owner_vouched_by_name?: string | null;
  owner_approved_by_name?: string | null;
  owner_ticket_total?: number | null;
  owner_warn_count?: number | null;
  owner_flag_count?: number | null;
  owner_role_state?: string | null;

  risk_level?: string | null;
  note_count?: number | null;
  latest_activity_title?: string | null;
  latest_activity_at?: string | null;
  latest_note_staff_name?: string | null;
  latest_note_at?: string | null;
  overdue?: boolean | null;
  priority?: string | null;
  recommended_actions?: string[] | null;
};

type TicketControlsProps = {
  ticket: TicketLike;
  currentStaffId?: string | null;
  className?: string;
  onChanged?: () => void | Promise<void>;
};

type ActionState =
  | "idle"
  | "claiming"
  | "unclaiming"
  | "closing"
  | "reopening"
  | "deleting"
  | "saving-category"
  | "clearing-category"
  | "linking-verification-context"
  | "syncing-ticket"
  | "transferring";

type PanelName =
  | "workflow"
  | "repair"
  | "category"
  | "transfer"
  | "transcript"
  | "close"
  | "delete";

const MOBILE_LAYOUT_MAX_WIDTH = 1023;
const PLACEHOLDER_CATEGORY_VALUES = new Set([
  "",
  "uncategorized",
  "unknown",
  "none",
  "null",
  "undefined",
  "no-categories",
  "no categories",
  "general",
]);

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function titleize(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function isClosed(status?: string | null): boolean {
  return normalizeStatus(status) === "closed";
}

function isDeleted(status?: string | null): boolean {
  return normalizeStatus(status) === "deleted";
}

function isOpen(status?: string | null): boolean {
  return normalizeStatus(status) === "open";
}

function isClaimed(status?: string | null): boolean {
  return normalizeStatus(status) === "claimed";
}

function isPlaceholderCategory(value: unknown): boolean {
  return PLACEHOLDER_CATEGORY_VALUES.has(normalizeStatus(value));
}

function getStatusTone(status?: string | null): string {
  const value = normalizeStatus(status);
  if (value === "open") return "open";
  if (value === "claimed") return "claimed";
  if (value === "closed") return "medium";
  if (value === "deleted") return "danger";
  if (value === "high") return "danger";
  if (value === "urgent") return "danger";
  if (value === "medium") return "medium";
  if (value === "low") return "claimed";
  if (value === "verified") return "claimed";
  if (value === "pending") return "open";
  if (value === "needs review") return "danger";
  if (value === "denied") return "danger";
  if (value === "verification") return "claimed";
  return "";
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

function buildTranscriptExportUrl(
  ticketId: string,
  format?: "html" | "txt" | "json"
): string {
  const base = `/api/tickets/${encodeURIComponent(ticketId)}/transcript`;
  if (!format || format === "html") return base;
  return `${base}?format=${format}`;
}

function getChannelId(ticket: TicketLike): string {
  return String(ticket.channel_id || ticket.discord_thread_id || "").trim();
}

function getCurrentCategoryId(ticket: TicketLike): string {
  return (
    normalizeString(ticket.category_id) ||
    normalizeString(ticket.matched_category_id) ||
    ""
  );
}

function getCurrentCategoryName(ticket: TicketLike): string {
  const matchedName = normalizeString(ticket.matched_category_name);
  const matchedSlug = normalizeString(ticket.matched_category_slug);
  const category = normalizeString(ticket.category);
  const rawCategory = normalizeString(ticket.raw_category);

  if (matchedName && !isPlaceholderCategory(matchedName)) return titleize(matchedName);
  if (matchedSlug && !isPlaceholderCategory(matchedSlug)) return titleize(matchedSlug);
  if (category && !isPlaceholderCategory(category)) return titleize(category);
  if (rawCategory && !isPlaceholderCategory(rawCategory)) return titleize(rawCategory);

  const intake = normalizeString(ticket.matched_intake_type);
  if (intake) return titleize(intake);

  return "Support";
}

function getCurrentCategoryReason(ticket: TicketLike): string {
  const reason = normalizeString(ticket.matched_category_reason);
  if (!reason) return "No match reason";
  if (normalizeStatus(reason) === "no-categories") return "No match reason";
  return reason;
}

function getCurrentCategorySlug(ticket: TicketLike): string {
  const slug =
    normalizeString(ticket.matched_category_slug) ||
    normalizeString(ticket.category) ||
    "";
  return slug ? titleize(slug) : "—";
}

function getClaimedById(ticket: TicketLike): string {
  return normalizeString(
    ticket.claimed_by_id ||
      ticket.assigned_to_id ||
      ticket.assigned_to ||
      ticket.claimed_by
  );
}

function getClaimedByLabel(ticket: TicketLike): string {
  return (
    normalizeString(ticket.claimed_by_name) ||
    normalizeString(ticket.assigned_to_name) ||
    normalizeString(ticket.claimed_by) ||
    normalizeString(ticket.assigned_to) ||
    "Unclaimed"
  );
}

function getOwnerLabel(ticket: TicketLike): string {
  return (
    normalizeString(ticket.owner_display_name) ||
    normalizeString(ticket.username) ||
    normalizeString(ticket.owner_username) ||
    normalizeString(ticket.title) ||
    normalizeString(ticket.user_id) ||
    normalizeString(ticket.owner_user_id) ||
    "Unknown member"
  );
}

function getVerificationLabel(ticket: TicketLike): string {
  return normalizeString(ticket.owner_verification_label) || "Unknown";
}

function getEntryMethodLabel(ticket: TicketLike): string {
  return (
    titleize(ticket.owner_entry_method) ||
    titleize(ticket.source) ||
    "Unknown"
  );
}

function ticketIsClaimed(ticket: TicketLike): boolean {
  if (ticket.is_claimed === true) return true;
  if (isClaimed(ticket.status)) return true;
  return Boolean(getClaimedById(ticket));
}

function ticketIsUnclaimed(ticket: TicketLike): boolean {
  if (ticket.is_unclaimed === true) return true;
  if (!isOpen(ticket.status)) return false;
  return !getClaimedById(ticket);
}

function getQueueStateLabel(ticket: TicketLike): string {
  if (ticketIsUnclaimed(ticket)) return "Unclaimed";
  if (ticketIsClaimed(ticket)) return "Claimed";
  if (isClosed(ticket.status)) return "Closed";
  if (isDeleted(ticket.status)) return "Deleted";
  if (isOpen(ticket.status)) return "Open";
  return safeText(ticket.status, "unknown");
}

function getTranscriptState(ticket: TicketLike) {
  const transcriptUrl = normalizeString(ticket.transcript_url);
  const transcriptMessageId = normalizeString(ticket.transcript_message_id);
  const transcriptChannelId = normalizeString(ticket.transcript_channel_id);
  const hasTranscript = Boolean(
    transcriptUrl || transcriptMessageId || transcriptChannelId
  );

  const status = normalizeStatus(ticket.status);
  const transcriptState = hasTranscript
    ? "available"
    : status === "closed" || status === "deleted"
      ? "expected_missing"
      : "not_ready";

  return {
    transcriptUrl,
    transcriptMessageId,
    transcriptChannelId,
    hasTranscript,
    transcriptState,
  };
}

function getRecommendedActions(ticket: TicketLike): string[] {
  if (Array.isArray(ticket.recommended_actions)) {
    return ticket.recommended_actions.filter(Boolean);
  }

  const actions: string[] = [];
  if (ticket.is_unclaimed === true) actions.push("Claim this ticket");
  if (ticket.overdue === true) actions.push("Respond immediately");
  if (normalizeStatus(ticket.priority) === "urgent") actions.push("Handle urgently");
  if (Number(ticket.note_count || 0) <= 0) actions.push("Add internal note");
  if (!getChannelId(ticket)) actions.push("Repair missing channel");
  return actions;
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
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
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

async function copyTextToClipboard(value: string) {
  const clean = normalizeString(value);
  if (!clean) return { ok: false as const, error: "Nothing to copy." };

  try {
    await navigator.clipboard.writeText(clean);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not copy to clipboard." };
  }
}

async function postJson(url: string, body?: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
    body: JSON.stringify(body || {}),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status}).`);
  }

  return json;
}

export default function TicketControls({
  ticket,
  currentStaffId,
  className = "",
  onChanged,
}: TicketControlsProps) {
  const channelId = useMemo(() => getChannelId(ticket), [ticket]);
  const ticketId = useMemo(() => normalizeString(ticket?.id), [ticket]);

  const derived = useMemo(() => {
    const ghost = normalizeBoolean(ticket.is_ghost);
    const closed = isClosed(ticket.status);
    const deleted = isDeleted(ticket.status);
    const open = isOpen(ticket.status);
    const claimed = ticketIsClaimed(ticket);
    const unclaimed = ticketIsUnclaimed(ticket);
    const claimedById = getClaimedById(ticket);
    const mine =
      Boolean(currentStaffId) &&
      claimed &&
      claimedById === normalizeString(currentStaffId);

    const transcript = getTranscriptState(ticket);
    const missingChannel = !getChannelId(ticket);
    const manualCategory = normalizeBoolean(ticket.category_override);
    const currentIntakeType = titleize(ticket?.matched_intake_type) || "—";
    const shouldOfferVerificationLink =
      currentIntakeType.toLowerCase().includes("verification") ||
      normalizeString(ticket?.matched_category_slug).toLowerCase().includes("verification") ||
      normalizeString(ticket?.matched_category_name).toLowerCase().includes("verification") ||
      normalizeString(ticket?.category).toLowerCase().includes("verification");

    return {
      ghost,
      closed,
      deleted,
      open,
      claimed,
      unclaimed,
      mine,
      missingChannel,
      claimedById,
      transcriptUrl: transcript.transcriptUrl,
      transcriptMessageId: transcript.transcriptMessageId,
      transcriptChannelId: transcript.transcriptChannelId,
      hasTranscript: transcript.hasTranscript,
      transcriptState: transcript.transcriptState,
      currentCategoryName: getCurrentCategoryName(ticket),
      currentCategorySlug: getCurrentCategorySlug(ticket),
      currentCategoryReason: getCurrentCategoryReason(ticket),
      currentCategoryScore: Number(ticket?.matched_category_score ?? 0),
      currentIntakeType,
      ownerLabel: getOwnerLabel(ticket),
      claimedBy: getClaimedByLabel(ticket),
      queueStateLabel: getQueueStateLabel(ticket),
      verificationLabel: getVerificationLabel(ticket),
      entryMethodLabel: getEntryMethodLabel(ticket),
      riskLevel: normalizeString(ticket?.risk_level) || "unknown",
      latestActivityTitle:
        normalizeString(ticket?.latest_activity_title) || "No recent activity",
      latestActivityAt: normalizeString(ticket?.latest_activity_at),
      noteCount: Number(ticket?.note_count ?? 0),
      priority: normalizeString(ticket?.priority) || "medium",
      overdue: ticket?.overdue === true,
      recommendedActions: getRecommendedActions(ticket),
      warnCount: Number(ticket?.owner_warn_count ?? 0),
      flagCount: Number(ticket?.owner_flag_count ?? 0),
      priorTickets: Number(ticket?.owner_ticket_total ?? 0),
      invitedBy: normalizeString(ticket?.owner_invited_by_name) || "—",
      vouchedBy: normalizeString(ticket?.owner_vouched_by_name) || "—",
      approvedBy: normalizeString(ticket?.owner_approved_by_name) || "—",
      roleState: normalizeString(ticket?.owner_role_state) || "unknown",
      latestNoteStaff: normalizeString(ticket?.latest_note_staff_name) || "—",
      latestNoteAt: normalizeString(ticket?.latest_note_at),
      manualCategory,
      shouldOfferVerificationLink,
    };
  }, [ticket, currentStaffId]);

  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState("");
  const [categoryLoadError, setCategoryLoadError] = useState("");
  const [message, setMessage] = useState("");

  const [deleteReason, setDeleteReason] = useState("Deleted from dashboard");
  const [forceTranscript, setForceTranscript] = useState(false);
  const [closeReason, setCloseReason] = useState("Resolved");
  const [transferReason, setTransferReason] = useState("Transferred by staff");
  const [transferTarget, setTransferTarget] = useState("");

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    getCurrentCategoryId(ticket)
  );

  const [openPanels, setOpenPanels] = useState<Record<PanelName, boolean>>({
    workflow: true,
    repair: false,
    category: false,
    transfer: false,
    transcript: false,
    close: false,
    delete: false,
  });

  useEffect(() => {
    setSelectedCategoryId(getCurrentCategoryId(ticket));
    setError("");
    setMessage("");
    setForceTranscript(false);
    setCloseReason(normalizeString(ticket?.closed_reason) || "Resolved");
    setDeleteReason("Deleted from dashboard");
    setTransferReason("Transferred by staff");
    setTransferTarget("");

    setOpenPanels((prev) => ({
      ...prev,
      workflow: true,
      repair: derived.missingChannel,
      category: false,
      transfer: false,
      transcript: derived.hasTranscript || derived.closed || derived.deleted,
      close: false,
      delete: false,
    }));
  }, [
    ticket?.id,
    ticket?.category_id,
    ticket?.matched_category_id,
    ticket?.closed_reason,
    derived.hasTranscript,
    derived.closed,
    derived.deleted,
    derived.missingChannel,
  ]);

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

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const busy = actionState !== "idle";

  const claimDisabled =
    busy ||
    !ticketId ||
    !currentStaffId ||
    derived.deleted ||
    (derived.claimed && !derived.mine);

  const unclaimDisabled =
    busy ||
    !ticketId ||
    !currentStaffId ||
    derived.deleted ||
    !derived.claimed;

  const closeDisabled = busy || !ticketId || derived.deleted || derived.closed;
  const reopenDisabled = busy || !ticketId || derived.deleted || derived.open;
  const deleteDisabled = busy || !ticketId || derived.deleted;
  const syncDisabled = busy || !channelId;
  const saveCategoryDisabled =
    busy || !ticket?.id || !selectedCategoryId || loadingCategories;
  const clearCategoryDisabled =
    busy || !ticket?.id || !derived.manualCategory;
  const linkVerificationContextDisabled =
    busy || !ticket?.id || !derived.shouldOfferVerificationLink;
  const transferDisabled =
    busy || !ticketId || derived.deleted || derived.closed || !transferTarget.trim();

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

  async function handleCopy(value: string, successMessage: string) {
    const result = await copyTextToClipboard(value);

    if (result.ok === true) {
      setError("");
      setMessage(successMessage);
      return;
    }

    setError(result.error || "Could not copy to clipboard.");
  }

  async function handleClaim() {
    if (!ticketId || !currentStaffId) {
      setError("Missing ticket ID or current staff ID.");
      return;
    }

    if (derived.claimed && !derived.mine) {
      setError("This ticket is already claimed by another staff member.");
      return;
    }

    clearFeedback();
    setActionState("claiming");

    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/claim`);
      setMessage(
        derived.mine
          ? "Ticket is already assigned to you."
          : derived.claimed
            ? "Ticket claim refreshed."
            : "Ticket claimed."
      );
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleUnclaim() {
    if (!ticketId || !currentStaffId) {
      setError("Missing ticket ID or current staff ID.");
      return;
    }

    clearFeedback();
    setActionState("unclaiming");

    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/unclaim`);
      setMessage("Ticket unclaimed.");
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unclaim ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleSyncOne(dryRun: boolean) {
    if (!channelId) {
      setError("Missing channel ID.");
      return;
    }

    clearFeedback();
    setActionState("syncing-ticket");

    try {
      await postJson("/api/tickets/sync-one", {
        channel_id: channelId,
        dry_run: dryRun,
        requested_by: currentStaffId ?? null,
        staff_id: currentStaffId ?? null,
      });

      setMessage(
        dryRun ? "Ticket sync preview completed." : "Ticket sync completed."
      );

      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleClose() {
    if (!ticketId) {
      setError("Missing ticket ID.");
      return;
    }

    clearFeedback();
    setActionState("closing");

    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/close`, {
        reason: closeReason.trim() || "Resolved",
      });

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
    if (!ticketId) {
      setError("Missing ticket ID.");
      return;
    }

    clearFeedback();
    setActionState("reopening");

    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/reopen`);
      setMessage("Ticket reopened.");
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleDelete() {
    if (!ticketId) {
      setError("Missing ticket ID.");
      return;
    }

    clearFeedback();
    setActionState("deleting");

    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/delete`, {
        reason: deleteReason.trim() || "Deleted from dashboard",
      });

      setMessage(
        derived.ghost
          ? forceTranscript
            ? "Ghost ticket deleted with transcript metadata recorded."
            : "Ghost ticket deleted."
          : "Ticket deleted."
      );

      setOpenPanels((prev) => ({
        ...prev,
        delete: false,
        transcript: true,
      }));
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket.");
    } finally {
      setActionState("idle");
    }
  }

  async function handleTransfer() {
    if (!ticketId) {
      setError("Missing ticket ID.");
      return;
    }

    if (!transferTarget.trim()) {
      setError("Enter the target staff ID.");
      return;
    }

    clearFeedback();
    setActionState("transferring");

    try {
      await postJson(`/api/tickets/${encodeURIComponent(ticketId)}/transfer`, {
        assigned_to: transferTarget.trim(),
        reason: transferReason.trim() || "Transferred by staff",
      });

      setMessage("Ticket transferred.");
      setTransferTarget("");
      setOpenPanels((prev) => ({
        ...prev,
        transfer: false,
      }));
      await afterChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer ticket.");
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

  async function handleClearCategoryOverride() {
    if (!ticket?.id) {
      setError("Missing ticket ID.");
      return;
    }

    clearFeedback();
    setActionState("clearing-category");

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
        body: JSON.stringify({
          action: "clear-category-override",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to clear category override.");
      }

      setMessage("Manual category override cleared.");
      await afterChange(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear category override."
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleLinkVerificationContext() {
    if (!ticket?.id) {
      setError("Missing ticket ID.");
      return;
    }

    clearFeedback();
    setActionState("linking-verification-context");

    try {
      const categoryToUse = selectedCategory || null;

      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
        body: JSON.stringify({
          action: "link-verification-context",
          category_id: categoryToUse?.id || ticket.category_id || ticket.matched_category_id || null,
          category:
            categoryToUse?.slug ||
            categoryToUse?.name ||
            ticket.category ||
            ticket.matched_category_slug ||
            null,
          verification_source: "dashboard_manual_category_override",
          entry_method: "verification_ticket",
          entry_reason: "Verification context linked from dashboard ticket controls.",
          approval_reason: "Dashboard staff linked verification context after category review.",
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to link verification context.");
      }

      setMessage("Verification context linked to this ticket/member.");
      await afterChange(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to link verification context."
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
              Claim, transfer, sync, close, reopen, delete, transcript export,
              and category correction in one fast workflow.
            </div>
          </div>

          <div className="ticket-controls-status-row">
            <span className={`badge ${getStatusTone(ticket.status)}`}>
              {safeText(ticket.status, "unknown")}
            </span>
            <span
              className={`badge ${
                derived.unclaimed ? "open" : derived.claimed ? "claimed" : ""
              }`}
            >
              {derived.queueStateLabel}
            </span>
            <span className={`badge ${getStatusTone(derived.verificationLabel)}`}>
              {safeText(derived.verificationLabel)}
            </span>
            <span className={`badge ${getStatusTone(derived.riskLevel)}`}>
              {safeText(derived.riskLevel)}
            </span>
            <span className={`badge ${getStatusTone(derived.priority)}`}>
              {safeText(derived.priority)}
            </span>
            {derived.overdue ? <span className="badge danger">Overdue</span> : null}
            {derived.mine ? <span className="badge claimed">Mine</span> : null}
            {derived.ghost ? <span className="badge">Ghost</span> : null}
            {derived.hasTranscript ? (
              <span className="badge claimed">Transcript</span>
            ) : (
              <span className="badge">No Transcript</span>
            )}
            {derived.missingChannel ? (
              <span className="badge danger">Missing Channel</span>
            ) : null}
            {derived.manualCategory ? (
              <span className="badge medium">Manual Category</span>
            ) : (
              <span className="badge">Auto Category</span>
            )}
          </div>
        </div>

        <div className="ticket-primary-actions">
          <button
            type="button"
            className="button primary"
            disabled={claimDisabled}
            onClick={handleClaim}
          >
            {actionState === "claiming"
              ? "Claiming..."
              : derived.mine
                ? "Assigned To You"
                : derived.claimed
                  ? "Claim Locked"
                  : "Claim"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={unclaimDisabled}
            onClick={handleUnclaim}
          >
            {actionState === "unclaiming" ? "Unclaiming..." : "Unclaim"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={busy || derived.deleted || derived.closed}
            onClick={() => openPanel("transfer")}
          >
            Transfer
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={syncDisabled}
            onClick={() => openPanel("repair")}
          >
            {actionState === "syncing-ticket" ? "Syncing..." : "Repair / Sync"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={busy || !ticketId}
            onClick={() => openPanel("category")}
          >
            Category
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
        title="Workflow Snapshot"
        subtitle="The minimum context staff need before taking action."
        badge={<span className="badge open">Live</span>}
        open={openPanels.workflow}
        onToggle={() => togglePanel("workflow")}
      >
        <div className="ticket-controls-info-grid">
          <div className="member-detail-item">
            <div className="ticket-info-label">Member</div>
            <div className="ticket-controls-mini-value">{derived.ownerLabel}</div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Claimed By</div>
            <div className="ticket-controls-mini-value">{derived.claimedBy}</div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Claimed By ID</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.claimedById, "—")}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Queue State</div>
            <div className="ticket-controls-mini-value">
              {derived.queueStateLabel}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Verification</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.verificationLabel)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Entry Method</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.entryMethodLabel)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Channel ID</div>
            <div className="ticket-controls-mini-value">
              {safeText(channelId, "Missing")}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Transcript State</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.transcriptState)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Priority</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.priority)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Risk Level</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.riskLevel)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Warn Count</div>
            <div className="ticket-controls-mini-value">
              {String(derived.warnCount)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Flag Count</div>
            <div className="ticket-controls-mini-value">
              {String(derived.flagCount)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Past Tickets</div>
            <div className="ticket-controls-mini-value">
              {String(derived.priorTickets)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Role State</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.roleState)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Invited By</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.invitedBy)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Vouched By</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.vouchedBy)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Approved By</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.approvedBy)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Source</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.source)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Ghost Ticket</div>
            <div className="ticket-controls-mini-value">
              {derived.ghost ? "Yes" : "No"}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Latest Activity</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.latestActivityTitle)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Latest Activity At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(derived.latestActivityAt)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Latest Note</div>
            <div className="ticket-controls-mini-value">
              {derived.latestNoteStaff === "—" && !derived.latestNoteAt
                ? "—"
                : `${safeText(derived.latestNoteStaff)} • ${formatDateTime(
                    derived.latestNoteAt
                  )}`}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Note Count</div>
            <div className="ticket-controls-mini-value">
              {String(derived.noteCount)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Closed At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(ticket.closed_at)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Deleted At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(ticket.deleted_at)}
            </div>
          </div>

          <div className="member-detail-item full-width">
            <div className="ticket-info-label">Recommended Actions</div>
            <div className="ticket-controls-action-pills">
              {derived.recommendedActions.length ? (
                derived.recommendedActions.map((action) => (
                  <span key={action} className="ticket-mini-pill">
                    {action}
                  </span>
                ))
              ) : (
                <span className="ticket-controls-mini-value">No suggestions.</span>
              )}
            </div>
          </div>
        </div>

        <div className="ticket-controls-actions">
          {channelId ? (
            <button
              type="button"
              className="button ghost"
              onClick={() => void handleCopy(channelId, "Channel ID copied.")}
            >
              Copy Channel ID
            </button>
          ) : null}

          {derived.claimedById ? (
            <button
              type="button"
              className="button ghost"
              onClick={() =>
                void handleCopy(derived.claimedById, "Claimed-by ID copied.")
              }
            >
              Copy Claimed-By ID
            </button>
          ) : null}

          {ticketId ? (
            <a
              href={`/api/tickets/${ticketId}`}
              target="_blank"
              rel="noreferrer"
              className="button ghost"
            >
              Open Raw API
            </a>
          ) : null}
        </div>
      </ActionAccordion>

      <ActionAccordion
        title="Repair / Sync Ticket"
        subtitle="Re-sync this single ticket row against live Discord state."
        badge={
          derived.missingChannel ? (
            <span className="badge danger">Needs Repair</span>
          ) : (
            <span className="badge claimed">Ready</span>
          )
        }
        open={openPanels.repair}
        onToggle={() => togglePanel("repair")}
      >
        <div className="ticket-controls-info-grid" style={{ marginBottom: 12 }}>
          <div className="member-detail-item">
            <div className="ticket-info-label">Channel ID</div>
            <div className="ticket-controls-mini-value">
              {safeText(channelId, "Missing")}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Queue State</div>
            <div className="ticket-controls-mini-value">
              {derived.queueStateLabel}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Current Status</div>
            <div className="ticket-controls-mini-value">
              {safeText(ticket.status, "unknown")}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Missing Channel</div>
            <div className="ticket-controls-mini-value">
              {derived.missingChannel ? "Yes" : "No"}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Transcript State</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.transcriptState)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Closed / Deleted</div>
            <div className="ticket-controls-mini-value">
              {derived.deleted ? "Deleted" : derived.closed ? "Closed" : "Active"}
            </div>
          </div>
        </div>

        <div className="ticket-controls-actions">
          <button
            type="button"
            className="button ghost"
            disabled={syncDisabled}
            onClick={() => void handleSyncOne(true)}
          >
            {actionState === "syncing-ticket" ? "Working..." : "Preview Sync"}
          </button>

          <button
            type="button"
            className="button primary"
            disabled={syncDisabled}
            onClick={() => void handleSyncOne(false)}
          >
            {actionState === "syncing-ticket" ? "Syncing..." : "Sync This Ticket"}
          </button>
        </div>

        {!channelId ? (
          <div className="warning-banner">
            This row is missing a live Discord channel ID, so single-ticket sync
            cannot run until the row is repaired or reconciled.
          </div>
        ) : null}
      </ActionAccordion>

      <ActionAccordion
        title="Category Override"
        subtitle="Correct a bad match, clear a manual override, or link verification context."
        badge={
          derived.manualCategory ? (
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
              {derived.currentCategoryName}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Current Slug</div>
            <div className="ticket-controls-mini-value">
              {derived.currentCategorySlug}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Matched Intake Type</div>
            <div className="ticket-controls-mini-value">
              {derived.currentIntakeType}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Matched Score</div>
            <div className="ticket-controls-mini-value">
              {String(derived.currentCategoryScore || 0)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Current Reason</div>
            <div className="ticket-controls-mini-value">
              {derived.currentCategoryReason}
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
              <div className="ticket-info-label">Default Category</div>
              <div className="ticket-controls-mini-value">
                {selectedCategory.is_default ? "Yes" : "No"}
              </div>
            </div>

            <div className="member-detail-item">
              <div className="ticket-info-label">Selected Description</div>
              <div className="ticket-controls-mini-value">
                {safeText(selectedCategory.description)}
              </div>
            </div>

            <div className="member-detail-item">
              <div className="ticket-info-label">Keywords</div>
              <div className="ticket-controls-mini-value">
                {Array.isArray(selectedCategory.match_keywords) &&
                selectedCategory.match_keywords.length
                  ? selectedCategory.match_keywords.join(" • ")
                  : "—"}
              </div>
            </div>
          </div>
        ) : null}

        <div className="ticket-controls-actions">
          <button
            type="button"
            className="button ghost"
            disabled={clearCategoryDisabled}
            onClick={handleClearCategoryOverride}
          >
            {actionState === "clearing-category"
              ? "Clearing..."
              : "Clear Override"}
          </button>

          <button
            type="button"
            className="button ghost"
            disabled={linkVerificationContextDisabled}
            onClick={handleLinkVerificationContext}
          >
            {actionState === "linking-verification-context"
              ? "Linking..."
              : "Link Verification Context"}
          </button>
        </div>

        {derived.shouldOfferVerificationLink ? (
          <div className="info-banner">
            This category looks verification-related. If staff manually routed it
            to verification, you can also link verification context so member/join
            records stay consistent.
          </div>
        ) : null}
      </ActionAccordion>

      <ActionAccordion
        title="Transfer Ticket"
        subtitle="Move ownership fast by staff ID."
        badge={<span className="badge open">Route Ready</span>}
        open={openPanels.transfer}
        onToggle={() => togglePanel("transfer")}
      >
        <div className="ticket-controls-info-grid" style={{ marginBottom: 12 }}>
          <div className="member-detail-item">
            <div className="ticket-info-label">Current Owner</div>
            <div className="ticket-controls-mini-value">{derived.claimedBy}</div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Current Owner ID</div>
            <div className="ticket-controls-mini-value">
              {safeText(derived.claimedById, "Unclaimed")}
            </div>
          </div>
        </div>

        <input
          className="input"
          value={transferTarget}
          onChange={(e) => setTransferTarget(e.target.value)}
          placeholder="Target staff ID"
        />

        <input
          className="input"
          value={transferReason}
          onChange={(e) => setTransferReason(e.target.value)}
          placeholder="Reason for transfer"
        />

        <div className="ticket-controls-actions">
          <button
            type="button"
            className="button primary"
            disabled={transferDisabled}
            onClick={handleTransfer}
          >
            {actionState === "transferring" ? "Transferring..." : "Transfer"}
          </button>
        </div>
      </ActionAccordion>

      <ActionAccordion
        title="Transcript & Lifecycle"
        subtitle="Transcript links, exports, and lifecycle state."
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
                  Open Stored Transcript
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
              {safeText(ticket.deleted_by_name || ticket.deleted_by)}
            </div>
          </div>

          <div className="member-detail-item">
            <div className="ticket-info-label">Deleted At</div>
            <div className="ticket-controls-mini-value">
              {formatDateTime(ticket.deleted_at)}
            </div>
          </div>
        </div>

        <div className="ticket-controls-actions">
          {derived.transcriptUrl ? (
            <a
              href={derived.transcriptUrl}
              target="_blank"
              rel="noreferrer"
              className="button primary"
            >
              Open Stored Transcript
            </a>
          ) : null}

          {ticketId ? (
            <>
              <a
                href={buildTranscriptExportUrl(ticketId, "html")}
                target="_blank"
                rel="noreferrer"
                className="button ghost"
              >
                Export HTML
              </a>

              <a
                href={buildTranscriptExportUrl(ticketId, "txt")}
                target="_blank"
                rel="noreferrer"
                className="button ghost"
              >
                Export TXT
              </a>

              <a
                href={buildTranscriptExportUrl(ticketId, "json")}
                target="_blank"
                rel="noreferrer"
                className="button ghost"
              >
                Export JSON
              </a>
            </>
          ) : null}

          {derived.transcriptUrl ? (
            <button
              type="button"
              className="button ghost"
              onClick={() =>
                void handleCopy(derived.transcriptUrl, "Transcript link copied.")
              }
            >
              Copy Transcript Link
            </button>
          ) : null}

          {derived.transcriptMessageId ? (
            <button
              type="button"
              className="button ghost"
              onClick={() =>
                void handleCopy(
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
                void handleCopy(
                  derived.transcriptChannelId,
                  "Transcript channel ID copied."
                )
              }
            >
              Copy Channel ID
            </button>
          ) : null}
        </div>

        {!derived.hasTranscript ? (
          <div className="empty-state" style={{ padding: 12 }}>
            Transcript data will appear here after the ticket is closed or
            deleted through the bot workflow.
          </div>
        ) : null}
      </ActionAccordion>

      <ActionAccordion
        title="Close Ticket"
        subtitle="Resolve the ticket while preserving the record."
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
            <span>Record transcript intent before deleting this ghost ticket</span>
          </label>
        ) : (
          <div className="info-banner">
            Transcript posting is handled by the normal close/delete workflow.
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
          grid-template-columns: repeat(8, minmax(0, 1fr));
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

        .ticket-controls-action-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ticket-mini-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid rgba(99, 213, 255, 0.14);
          background:
            radial-gradient(circle at top right, rgba(99, 213, 255, 0.1), transparent 42%),
            rgba(99, 213, 255, 0.05);
          font-size: 12px;
          line-height: 1.2;
          color: var(--text, #dbe4ee);
        }

        .full-width {
          grid-column: 1 / -1;
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

          .full-width {
            grid-column: auto;
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
