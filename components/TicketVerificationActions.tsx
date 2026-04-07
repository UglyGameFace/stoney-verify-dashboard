"use client";

import { useMemo, useState } from "react";

type Dict = Record<string, unknown>;

type VerifyAction =
  | ""
  | "approve"
  | "remove_unverified"
  | "repost_verify_ui"
  | "deny";

type Tone = "neutral" | "good" | "warn" | "danger" | "info";

type VerificationResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  noteWarning?: string | null;
  commandId?: string | null;
  action?: string | null;
};

type TicketVerificationActionsProps = {
  ticket: Dict;
  currentStaffId?: string | null;
  onChanged?: (() => Promise<void> | void) | null;
};

type ActionCardProps = {
  title: string;
  description: string;
  tone?: Tone;
  buttonLabel: string;
  busyLabel: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
};

type QuickReason = {
  label: string;
  value: string;
};

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function looksVerificationTicket(ticket: Dict): boolean {
  const category = String(ticket?.category || "").toLowerCase();
  const matchedCategory = String(ticket?.matched_category_name || "").toLowerCase();
  const matchedSlug = String(ticket?.matched_category_slug || "").toLowerCase();
  const matchedIntakeType = String(ticket?.matched_intake_type || "").toLowerCase();
  const title = String(ticket?.title || "").toLowerCase();
  const initial = String(ticket?.initial_message || "").toLowerCase();
  const verificationLabel = String(ticket?.owner_verification_label || "").toLowerCase();
  const verificationSource = String(ticket?.owner_verification_source || "").toLowerCase();
  const entryMethod = String(ticket?.owner_entry_method || "").toLowerCase();

  return (
    category.includes("verification") ||
    matchedCategory.includes("verification") ||
    matchedSlug.includes("verification") ||
    matchedIntakeType.includes("verification") ||
    title.includes("verification") ||
    initial.includes("verification") ||
    verificationLabel.includes("pending") ||
    verificationLabel.includes("review") ||
    verificationLabel.includes("verified") ||
    verificationSource.includes("verification") ||
    entryMethod.includes("verification")
  );
}

function getToneFromText(value: string): Tone {
  const v = value.toLowerCase();

  if (
    v.includes("verified") ||
    v.includes("approved") ||
    v.includes("staff") ||
    v.includes("synced")
  ) {
    return "good";
  }

  if (
    v.includes("review") ||
    v.includes("flag") ||
    v.includes("denied") ||
    v.includes("high")
  ) {
    return "danger";
  }

  if (
    v.includes("pending") ||
    v.includes("submitted") ||
    v.includes("resubmit") ||
    v.includes("vc")
  ) {
    return "warn";
  }

  if (
    v.includes("open") ||
    v.includes("claimed") ||
    v.includes("ready")
  ) {
    return "info";
  }

  return "neutral";
}

function SummaryPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return <span className={`verify-summary-pill ${tone}`}>{label}</span>;
}

function DetailCard({
  label,
  value,
  full = false,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`verify-detail-card ${full ? "full" : ""}`}>
      <div className="verify-detail-label">{label}</div>
      <div className="verify-detail-value">{value}</div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  tone = "neutral",
  buttonLabel,
  busyLabel,
  disabled = false,
  busy = false,
  onClick,
}: ActionCardProps) {
  return (
    <div className={`verify-action-card ${tone}`}>
      <div className="verify-action-card-copy">
        <div className="verify-action-card-title">{title}</div>
        <div className="verify-action-card-description">{description}</div>
      </div>

      <button
        type="button"
        className={`button ${
          tone === "danger" ? "danger" : tone === "good" ? "primary" : "ghost"
        }`}
        disabled={disabled || busy}
        onClick={onClick}
      >
        {busy ? busyLabel : buttonLabel}
      </button>
    </div>
  );
}

export default function TicketVerificationActions({
  ticket,
  currentStaffId,
  onChanged,
}: TicketVerificationActionsProps) {
  const [busy, setBusy] = useState<VerifyAction>("");
  const [linkingContext, setLinkingContext] = useState<boolean>(false);

  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [warning, setWarning] = useState<string>("");

  const [decisionReason, setDecisionReason] = useState<string>(
    "Approved by staff review"
  );

  const visible = useMemo(() => looksVerificationTicket(ticket), [ticket]);

  const userId = String(ticket?.user_id || "").trim();
  const ticketId = String(ticket?.id || "").trim();

  const verificationLabel = safeText(ticket?.owner_verification_label, "Unknown");
  const latestTokenStatus = safeText(ticket?.owner_latest_token_status, "Unknown");
  const latestTokenDecision = safeText(ticket?.owner_latest_token_decision, "Unknown");
  const latestVcStatus = safeText(ticket?.owner_latest_vc_status, "Unknown");
  const ticketStatus = safeText(ticket?.status, "unknown");
  const categoryName = safeText(
    ticket?.matched_category_name || ticket?.category,
    "Uncategorized"
  );
  const intakeType = safeText(ticket?.matched_intake_type, "Unknown");
  const flagCount = normalizeNumber(ticket?.owner_flag_count, 0);
  const warnCount = normalizeNumber(ticket?.owner_warn_count, 0);
  const tokenCount = normalizeNumber(ticket?.owner_token_count, 0);
  const vcCount = normalizeNumber(ticket?.owner_vc_count, 0);
  const latestFlagAt = safeText(ticket?.owner_latest_flag_at, "");
  const latestTokenAt = safeText(ticket?.owner_latest_token_at, "");
  const latestVcAt = safeText(ticket?.owner_latest_vc_at, "");
  const hasUnverified = normalizeBoolean(ticket?.owner_has_unverified);
  const hasVerifiedRole = normalizeBoolean(ticket?.owner_has_verified_role);
  const hasStaffRole = normalizeBoolean(ticket?.owner_has_staff_role);

  const actionsDisabled = !userId || !ticketId || !currentStaffId;
  const anyBusy = Boolean(busy) || linkingContext;

  const quickReasons: QuickReason[] = [
    {
      label: "Approve",
      value: "Approved by staff review",
    },
    {
      label: "Needs resubmit",
      value: "Verification denied pending a cleaner resubmission",
    },
    {
      label: "Role cleanup",
      value: "Manual role cleanup completed by staff review",
    },
    {
      label: "UI repost",
      value: "Verification UI reposted for a fresh submission attempt",
    },
    {
      label: "Denied",
      value: "Denied by staff review after verification check",
    },
  ];

  async function post(action: Exclude<VerifyAction, "">) {
    if (!ticketId) return;

    setBusy(action);
    setError("");
    setMessage("");
    setWarning("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          action,
          staff_id: currentStaffId || null,
          reason: decisionReason || "",
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | VerificationResponse
        | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Verification action failed.");
      }

      setMessage(json?.message || "Verification action queued.");
      if (json?.noteWarning) {
        setWarning(json.noteWarning);
      }

      await onChanged?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Verification action failed."));
    } finally {
      setBusy("");
    }
  }

  async function handleLinkVerificationContext() {
    if (!ticketId) return;

    setLinkingContext(true);
    setError("");
    setMessage("");
    setWarning("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          action: "link-verification-context",
          entry_method: "verification_ticket",
          verification_source: "dashboard_staff_workspace",
          entry_reason:
            decisionReason || "Verification context linked from staff workspace.",
          approval_reason:
            decisionReason ||
            "Verification context linked from staff workspace.",
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | VerificationResponse
        | null;

      if (!res.ok || json?.error) {
        throw new Error(json?.error || "Failed to link verification context.");
      }

      setMessage(json?.message || "Verification context linked.");
      await onChanged?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to link verification context."));
    } finally {
      setLinkingContext(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="card verification-workspace-card">
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
          <div
            className="muted"
            style={{
              marginBottom: 8,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Verification Workspace
          </div>

          <h2 style={{ margin: 0 }}>Verification Actions</h2>
          <div className="muted" style={{ marginTop: 6, overflowWrap: "anywhere" }}>
            Queue approval, denial, unverified cleanup, verify UI repost, or
            backfill verification context from the dashboard.
          </div>
        </div>

        <div className="verify-summary-pill-row">
          <SummaryPill
            label={`Ticket: ${ticketStatus}`}
            tone={getToneFromText(ticketStatus)}
          />
          <SummaryPill
            label={`Verification: ${verificationLabel}`}
            tone={getToneFromText(verificationLabel)}
          />
          <SummaryPill
            label={`Token: ${latestTokenStatus}`}
            tone={getToneFromText(latestTokenStatus)}
          />
          <SummaryPill
            label={`VC: ${latestVcStatus}`}
            tone={getToneFromText(latestVcStatus)}
          />
          {ticket?.category_override ? (
            <SummaryPill label="Manual Category" tone="warn" />
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="info-banner" style={{ marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      {warning ? (
        <div className="warning-banner" style={{ marginBottom: 12 }}>
          {warning}
        </div>
      ) : null}

      {actionsDisabled ? (
        <div className="warning-banner" style={{ marginBottom: 12 }}>
          Verification actions are partially blocked because a required value is
          missing.
          {!userId ? " Missing user ID." : ""}
          {!ticketId ? " Missing ticket ID." : ""}
          {!currentStaffId ? " Missing current staff ID." : ""}
        </div>
      ) : null}

      <div className="verify-detail-grid" style={{ marginBottom: 14 }}>
        <DetailCard label="Category" value={categoryName} />
        <DetailCard label="Intake Type" value={intakeType} />
        <DetailCard label="Flag Count" value={String(flagCount)} />
        <DetailCard label="Warn Count" value={String(warnCount)} />
        <DetailCard label="Token Count" value={String(tokenCount)} />
        <DetailCard label="VC Session Count" value={String(vcCount)} />
        <DetailCard label="Latest Token Decision" value={latestTokenDecision} />
        <DetailCard label="Latest VC Status" value={latestVcStatus} />
        <DetailCard
          label="Latest Flag At"
          value={latestFlagAt ? formatDateTime(latestFlagAt) : "—"}
        />
        <DetailCard
          label="Latest Token At"
          value={latestTokenAt ? formatDateTime(latestTokenAt) : "—"}
        />
        <DetailCard
          label="Latest VC At"
          value={latestVcAt ? formatDateTime(latestVcAt) : "—"}
        />
        <DetailCard
          label="Role Markers"
          value={
            [
              hasUnverified ? "Has unverified" : "",
              hasVerifiedRole ? "Has verified role" : "",
              hasStaffRole ? "Has staff role" : "",
            ]
              .filter(Boolean)
              .join(" • ") || "No role markers"
          }
          full
        />
      </div>

      <div className="verify-reason-box">
        <div className="verify-reason-head">
          <div className="verify-reason-title">Decision Reason</div>
          <div className="muted" style={{ fontSize: 12 }}>
            This gets written into the queued verification note and command
            payload for staff traceability.
          </div>
        </div>

        <input
          className="input"
          value={decisionReason}
          onChange={(e) => setDecisionReason(e.target.value)}
          placeholder="Reason shown in verification note / queue"
        />

        <div className="verify-quick-reason-row">
          {quickReasons.map((reason) => (
            <button
              key={reason.label}
              type="button"
              className="verify-reason-chip"
              disabled={anyBusy}
              onClick={() => setDecisionReason(reason.value)}
            >
              {reason.label}
            </button>
          ))}
        </div>
      </div>

      <div className="verify-action-grid">
        <ActionCard
          title="Approve + Verify"
          description="Queues verification approval for the member through the backend command route."
          tone="good"
          buttonLabel="Approve + Verify"
          busyLabel="Approving..."
          disabled={actionsDisabled}
          busy={busy === "approve"}
          onClick={() => void post("approve")}
        />

        <ActionCard
          title="Remove Unverified"
          description="Queues unverified-role cleanup when the member is already effectively through the verification flow."
          tone="info"
          buttonLabel="Remove Unverified"
          busyLabel="Working..."
          disabled={actionsDisabled}
          busy={busy === "remove_unverified"}
          onClick={() => void post("remove_unverified")}
        />

        <ActionCard
          title="Repost Verify UI"
          description="Queues a fresh verification UI repost for broken, stale, or restarted verification attempts."
          tone="neutral"
          buttonLabel="Repost Verify UI"
          busyLabel="Working..."
          disabled={!ticketId || !currentStaffId}
          busy={busy === "repost_verify_ui"}
          onClick={() => void post("repost_verify_ui")}
        />

        <ActionCard
          title="Deny Verification"
          description="Queues denial and lets the backend close the ticket with the supplied reason."
          tone="danger"
          buttonLabel="Deny Verification"
          busyLabel="Denying..."
          disabled={actionsDisabled}
          busy={busy === "deny"}
          onClick={() => void post("deny")}
        />
      </div>

      <div className="verify-secondary-actions">
        <button
          type="button"
          className="button ghost"
          disabled={actionsDisabled || linkingContext || anyBusy}
          onClick={() => void handleLinkVerificationContext()}
          style={{ width: "auto", minWidth: 220 }}
        >
          {linkingContext ? "Linking Context..." : "Link Verification Context"}
        </button>

        <div className="muted verify-secondary-copy">
          This updates member-entry context so the dashboard remembers how the
          verification path was connected later.
        </div>
      </div>

      <style jsx>{`
        .verification-workspace-card {
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .verify-summary-pill-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .verify-summary-pill {
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

        .verify-summary-pill.good {
          border-color: rgba(93,255,141,0.24);
          background: rgba(93,255,141,0.08);
        }

        .verify-summary-pill.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .verify-summary-pill.danger {
          border-color: rgba(248,113,113,0.22);
          background: rgba(248,113,113,0.08);
        }

        .verify-summary-pill.info {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .verify-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .verify-detail-card {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
          min-width: 0;
        }

        .verify-detail-card.full {
          grid-column: 1 / -1;
        }

        .verify-detail-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .verify-detail-value {
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          color: var(--text, #dbe4ee);
          line-height: 1.45;
        }

        .verify-reason-box {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 12px;
          background: rgba(255,255,255,0.02);
          display: grid;
          gap: 12px;
          margin-bottom: 14px;
        }

        .verify-reason-head {
          display: grid;
          gap: 4px;
        }

        .verify-reason-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
        }

        .verify-quick-reason-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .verify-reason-chip {
          appearance: none;
          border: 1px solid rgba(99,213,255,0.18);
          background: rgba(99,213,255,0.08);
          color: var(--text, #dbe4ee);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          cursor: pointer;
        }

        .verify-reason-chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verify-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .verify-action-card {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 14px;
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .verify-action-card.good {
          border-color: rgba(93,255,141,0.18);
        }

        .verify-action-card.warn {
          border-color: rgba(251,191,36,0.18);
        }

        .verify-action-card.danger {
          border-color: rgba(248,113,113,0.18);
        }

        .verify-action-card.info {
          border-color: rgba(99,213,255,0.18);
        }

        .verify-action-card-title {
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          line-height: 1.1;
        }

        .verify-action-card-description {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--muted, #9fb0c3);
        }

        .verify-secondary-actions {
          margin-top: 14px;
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .verify-secondary-copy {
          min-width: 0;
          flex: 1;
          line-height: 1.5;
        }

        @media (max-width: 1024px) {
          .verify-detail-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .verify-detail-grid,
          .verify-action-grid {
            grid-template-columns: 1fr;
          }

          .verify-secondary-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .verify-secondary-actions :global(.button) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
