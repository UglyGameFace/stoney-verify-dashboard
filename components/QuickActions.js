"use client";

import { useMemo, useState } from "react";
import {
  syncMembersAction,
  reconcileDepartedMembersAction,
} from "@/lib/dashboardActions";

function getActionSummary(name) {
  if (name === "Full Member Sync") {
    return "Rebuild live member records, roles, and dashboard tracking.";
  }

  if (name === "Reconcile Departed Members") {
    return "Mark members who are no longer in the guild as departed.";
  }

  return "Run dashboard maintenance action.";
}

export default function QuickActions({
  onRefresh,
  currentStaffId = null,
}) {
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedAction, setExpandedAction] = useState("");

  const hasStaffId = Boolean(String(currentStaffId || "").trim());

  const actions = useMemo(
    () => [
      {
        key: "sync-members",
        name: "Full Member Sync",
        compactLabel: "Sync Members",
        description:
          "Rebuild live member rows, roles, verification state, and dashboard counts.",
        detail:
          "Best when member counts, role stats, or verification states look outdated.",
        runner: () =>
          syncMembersAction({
            staffId: currentStaffId,
            requestedBy: currentStaffId,
          }),
      },
      {
        key: "reconcile-departed",
        name: "Reconcile Departed Members",
        compactLabel: "Reconcile Departed",
        description:
          "Find members who already left and mark them correctly in dashboard history.",
        detail:
          "Best when former members are still showing as active in the dashboard.",
        runner: () =>
          reconcileDepartedMembersAction({
            staffId: currentStaffId,
            requestedBy: currentStaffId,
          }),
      },
    ],
    [currentStaffId]
  );

  function toggleExpanded(key) {
    setExpandedAction((prev) => (prev === key ? "" : key));
  }

  async function runAction(name, runner) {
    setError("");
    setMessage("");

    if (!hasStaffId) {
      setError(
        "Dashboard session is missing your staff ID. Refresh the page and make sure you are fully logged in with staff access."
      );
      return;
    }

    setRunning(name);

    try {
      const result = await runner();

      if (!result?.ok && !result?.timedOut) {
        throw new Error(result?.command?.error || result?.error || `${name} failed.`);
      }

      if (result?.timedOut) {
        setMessage(`${name} queued and is still processing...`);
      } else {
        setMessage(`${name} completed successfully.`);
      }

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
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Quick Actions</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Compact mobile controls with expandable action details.
          </div>
        </div>

        <button
          className="button ghost"
          type="button"
          style={{ width: "auto", minWidth: 110 }}
          onClick={() => onRefresh && onRefresh()}
          disabled={!!running}
        >
          Refresh
        </button>
      </div>

      {!hasStaffId ? (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          Staff identity is missing in the dashboard session. Action buttons are locked until the session refreshes correctly.
        </div>
      ) : null}

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

      <div
        className="space"
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {actions.map((action) => {
          const isRunning = running === action.name;
          const isExpanded = expandedAction === action.key;

          return (
            <div
              key={action.key}
              className="card"
              style={{
                padding: 14,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.08)",
                background: isExpanded
                  ? "rgba(59,130,246,0.06)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(action.key)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        color: "var(--text-strong)",
                        overflowWrap: "anywhere",
                        lineHeight: 1.15,
                      }}
                    >
                      {action.compactLabel}
                    </div>

                    <div
                      className="muted"
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {getActionSummary(action.name)}
                    </div>
                  </div>
                </button>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    className="badge"
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleExpanded(action.key)}
                  >
                    {isExpanded ? "Hide" : "Info"}
                  </button>

                  <button
                    className="button"
                    type="button"
                    style={{ width: "auto", minWidth: 116 }}
                    disabled={!!running || !hasStaffId}
                    onClick={() => runAction(action.name, action.runner)}
                  >
                    {isRunning ? "Running..." : "Run"}
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="muted"
                    style={{
                      lineHeight: 1.5,
                      marginBottom: 12,
                    }}
                  >
                    {action.description}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div className="member-detail-item">
                      <span className="ticket-info-label">Action</span>
                      <span>{action.name}</span>
                    </div>

                    <div className="member-detail-item">
                      <span className="ticket-info-label">Requested By</span>
                      <span>{currentStaffId || "Missing staff session"}</span>
                    </div>

                    <div className="member-detail-item">
                      <span className="ticket-info-label">Best Use</span>
                      <span>{action.detail}</span>
                    </div>

                    <div className="member-detail-item">
                      <span className="ticket-info-label">State</span>
                      <span>
                        {!hasStaffId
                          ? "Blocked"
                          : isRunning
                          ? "Running"
                          : running
                          ? "Waiting"
                          : "Ready"}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 12,
                    }}
                  >
                    <button
                      className="button"
                      type="button"
                      style={{ width: "auto", minWidth: 140 }}
                      disabled={!!running || !hasStaffId}
                      onClick={() => runAction(action.name, action.runner)}
                    >
                      {isRunning
                        ? `Running ${action.compactLabel}...`
                        : `Run ${action.compactLabel}`}
                    </button>

                    <button
                      className="button ghost"
                      type="button"
                      style={{ width: "auto", minWidth: 110 }}
                      onClick={() => toggleExpanded(action.key)}
                    >
                      Collapse
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
