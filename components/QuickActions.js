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

      if (!result?.ok) {
        throw new Error(result?.command?.error || `${name} failed.`);
      }

      setMessage(`${name} completed.`);

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
