"use client";

import { useState } from "react";
import {
  syncMembersAction,
  reconcileDepartedMembersAction,
} from "@/lib/dashboardActions";

export default function QuickActions({ onRefresh, currentStaffId = null }) {
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function runAction(name, runner) {
    setError("");
    setMessage("");
    setRunning(name);

    try {
      const result = await runner();

      /**
       * CRITICAL FIX
       *
       * Previously the dashboard treated ANY non-ok result as failure.
       * However commands can legitimately timeout while still processing.
       *
       * We now only treat it as failure if:
       * - ok === false
       * - AND timedOut !== true
       */

      if (!result?.ok && !result?.timedOut) {
        throw new Error(result?.command?.error || `${name} failed.`);
      }

      /**
       * If the command timed out but is still processing,
       * show a more accurate message.
       */

      if (result?.timedOut) {
        setMessage(`${name} queued and still processing...`);
      } else {
        setMessage(`${name} completed.`);
      }

      /**
       * Refresh dashboard metrics
       */

      if (onRefresh) {
        await onRefresh();
      }

    } catch (err) {
      setError(err?.message || `${name} failed.`);
    } finally {
      setRunning("");
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Quick Actions</h2>

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

      <div className="quick-actions">
        <button
          className="button"
          disabled={running === "Full Member Sync"}
          onClick={() =>
            runAction("Full Member Sync", () =>
              syncMembersAction({
                staffId: currentStaffId,
                requestedBy: currentStaffId,
              })
            )
          }
        >
          {running === "Full Member Sync"
            ? "Running Full Member Sync..."
            : "Full Member Sync"}
        </button>

        <button
          className="button"
          disabled={running === "Reconcile Departed Members"}
          onClick={() =>
            runAction("Reconcile Departed Members", () =>
              reconcileDepartedMembersAction({
                staffId: currentStaffId,
                requestedBy: currentStaffId,
              })
            )
          }
        >
          {running === "Reconcile Departed Members"
            ? "Running Reconcile Departed Members..."
            : "Reconcile Departed Members"}
        </button>
      </div>
    </div>
  );
}
