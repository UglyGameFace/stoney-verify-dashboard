"use client";

import { useMemo, useState } from "react";
import {
  syncMembersAction,
  reconcileDepartedMembersAction,
  syncActiveTicketsAction,
} from "@/lib/dashboardActions";

function getActionSummary(name) {
  if (name === "Full Member Sync") {
    return "Rebuild live member records, roles, and dashboard tracking.";
  }

  if (name === "Reconcile Departed Members") {
    return "Mark members who are no longer in the guild as departed.";
  }

  if (name === "Sync Active Tickets") {
    return "Scan real Discord ticket channels and repair missing or stale dashboard ticket rows.";
  }

  return "Run dashboard maintenance action.";
}

function getSuccessMessage(name, result) {
  if (name === "Sync Active Tickets") {
    const summary = result?.summary || {};
    return (
      `Ticket sync complete. ` +
      `Scanned ${Number(summary?.channels_scanned || 0)} channels, ` +
      `matched ${Number(summary?.matched_ticket_channels || 0)}, ` +
      `inserted ${Number(summary?.inserted || 0)}, ` +
      `updated ${Number(summary?.updated || 0)}, ` +
      `errors ${Number(summary?.errors || 0)}.`
    );
  }

  if (result?.timedOut) {
    return `${name} queued and is still processing...`;
  }

  return `${name} completed successfully.`;
}

function ActionCard({
  action,
  isExpanded,
  isRunning,
  hasStaffId,
  onToggle,
  onRun,
  currentStaffId,
}) {
  return (
    <div className={`quick-action-card ${isExpanded ? "expanded" : ""}`}>
      <div className="quick-action-main">
        <button
          type="button"
          onClick={onToggle}
          className="quick-action-copy"
        >
          <div className="quick-action-chip-row">
            <span className="badge">{action.compactLabel}</span>
            <span className={`badge ${isRunning ? "claimed" : "open"}`}>
              {isRunning ? "Running" : "Ready"}
            </span>
          </div>

          <div className="quick-action-title">{action.name}</div>

          <div className="muted quick-action-summary">
            {getActionSummary(action.name)}
          </div>
        </button>

        <div className="quick-action-rail">
          <button
            type="button"
            className="button ghost quick-action-info"
            onClick={onToggle}
          >
            {isExpanded ? "Hide" : "Info"}
          </button>

          <button
            className="button quick-action-run"
            type="button"
            disabled={!!isRunning || !hasStaffId}
            onClick={onRun}
          >
            {isRunning ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="quick-action-detail">
          <div className="muted quick-action-description">
            {action.description}
          </div>

          <div className="quick-action-meta-grid">
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
                    : "Ready"}
              </span>
            </div>
          </div>

          <div className="quick-action-detail-buttons">
            <button
              className="button"
              type="button"
              disabled={!!isRunning || !hasStaffId}
              onClick={onRun}
            >
              {isRunning
                ? `Running ${action.compactLabel}...`
                : `Run ${action.compactLabel}`}
            </button>

            <button
              className="button ghost"
              type="button"
              onClick={onToggle}
            >
              Collapse
            </button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .quick-action-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.05), transparent 34%),
            rgba(255,255,255,0.025);
          border-radius: 22px;
          padding: 14px;
          transition:
            border-color 0.16s ease,
            background 0.16s ease,
            box-shadow 0.16s ease,
            transform 0.16s ease;
        }

        .quick-action-card.expanded {
          border-color: rgba(99, 213, 255, 0.18);
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.08), transparent 34%),
            rgba(99,213,255,0.04);
          box-shadow: 0 0 20px rgba(99, 213, 255, 0.08);
        }

        .quick-action-main {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: start;
        }

        .quick-action-copy {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          padding: 0;
          text-align: left;
          color: inherit;
          cursor: pointer;
          min-width: 0;
        }

        .quick-action-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .quick-action-title {
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          line-height: 1.08;
          letter-spacing: -0.02em;
          overflow-wrap: anywhere;
        }

        .quick-action-summary {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .quick-action-rail {
          display: grid;
          gap: 8px;
          min-width: 110px;
        }

        .quick-action-info,
        .quick-action-run {
          width: 100%;
          min-width: 0;
        }

        .quick-action-detail {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: grid;
          gap: 12px;
        }

        .quick-action-description {
          line-height: 1.55;
        }

        .quick-action-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .quick-action-detail-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        @media (max-width: 720px) {
          .quick-action-main {
            grid-template-columns: 1fr;
          }

          .quick-action-rail {
            grid-template-columns: 1fr 1fr;
            min-width: 0;
          }

          .quick-action-meta-grid {
            grid-template-columns: 1fr;
          }

          .quick-action-detail-buttons {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
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
      {
        key: "sync-active-tickets",
        name: "Sync Active Tickets",
        compactLabel: "Sync Tickets",
        description:
          "Ask the bot to scan real Discord ticket channels and backfill or repair missing ticket rows.",
        detail:
          "Best when Discord clearly has an active ticket but the dashboard queue does not show it.",
        runner: () =>
          syncActiveTicketsAction({
            staffId: currentStaffId,
            requestedBy: currentStaffId,
            includeClosedVisibleChannels: true,
            dryRun: false,
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

      if (result?.ok === false && !result?.timedOut) {
        throw new Error(
          result?.command?.error || result?.error || `${name} failed.`
        );
      }

      setMessage(getSuccessMessage(name, result));

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
            One-hand command actions with cleaner mobile control density.
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

      <div className="space" style={{ display: "grid", gap: 12 }}>
        {actions.map((action) => {
          const isRunning = running === action.name;
          const isExpanded = expandedAction === action.key;

          return (
            <ActionCard
              key={action.key}
              action={action}
              isExpanded={isExpanded}
              isRunning={isRunning}
              hasStaffId={hasStaffId}
              onToggle={() => toggleExpanded(action.key)}
              onRun={() => runAction(action.name, action.runner)}
              currentStaffId={currentStaffId}
            />
          );
        })}
      </div>
    </div>
  );
}
