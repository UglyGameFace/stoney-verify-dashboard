// ============================================================
// File: components/dashboard/DesktopDashboardView.js
// Purpose:
//   Desktop dashboard shell rebuilt to feel more like a real
//   moderation operator workspace than a generic settings page.
//
//   Improvements:
//   - stronger desktop ticket hierarchy
//   - dedicated operator rail for queue views + shortcuts
//   - safer separation of live moderation vs maintenance
//   - cleaner command-center layout for tickets, members, categories
// ============================================================

"use client";

import { useMemo, useState } from "react";

function DesktopKpiStrip({
  counts = {},
  intelligence = {},
  jumpToTickets,
  jumpToPanel,
}) {
  const items = [
    {
      key: "queue",
      label: "Live Queue",
      value: Number((counts?.queueTotal ?? counts?.openTickets) || 0),
      helper: "Open + claimed tickets",
      tone: "green",
      onClick: () => jumpToTickets?.({ status: "queue" }),
    },
    {
      key: "unclaimed",
      label: "Unclaimed",
      value: Number(counts?.queueUnclaimed || 0),
      helper: "Needs a staff owner",
      tone: "amber",
      onClick: () => jumpToTickets?.({ status: "unclaimed" }),
    },
    {
      key: "claimed",
      label: "Claimed",
      value: Number(counts?.queueClaimed || 0),
      helper: "Already assigned",
      tone: "blue",
      onClick: () => jumpToTickets?.({ status: "claimed" }),
    },
    {
      key: "overdue",
      label: "Overdue",
      value: Number(counts?.queueOverdue || 0),
      helper: "Needs attention now",
      tone: "pink",
      onClick: () => jumpToTickets?.({ status: "queue" }),
    },
    {
      key: "verify",
      label: "Pending Verify",
      value: Number(intelligence?.pendingVerification || 0),
      helper: "Verification pressure",
      tone: "purple",
      onClick: () => jumpToTickets?.({ status: "queue" }),
    },
    {
      key: "fraud",
      label: "Fraud Signals",
      value: Number(counts?.fraudFlags || 0),
      helper: "Flagged accounts",
      tone: "pink",
      onClick: () => jumpToPanel?.("fraud"),
    },
    {
      key: "warns",
      label: "Warn Heat",
      value: Number(counts?.warnsToday || 0),
      helper: "Warnings today",
      tone: "amber",
      onClick: () => jumpToPanel?.("warns"),
    },
    {
      key: "raids",
      label: "Raid Signals",
      value: Number(counts?.raidAlerts || 0),
      helper: "Recent raid pressure",
      tone: "blue",
      onClick: () => jumpToPanel?.("raids"),
    },
  ];

  return (
    <>
      <div className="desktop-kpi-strip">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`desktop-kpi-card tone-${item.tone}`}
            onClick={item.onClick}
          >
            <span className="desktop-kpi-label">{item.label}</span>
            <span className={`desktop-kpi-value tone-${item.tone}`}>
              {item.value}
            </span>
            <span className="desktop-kpi-helper">{item.helper}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .desktop-kpi-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .desktop-kpi-card {
          position: relative;
          border-radius: 22px;
          padding: 16px;
          text-align: left;
          color: var(--text-strong, #f8fafc);
          display: grid;
          gap: 8px;
          min-height: 104px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.08), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
            linear-gradient(180deg, rgba(18, 30, 42, 0.95), rgba(8, 16, 26, 0.95));
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .desktop-kpi-card:hover {
          transform: translateY(-2px);
          border-color: rgba(93, 255, 141, 0.18);
          box-shadow: var(--glow-green);
        }

        .desktop-kpi-label {
          font-size: 12px;
          color: var(--muted, rgba(255, 255, 255, 0.72));
          line-height: 1.2;
        }

        .desktop-kpi-value {
          font-size: 32px;
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.05em;
          overflow-wrap: anywhere;
        }

        .desktop-kpi-helper {
          font-size: 12px;
          color: var(--muted, rgba(255, 255, 255, 0.72));
          line-height: 1.35;
        }

        .tone-green .desktop-kpi-value,
        .desktop-kpi-value.tone-green {
          color: var(--accent, #5dff8d);
        }

        .tone-blue .desktop-kpi-value,
        .desktop-kpi-value.tone-blue {
          color: var(--blue, #63d5ff);
        }

        .tone-amber .desktop-kpi-value,
        .desktop-kpi-value.tone-amber {
          color: var(--amber, #ffd36b);
        }

        .tone-pink .desktop-kpi-value,
        .desktop-kpi-value.tone-pink {
          color: var(--danger, #ff6f8e);
        }

        .tone-purple .desktop-kpi-value,
        .desktop-kpi-value.tone-purple {
          color: var(--purple, #b26dff);
        }

        @media (max-width: 1319px) {
          .desktop-kpi-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  );
}

function DesktopPageShell({
  title,
  subtitle,
  tone = "default",
  children,
}) {
  return (
    <div className={`desktop-page-shell card tone-${tone}`}>
      <div className="desktop-page-head">
        <div className="desktop-page-copy">
          <div className="desktop-page-chip-row">
            <span className="desktop-page-chip">Control Room</span>
            <span className={`desktop-page-chip tone-${tone}`}>
              {tone === "tickets"
                ? "Live Queue"
                : tone === "members"
                  ? "People + Roles"
                  : tone === "categories"
                    ? "Routing"
                    : "Dashboard"}
            </span>
          </div>

          <h2 className="desktop-page-title">{title}</h2>
          {subtitle ? (
            <div className="muted desktop-page-subtitle">{subtitle}</div>
          ) : null}
        </div>
      </div>

      <div className="glass-divider" style={{ marginBottom: 14 }} />
      <div className="desktop-page-body">{children}</div>

      <style jsx>{`
        .desktop-page-shell {
          padding: 20px;
          border-radius: 28px;
          overflow: hidden;
        }

        .desktop-page-shell.tone-tickets {
          box-shadow: var(--shadow-strong), var(--glow-green);
        }

        .desktop-page-shell.tone-members {
          box-shadow: var(--shadow-strong), var(--glow-blue);
        }

        .desktop-page-shell.tone-categories {
          box-shadow: var(--shadow-strong), var(--glow-purple);
        }

        .desktop-page-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .desktop-page-copy {
          min-width: 0;
          flex: 1;
        }

        .desktop-page-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .desktop-page-chip {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }

        .desktop-page-chip.tone-tickets {
          background: rgba(93, 255, 141, 0.12);
          border-color: rgba(93, 255, 141, 0.18);
        }

        .desktop-page-chip.tone-members {
          background: rgba(99, 213, 255, 0.12);
          border-color: rgba(99, 213, 255, 0.18);
        }

        .desktop-page-chip.tone-categories {
          background: rgba(178, 109, 255, 0.12);
          border-color: rgba(178, 109, 255, 0.18);
        }

        .desktop-page-title {
          margin: 0;
          font-size: 34px;
          line-height: 0.98;
          letter-spacing: -0.04em;
          font-weight: 900;
          color: var(--text-strong);
          text-shadow:
            0 0 18px rgba(93, 255, 141, 0.08),
            0 0 20px rgba(99, 213, 255, 0.06);
        }

        .desktop-page-subtitle {
          margin-top: 8px;
          max-width: 920px;
          line-height: 1.55;
        }

        .desktop-page-body {
          min-width: 0;
        }
      `}</style>
    </div>
  );
}

function DesktopTicketRail({
  counts = {},
  intelligence = {},
  statusFilter,
  jumpToTickets,
  jumpToPanel,
  refresh,
}) {
  const queueViews = [
    {
      key: "queue",
      label: "Full Queue",
      helper: `${Number(counts?.queueTotal || 0)} live tickets`,
      active: statusFilter === "queue" || statusFilter === "active",
      tone: "green",
      onClick: () => jumpToTickets?.({ status: "queue" }),
    },
    {
      key: "unclaimed",
      label: "Unclaimed",
      helper: `${Number(counts?.queueUnclaimed || 0)} waiting for staff`,
      active: statusFilter === "unclaimed",
      tone: "amber",
      onClick: () => jumpToTickets?.({ status: "unclaimed" }),
    },
    {
      key: "claimed",
      label: "Claimed",
      helper: `${Number(counts?.queueClaimed || 0)} in progress`,
      active: statusFilter === "claimed",
      tone: "blue",
      onClick: () => jumpToTickets?.({ status: "claimed" }),
    },
    {
      key: "mine",
      label: "My Queue",
      helper: "Staff-owned tickets only",
      active: statusFilter === "my_claimed",
      tone: "purple",
      onClick: () => jumpToTickets?.({ status: "my_claimed" }),
    },
    {
      key: "closed",
      label: "Closed",
      helper: "Audit and reopen workflow",
      active: statusFilter === "closed",
      tone: "slate",
      onClick: () => jumpToTickets?.({ status: "closed" }),
    },
  ];

  const shortcuts = [
    {
      key: "refresh",
      label: "Refresh",
      helper: "Pull latest state",
      tone: "green",
      onClick: () => refresh?.({ force: true, reason: "desktop-ticket-rail" }),
    },
    {
      key: "overdue",
      label: "Overdue",
      helper: `${Number(counts?.queueOverdue || 0)} need response now`,
      tone: "pink",
      onClick: () => jumpToTickets?.({ status: "queue" }),
    },
    {
      key: "verify",
      label: "Pending Verify",
      helper: `${Number(intelligence?.pendingVerification || 0)} waiting`,
      tone: "purple",
      onClick: () => jumpToTickets?.({ status: "queue" }),
    },
    {
      key: "fraud",
      label: "Fraud",
      helper: `${Number(counts?.fraudFlags || 0)} flagged`,
      tone: "pink",
      onClick: () => jumpToPanel?.("fraud"),
    },
    {
      key: "warns",
      label: "Warns",
      helper: `${Number(counts?.warnsToday || 0)} today`,
      tone: "amber",
      onClick: () => jumpToPanel?.("warns"),
    },
  ];

  return (
    <>
      <div className="desktop-ticket-rail">
        <div className="desktop-ticket-rail-group">
          <div className="desktop-ticket-rail-title">Queue Views</div>
          <div className="desktop-ticket-rail-grid">
            {queueViews.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`desktop-ticket-rail-card tone-${item.tone} ${item.active ? "active" : ""}`}
                onClick={item.onClick}
              >
                <span className="desktop-ticket-rail-label">{item.label}</span>
                <span className="desktop-ticket-rail-helper">{item.helper}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="desktop-ticket-rail-group">
          <div className="desktop-ticket-rail-title">Operator Shortcuts</div>
          <div className="desktop-ticket-rail-grid compact">
            {shortcuts.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`desktop-ticket-rail-card tone-${item.tone}`}
                onClick={item.onClick}
              >
                <span className="desktop-ticket-rail-label">{item.label}</span>
                <span className="desktop-ticket-rail-helper">{item.helper}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .desktop-ticket-rail {
          display: grid;
          gap: 14px;
          margin-bottom: 16px;
        }

        .desktop-ticket-rail-group {
          display: grid;
          gap: 10px;
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.02);
        }

        .desktop-ticket-rail-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, rgba(255, 255, 255, 0.72));
        }

        .desktop-ticket-rail-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .desktop-ticket-rail-grid.compact {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .desktop-ticket-rail-card {
          text-align: left;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          padding: 12px;
          color: var(--text-strong, #f8fafc);
          display: grid;
          gap: 6px;
          cursor: pointer;
          transition:
            transform 0.16s ease,
            border-color 0.16s ease,
            box-shadow 0.16s ease,
            background 0.16s ease;
        }

        .desktop-ticket-rail-card:hover,
        .desktop-ticket-rail-card.active {
          transform: translateY(-1px);
          border-color: rgba(93, 255, 141, 0.18);
          box-shadow: var(--glow-green);
        }

        .desktop-ticket-rail-card.active {
          background: linear-gradient(180deg, rgba(93, 255, 141, 0.12), rgba(99, 213, 255, 0.06));
        }

        .desktop-ticket-rail-label {
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
        }

        .desktop-ticket-rail-helper {
          font-size: 12px;
          line-height: 1.4;
          color: var(--muted, rgba(255, 255, 255, 0.72));
        }

        .tone-green.active,
        .tone-green:hover {
          border-color: rgba(93, 255, 141, 0.22);
        }

        .tone-blue.active,
        .tone-blue:hover {
          border-color: rgba(99, 213, 255, 0.22);
          box-shadow: var(--glow-blue);
        }

        .tone-amber.active,
        .tone-amber:hover {
          border-color: rgba(255, 211, 107, 0.22);
          box-shadow: var(--glow-amber);
        }

        .tone-purple.active,
        .tone-purple:hover {
          border-color: rgba(178, 109, 255, 0.22);
          box-shadow: var(--glow-purple);
        }

        .tone-pink.active,
        .tone-pink:hover {
          border-color: rgba(255, 111, 142, 0.24);
          box-shadow: 0 0 0 1px rgba(255, 111, 142, 0.08), 0 0 24px rgba(255, 111, 142, 0.12);
        }

        @media (max-width: 1599px) {
          .desktop-ticket-rail-grid,
          .desktop-ticket-rail-grid.compact {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1319px) {
          .desktop-ticket-rail-grid,
          .desktop-ticket-rail-grid.compact {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  );
}

function DesktopTicketsHeader({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  sortBy,
  setSortBy,
  handleReconcileTickets,
  handlePreviewPurge,
  handlePurgeStale,
  isMaintaining,
  refresh,
}) {
  const [showMaintenance, setShowMaintenance] = useState(false);

  const summaryLabel = useMemo(() => {
    const parts = [];

    if (statusFilter === "queue" || statusFilter === "active") parts.push("Queue");
    else if (statusFilter === "unclaimed") parts.push("Unclaimed");
    else if (statusFilter === "claimed") parts.push("Claimed");
    else if (statusFilter === "my_claimed") parts.push("Mine");
    else if (statusFilter === "open_only") parts.push("Open Only");
    else if (statusFilter === "closed") parts.push("Closed");
    else if (statusFilter === "deleted") parts.push("Deleted");
    else parts.push("All Statuses");

    if (priorityFilter !== "all") {
      parts.push(`${priorityFilter[0].toUpperCase()}${priorityFilter.slice(1)} Priority`);
    }

    return parts.join(" • ");
  }, [statusFilter, priorityFilter]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("queue");
    setPriorityFilter("all");
    setSortBy("priority_desc");
  }

  return (
    <>
      <div className="desktop-ticket-header-shell">
        <div className="desktop-ticket-primary-grid">
          <div className="desktop-ticket-search-wrap">
            <label className="desktop-label">Search</label>
            <input
              className="input"
              placeholder="Search tickets, categories, channels, users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="desktop-ticket-select-wrap">
            <label className="desktop-label">Queue View</label>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="queue">Full Queue (Open + Claimed)</option>
              <option value="unclaimed">Unclaimed Only</option>
              <option value="claimed">Claimed Only</option>
              <option value="my_claimed">My Claimed Tickets</option>
              <option value="all">All statuses</option>
              <option value="open_only">Open Only</option>
              <option value="closed">Closed</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          <div className="desktop-ticket-select-wrap">
            <label className="desktop-label">Sort</label>
            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="priority_desc">Priority Desc</option>
              <option value="priority_asc">Priority Asc</option>
              <option value="updated_desc">Updated Desc</option>
              <option value="updated_asc">Updated Asc</option>
              <option value="created_desc">Created Desc</option>
              <option value="created_asc">Created Asc</option>
            </select>
          </div>

          <div className="desktop-ticket-primary-actions">
            <button
              type="button"
              className="button"
              style={{ width: "auto", minWidth: 136 }}
              onClick={() => refresh({ force: true, reason: "desktop-ticket-refresh" })}
            >
              Refresh Queue
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 150 }}
              onClick={() => setShowMaintenance((prev) => !prev)}
            >
              {showMaintenance ? "Hide Maintenance" : "Maintenance"}
            </button>
          </div>
        </div>

        <div className="desktop-ticket-secondary-row">
          <div className="desktop-ticket-chip-row">
            <span className="desktop-filter-chip active">{summaryLabel}</span>
            <span className="desktop-filter-chip">
              {search.trim() ? `Search: ${search}` : "No search filter"}
            </span>
          </div>

          <div className="desktop-ticket-inline-actions">
            <div className="desktop-ticket-inline-select">
              <label className="desktop-label">Priority</label>
              <select
                className="input"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 126 }}
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {showMaintenance ? (
          <div className="desktop-ticket-maintenance-card">
            <div className="desktop-ticket-maintenance-head">
              <div>
                <div className="desktop-ticket-maintenance-title">Maintenance</div>
                <div className="muted desktop-ticket-maintenance-copy">
                  Keep repair and cleanup tools away from the main moderation loop
                  so staff can work faster with fewer misclicks.
                </div>
              </div>
            </div>

            <div className="desktop-ticket-maintenance-grid">
              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 154 }}
                disabled={isMaintaining}
                onClick={() =>
                  handleReconcileTickets({
                    includeOpenWithMissingChannel: true,
                    includeTranscriptBackfill: true,
                    dryRun: true,
                  })
                }
              >
                {isMaintaining ? "Working..." : "Preview Reconcile"}
              </button>

              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 154 }}
                disabled={isMaintaining}
                onClick={() =>
                  handleReconcileTickets({
                    includeOpenWithMissingChannel: true,
                    includeTranscriptBackfill: true,
                    dryRun: false,
                  })
                }
              >
                {isMaintaining ? "Working..." : "Reconcile Tickets"}
              </button>

              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 154 }}
                disabled={isMaintaining}
                onClick={handlePreviewPurge}
              >
                {isMaintaining ? "Working..." : "Preview Purge"}
              </button>

              <button
                type="button"
                className="button danger"
                style={{ width: "auto", minWidth: 154 }}
                disabled={isMaintaining}
                onClick={handlePurgeStale}
              >
                {isMaintaining ? "Working..." : "Purge Stale"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .desktop-ticket-header-shell {
          display: grid;
          gap: 14px;
          margin-bottom: 14px;
        }

        .desktop-ticket-primary-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) 260px 220px auto;
          gap: 12px;
          align-items: end;
        }

        .desktop-ticket-search-wrap,
        .desktop-ticket-select-wrap,
        .desktop-ticket-inline-select {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .desktop-ticket-primary-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: end;
        }

        .desktop-ticket-secondary-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
          flex-wrap: wrap;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.02);
        }

        .desktop-ticket-chip-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .desktop-filter-chip {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          font-size: 12px;
          color: var(--text);
          overflow-wrap: anywhere;
          max-width: 100%;
        }

        .desktop-filter-chip.active {
          border-color: rgba(99, 213, 255, 0.18);
          background: rgba(99, 213, 255, 0.08);
        }

        .desktop-ticket-inline-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: end;
        }

        .desktop-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted, rgba(255,255,255,0.72));
        }

        .desktop-ticket-maintenance-card {
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(178, 109, 255, 0.08), transparent 36%),
            rgba(255, 255, 255, 0.025);
        }

        .desktop-ticket-maintenance-head {
          margin-bottom: 12px;
        }

        .desktop-ticket-maintenance-title {
          font-weight: 900;
          font-size: 16px;
          color: var(--text-strong);
        }

        .desktop-ticket-maintenance-copy {
          margin-top: 6px;
          line-height: 1.55;
          max-width: 920px;
        }

        .desktop-ticket-maintenance-grid {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        @media (max-width: 1599px) {
          .desktop-ticket-primary-grid {
            grid-template-columns: minmax(0, 1fr) 240px 220px;
          }

          .desktop-ticket-primary-actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
          }
        }

        @media (max-width: 1319px) {
          .desktop-ticket-primary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .desktop-ticket-secondary-row {
            flex-direction: column;
            align-items: stretch;
          }

          .desktop-ticket-inline-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
}

export default function DesktopDashboardView({
  activeTab,
  counts,
  safeCategories,
  intelligence,
  jumpToTickets,
  jumpToPanel,
  refresh,
  homeLayout,
  membersLayout,
  sectionVisibility,
  homeSections,
  membersSections,
  filteredTickets,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  sortBy,
  setSortBy,
  handleReconcileTickets,
  handlePreviewPurge,
  handlePurgeStale,
  isMaintaining,
  density = "comfortable",
}) {
  const gap =
    density === "compact"
      ? "14px"
      : density === "spacious"
        ? "24px"
        : "18px";

  const visibleHomeKeys = homeLayout.filter((key) => sectionVisibility[key] !== false);
  const visibleMembersKeys = membersLayout.filter((key) => sectionVisibility[key] !== false);

  function homeItemClass(key, index) {
    const order = index + 1;

    if (key === "intelligence") return "desktop-home-item-full";
    if (key === "stats") return "desktop-home-item-half";
    if (key === "quickActions") return "desktop-home-item-half";
    if (key === "activity") return "desktop-home-item-wide";
    if (key === "warns" || key === "raids" || key === "fraud") {
      return "desktop-home-item-third";
    }

    if (order === 1) return "desktop-home-item-full";
    if (order === 2 || order === 3) return "desktop-home-item-half";
    if (order === 4) return "desktop-home-item-wide";

    return "desktop-home-item-third";
  }

  function membersItemClass(key, index) {
    const order = index + 1;

    if (key === "memberSnapshot") return "desktop-members-item-full";
    if (key === "freshEntrants") return "desktop-members-item-half";
    if (key === "staffMetrics") return "desktop-members-item-half";
    if (key === "roleHierarchy") return "desktop-members-item-half";
    if (key === "memberSearch") return "desktop-members-item-full";

    if (order === 1) return "desktop-members-item-half";
    if (order === 2) return "desktop-members-item-half";
    if (order === 3) return "desktop-members-item-full";

    return "desktop-members-item-half";
  }

  const ticketTitle =
    statusFilter === "closed"
      ? "Closed Ticket History"
      : statusFilter === "deleted"
        ? "Deleted Ticket History"
        : statusFilter === "all"
          ? "Ticket History & Queue"
          : statusFilter === "claimed"
            ? "Claimed Ticket Queue"
            : statusFilter === "unclaimed"
              ? "Unclaimed Ticket Queue"
              : statusFilter === "my_claimed"
                ? "My Claimed Tickets"
                : statusFilter === "open_only"
                  ? "Open Ticket Queue"
                  : "Active Ticket Queue";

  const ticketSubtitle =
    statusFilter === "closed"
      ? "Closed tickets stay visible for auditing, trend review, and controlled reopen workflows."
      : statusFilter === "deleted"
        ? "Deleted ticket records stay visible here for audit and historical review."
        : statusFilter === "all"
          ? "Active and historical tickets together for review, auditing, and reopen workflows."
          : statusFilter === "claimed"
            ? "Tickets already assigned and actively being worked."
            : statusFilter === "unclaimed"
              ? "Tickets waiting for a staff member to claim and begin handling."
              : statusFilter === "my_claimed"
                ? "Tickets currently assigned to the selected staff member."
                : "A cleaner operator view for fast scanning, faster claiming, and less clutter than a generic ticket page.";

  return (
    <div className="desktop-dashboard-shell">
      {activeTab === "home" ? (
        <section className="desktop-tab-section">
          <DesktopKpiStrip
            counts={counts}
            intelligence={intelligence}
            jumpToTickets={jumpToTickets}
            jumpToPanel={jumpToPanel}
          />

          <div className="desktop-home-grid">
            {visibleHomeKeys.map((key, index) => (
              <div
                key={`desktop-home-${key}`}
                className={`desktop-grid-item ${homeItemClass(key, index)}`}
              >
                {homeSections[key] || null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "tickets" ? (
        <section className="desktop-tab-section">
          <DesktopPageShell
            title={ticketTitle}
            subtitle={ticketSubtitle}
            tone="tickets"
          >
            <DesktopTicketsHeader
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              handleReconcileTickets={handleReconcileTickets}
              handlePreviewPurge={handlePreviewPurge}
              handlePurgeStale={handlePurgeStale}
              isMaintaining={isMaintaining}
              refresh={refresh}
            />

            <DesktopTicketRail
              counts={counts}
              intelligence={intelligence}
              statusFilter={statusFilter}
              jumpToTickets={jumpToTickets}
              jumpToPanel={jumpToPanel}
              refresh={refresh}
            />

            <div className="muted desktop-ticket-note">
              Staff should not hunt for routine actions. Queue views, high-pressure
              shortcuts, and maintenance are separated so everyday ticket handling
              stays quicker and safer.
            </div>

            <div>{filteredTickets}</div>
          </DesktopPageShell>
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="desktop-tab-section">
          <DesktopPageShell
            title="Member + Role Command Deck"
            subtitle="Search people faster, inspect identity history, and run member moderation without leaving the dashboard."
            tone="members"
          >
            <div className="desktop-members-grid">
              {visibleMembersKeys.map((key, index) => (
                <div
                  key={`desktop-members-${key}`}
                  className={`desktop-grid-item ${membersItemClass(key, index)}`}
                >
                  {membersSections[key] || null}
                </div>
              ))}
            </div>
          </DesktopPageShell>
        </section>
      ) : null}

      {activeTab === "categories" ? (
        <section className="desktop-tab-section">
          {sectionVisibility.categories !== false ? (
            <DesktopPageShell
              title="Category Routing Lab"
              subtitle="Tune intake paths, map help types cleanly, and jump straight into matching ticket flows."
              tone="categories"
            >
              {safeCategories}
            </DesktopPageShell>
          ) : (
            <div className="empty-state">
              Categories is hidden in your personalization settings.
            </div>
          )}
        </section>
      ) : null}

      <style jsx>{`
        .desktop-dashboard-shell {
          display: none;
        }

        @media (min-width: 1024px) {
          .desktop-dashboard-shell {
            display: block;
          }

          .desktop-tab-section {
            margin-top: 16px;
          }

          .desktop-ticket-note {
            margin-bottom: 14px;
            font-size: 12px;
            line-height: 1.6;
            max-width: 980px;
          }

          .desktop-home-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: ${gap};
            align-items: start;
          }

          .desktop-members-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: ${gap};
            align-items: start;
          }

          .desktop-grid-item {
            min-width: 0;
          }

          .desktop-home-item-full {
            grid-column: span 12;
          }

          .desktop-home-item-half {
            grid-column: span 6;
          }

          .desktop-home-item-wide {
            grid-column: span 8;
          }

          .desktop-home-item-third {
            grid-column: span 4;
          }

          .desktop-members-item-full {
            grid-column: span 12;
          }

          .desktop-members-item-half {
            grid-column: span 6;
          }
        }

        @media (min-width: 1024px) and (max-width: 1399px) {
          .desktop-home-item-half,
          .desktop-home-item-wide,
          .desktop-home-item-third,
          .desktop-members-item-half {
            grid-column: span 12;
          }
        }
      `}</style>
    </div>
  );
}
