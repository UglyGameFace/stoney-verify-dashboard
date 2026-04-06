"use client";

import { useMemo, useState } from "react";

type Dict = Record<string, unknown>;

type VerificationAction =
  | ""
  | "approve"
  | "remove_unverified"
  | "repost_verify_ui"
  | "deny";

type VerificationResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

type TicketVerificationActionsProps = {
  ticket: Dict;
  currentStaffId?: string | null;
  onChanged?: (() => Promise<void> | void) | null;
};

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
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
  const matchedIntakeType = String(ticket?.matched_intake_type || "").toLowerCase();
  const title = String(ticket?.title || "").toLowerCase();
  const initial = String(ticket?.initial_message || "").toLowerCase();

  return (
    category.includes("verification") ||
    matchedCategory.includes("verification") ||
    matchedIntakeType.includes("verification") ||
    title.includes("verification") ||
    initial.includes("verification")
  );
}

export default function TicketVerificationActions({
  ticket,
  currentStaffId,
  onChanged,
}: TicketVerificationActionsProps) {
  const [busy, setBusy] = useState<VerificationAction>("");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [decisionReason, setDecisionReason] = useState<string>(
    "Approved by staff review"
  );

  const visible = useMemo(() => looksVerificationTicket(ticket), [ticket]);
  const userId = String(ticket?.user_id || "").trim();
  const ticketId = String(ticket?.id || "").trim();

  async function post(
    action: Exclude<VerificationAction, "">,
    extra: Record<string, unknown> = {}
  ) {
    if (!ticketId) return;

    setBusy(action);
    setError("");
    setMessage("");

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
          ...extra,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | VerificationResponse
        | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Verification action failed.");
      }

      setMessage(json?.message || "Verification action queued.");
      await onChanged?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Verification action failed."));
    } finally {
      setBusy("");
    }
  }

  if (!visible) return null;

  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0 }}>Verification Actions</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Approve or deny this member directly from the ticket detail page.
          </div>
        </div>

        <div
          className="row"
          style={{
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span className="badge claimed">Verification</span>
          <span className="badge">{safeText(ticket?.status, "unknown")}</span>
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

      <div className="ticket-info-grid" style={{ marginBottom: 14 }}>
        <div className="ticket-info-item">
          <span className="ticket-info-label">Member</span>
          <span style={{ overflowWrap: "anywhere" }}>
            {safeText(ticket?.username || userId, "Unknown")}
          </span>
        </div>

        <div className="ticket-info-item">
          <span className="ticket-info-label">User ID</span>
          <span style={{ overflowWrap: "anywhere" }}>{userId || "—"}</span>
        </div>

        <div className="ticket-info-item full">
          <span className="ticket-info-label">Decision Reason</span>
          <input
            className="input"
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
            placeholder="Reason shown in logs / ticket history"
          />
        </div>
      </div>

      <div className="verify-action-grid">
        <button
          type="button"
          className="button primary"
          disabled={!userId || !!busy}
          onClick={() => void post("approve")}
        >
          {busy === "approve" ? "Approving..." : "Approve + Verify"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={!userId || !!busy}
          onClick={() => void post("remove_unverified")}
        >
          {busy === "remove_unverified" ? "Working..." : "Remove Unverified"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={!userId || !!busy}
          onClick={() => void post("repost_verify_ui")}
        >
          {busy === "repost_verify_ui" ? "Working..." : "Repost Verify UI"}
        </button>

        <button
          type="button"
          className="button danger"
          disabled={!userId || !!busy}
          onClick={() => void post("deny")}
        >
          {busy === "deny" ? "Denying..." : "Deny Verification"}
        </button>
      </div>

      <style jsx>{`
        .verify-action-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        @media (max-width: 720px) {
          .verify-action-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
