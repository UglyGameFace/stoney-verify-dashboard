"use client";

import { useMemo, useState } from "react";
import {
  HOME_WORKSPACE_KEYS,
  ACTIVITY_WORKSPACE_KEYS,
  MEMBERS_WORKSPACE_KEYS,
} from "@/components/dashboard/workspaceModel";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function DashboardGrid({ children, className = "" }) {
  return <div className={`desktop-dashboard-grid ${className}`}>{children}</div>;
}

function DesktopKpiStrip({ counts = {}, intelligence = {}, jumpToTickets, jumpToPanel }) {
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
  ];

  return (
    <div className="desktop-kpi-strip">
      {items.map((item) => (
        <button key={item.key} type="button" className={`desktop-kpi-card tone-${item.tone}`} onClick={item.onClick}>
          <span className="desktop-kpi-label">{item.label}</span>
          <span className="desktop-kpi-value">{item.value}</span>
          <span className="desktop-kpi-helper">{item.helper}</span>
        </button>
      ))}
    </div>
  );
}

function DesktopPageShell({ title, subtitle, tone = "default", children }) {
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
                  : tone === "activity"
                    ? "Signals + Audit"
                    : tone === "categories"
                      ? "Routing"
                      : "Dashboard"}
            </span>
          </div>
          <h2 className="desktop-page-title">{title}</h2>
          {subtitle ? <div className="muted desktop-page-subtitle">{subtitle}</div> : null}
        </div>
      </div>
      <div className="glass-divider" style={{ marginBottom: 14 }} />
      <div className="desktop-page-body">{children}</div>
    </div>
  );
}

function DesktopTicketRail({ counts = {}, intelligence = {}, statusFilter, jumpToTickets, jumpToPanel, refresh }) {
  const queueViews = [
    ["queue", "Full Queue", `${Number(counts?.queueTotal || 0)} live tickets`, statusFilter === "queue" || statusFilter === "active", "green"],
    ["unclaimed", "Unclaimed", `${Number(counts?.queueUnclaimed || 0)} waiting for staff`, statusFilter === "unclaimed", "amber"],
    ["claimed", "Claimed", `${Number(counts?.queueClaimed || 0)} in progress`, statusFilter === "claimed", "blue"],
    ["mine", "My Queue", "Staff-owned tickets only", statusFilter === "my_claimed", "purple"],
    ["closed", "Closed", "Audit and reopen workflow", statusFilter === "closed", "slate"],
  ];

  const shortcuts = [
    { key: "refresh", label: "Refresh", helper: "Pull latest state", tone: "green", onClick: () => refresh?.({ force: true, reason: "desktop-ticket-rail" }) },
    { key: "overdue", label: "Overdue", helper: `${Number(counts?.queueOverdue || 0)} need response now`, tone: "pink", onClick: () => jumpToTickets?.({ status: "queue" }) },
    { key: "verify", label: "Pending Verify", helper: `${Number(intelligence?.pendingVerification || 0)} waiting`, tone: "purple", onClick: () => jumpToTickets?.({ status: "queue" }) },
    { key: "fraud", label: "Fraud", helper: `${Number(counts?.fraudFlags || 0)} flagged`, tone: "pink", onClick: () => jumpToPanel?.("fraud") },
    { key: "warns", label: "Warns", helper: `${Number(counts?.warnsToday || 0)} today`, tone: "amber", onClick: () => jumpToPanel?.("warns") },
  ];

  return (
    <div className="desktop-ticket-rail">
      <div className="desktop-ticket-rail-group">
        <div className="desktop-ticket-rail-title">Queue Views</div>
        <div className="desktop-ticket-rail-grid">
          {queueViews.map(([key, label, helper, active, tone]) => (
            <button
              key={key}
              type="button"
              className={`desktop-ticket-rail-card tone-${tone} ${active ? "active" : ""}`}
              onClick={() => jumpToTickets?.({ status: key === "mine" ? "my_claimed" : key })}
            >
              <span className="desktop-ticket-rail-label">{label}</span>
              <span className="desktop-ticket-rail-helper">{helper}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="desktop-ticket-rail-group">
        <div className="desktop-ticket-rail-title">Operator Shortcuts</div>
        <div className="desktop-ticket-rail-grid compact">
          {shortcuts.map((item) => (
            <button key={item.key} type="button" className={`desktop-ticket-rail-card tone-${item.tone}`} onClick={item.onClick}>
              <span className="desktop-ticket-rail-label">{item.label}</span>
              <span className="desktop-ticket-rail-helper">{item.helper}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
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

  function clearFilters() {
    setSearch("");
    setStatusFilter("queue");
    setPriorityFilter("all");
    setSortBy("priority_desc");
  }

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
    if (priorityFilter !== "all") parts.push(`${priorityFilter[0].toUpperCase()}${priorityFilter.slice(1)} Priority`);
    return parts.join(" • ");
  }, [statusFilter, priorityFilter]);

  return (
    <div className="desktop-ticket-header-shell">
      <div className="desktop-ticket-primary-grid">
        <label className="desktop-ticket-field">
          <span className="desktop-label">Search</span>
          <input className="input" placeholder="Search tickets, categories, channels, users…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>

        <label className="desktop-ticket-field">
          <span className="desktop-label">Queue View</span>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="queue">Full Queue (Open + Claimed)</option>
            <option value="unclaimed">Unclaimed Only</option>
            <option value="claimed">Claimed Only</option>
            <option value="my_claimed">My Claimed Tickets</option>
            <option value="all">All statuses</option>
            <option value="open_only">Open Only</option>
            <option value="closed">Closed</option>
            <option value="deleted">Deleted</option>
          </select>
        </label>

        <label className="desktop-ticket-field">
          <span className="desktop-label">Sort</span>
          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="priority_desc">Priority Desc</option>
            <option value="priority_asc">Priority Asc</option>
            <option value="updated_desc">Updated Desc</option>
            <option value="updated_asc">Updated Asc</option>
            <option value="created_desc">Created Desc</option>
            <option value="created_asc">Created Asc</option>
          </select>
        </label>

        <div className="desktop-ticket-primary-actions">
          <button type="button" className="button" onClick={() => refresh({ force: true, reason: "desktop-ticket-refresh" })}>Refresh Queue</button>
          <button type="button" className="button ghost" onClick={() => setShowMaintenance((prev) => !prev)}>
            {showMaintenance ? "Hide Maintenance" : "Maintenance"}
          </button>
        </div>
      </div>

      <div className="desktop-ticket-secondary-row">
        <div className="desktop-ticket-chip-row">
          <span className="desktop-filter-chip active">{summaryLabel}</span>
          <span className="desktop-filter-chip">{search.trim() ? `Search: ${search}` : "No search filter"}</span>
        </div>

        <div className="desktop-ticket-inline-actions">
          <label className="desktop-ticket-field inline">
            <span className="desktop-label">Priority</span>
            <select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <button type="button" className="button ghost" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>

      {showMaintenance ? (
        <div className="desktop-ticket-maintenance-card">
          <div className="desktop-ticket-maintenance-title">Maintenance</div>
          <div className="muted desktop-ticket-maintenance-copy">
            Keep repair and cleanup tools away from the main moderation loop so staff can work faster with fewer misclicks.
          </div>
          <div className="desktop-ticket-maintenance-grid">
            <button type="button" className="button ghost" disabled={isMaintaining} onClick={() => handleReconcileTickets({ includeOpenWithMissingChannel: true, includeTranscriptBackfill: true, dryRun: true })}>
              {isMaintaining ? "Working..." : "Preview Reconcile"}
            </button>
            <button type="button" className="button ghost" disabled={isMaintaining} onClick={() => handleReconcileTickets({ includeOpenWithMissingChannel: true, includeTranscriptBackfill: true, dryRun: false })}>
              {isMaintaining ? "Working..." : "Reconcile Tickets"}
            </button>
            <button type="button" className="button ghost" disabled={isMaintaining} onClick={handlePreviewPurge}>
              {isMaintaining ? "Working..." : "Preview Purge"}
            </button>
            <button type="button" className="button danger" disabled={isMaintaining} onClick={handlePurgeStale}>
              {isMaintaining ? "Working..." : "Purge Stale"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
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
  homeLayout = HOME_WORKSPACE_KEYS,
  activityLayout = ACTIVITY_WORKSPACE_KEYS,
  membersLayout = MEMBERS_WORKSPACE_KEYS,
  sectionVisibility = {},
  homeSections = {},
  activitySections,
  membersSections = {},
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
  const gap = density === "compact" ? "14px" : density === "spacious" ? "24px" : "18px";
  const mergedActivitySections = activitySections || homeSections;
  const visibleHomeKeys = safeArray(homeLayout).filter((key) => sectionVisibility[key] !== false);
  const visibleActivityKeys = safeArray(activityLayout).filter((key) => sectionVisibility[key] !== false);
  const visibleMembersKeys = safeArray(membersLayout).filter((key) => sectionVisibility[key] !== false);

  const ticketTitle = statusFilter === "closed"
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

  const ticketSubtitle = statusFilter === "closed"
    ? "Closed tickets stay visible for auditing, trend review, and controlled reopen workflows."
    : statusFilter === "deleted"
      ? "Deleted ticket records stay visible here for audit and historical review."
      : statusFilter === "all"
        ? "Active and historical tickets together for review, auditing, and reopen workflows."
        : "A cleaner operator view for fast scanning, faster claiming, and less clutter than a generic ticket page.";

  function homeItemClass(key, index) {
    if (key === "intelligence") return "desktop-item-full";
    if (key === "stats" || key === "quickActions") return "desktop-item-half";
    return index === 0 ? "desktop-item-full" : "desktop-item-half";
  }

  function activityItemClass(key) {
    if (key === "activity") return "desktop-item-full";
    return "desktop-item-third";
  }

  function membersItemClass(key, index) {
    if (key === "memberSnapshot" || key === "memberSearch") return "desktop-item-full";
    return index <= 2 ? "desktop-item-half" : "desktop-item-half";
  }

  return (
    <div className="desktop-dashboard-shell" style={{ "--desktop-gap": gap }}>
      {activeTab === "home" ? (
        <section className="desktop-tab-section">
          <DesktopKpiStrip counts={counts} intelligence={intelligence} jumpToTickets={jumpToTickets} jumpToPanel={jumpToPanel} />
          <DashboardGrid>
            {visibleHomeKeys.map((key, index) => (
              <div key={`desktop-home-${key}`} className={`desktop-grid-item ${homeItemClass(key, index)}`}>
                {homeSections[key] || null}
              </div>
            ))}
          </DashboardGrid>
        </section>
      ) : null}

      {activeTab === "activity" ? (
        <section className="desktop-tab-section">
          <DesktopPageShell
            title="Activity + Risk Signals"
            subtitle="Audit feed, warning intelligence, raid signals, and fraud indicators live together here instead of cluttering Home."
            tone="activity"
          >
            <DashboardGrid className="activity-grid">
              {visibleActivityKeys.map((key) => (
                <div key={`desktop-activity-${key}`} className={`desktop-grid-item ${activityItemClass(key)}`}>
                  {mergedActivitySections[key] || null}
                </div>
              ))}
            </DashboardGrid>
          </DesktopPageShell>
        </section>
      ) : null}

      {activeTab === "tickets" ? (
        <section className="desktop-tab-section">
          <DesktopPageShell title={ticketTitle} subtitle={ticketSubtitle} tone="tickets">
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
            <DesktopTicketRail counts={counts} intelligence={intelligence} statusFilter={statusFilter} jumpToTickets={jumpToTickets} jumpToPanel={jumpToPanel} refresh={refresh} />
            <div className="muted desktop-ticket-note">
              Staff should not hunt for routine actions. Queue views, high-pressure shortcuts, and maintenance are separated so everyday ticket handling stays quicker and safer.
            </div>
            <div>{filteredTickets}</div>
          </DesktopPageShell>
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="desktop-tab-section">
          <DesktopPageShell title="Member + Role Command Deck" subtitle="Search people faster, inspect identity history, and run member moderation without leaving the dashboard." tone="members">
            <DashboardGrid>
              {visibleMembersKeys.map((key, index) => (
                <div key={`desktop-members-${key}`} className={`desktop-grid-item ${membersItemClass(key, index)}`}>
                  {membersSections[key] || null}
                </div>
              ))}
            </DashboardGrid>
          </DesktopPageShell>
        </section>
      ) : null}

      {activeTab === "categories" ? (
        <section className="desktop-tab-section">
          {sectionVisibility.categories !== false ? (
            <DesktopPageShell title="Category Routing Lab" subtitle="Tune intake paths, map help types cleanly, and jump straight into matching ticket flows." tone="categories">
              {safeCategories}
            </DesktopPageShell>
          ) : (
            <div className="empty-state">Categories is hidden in your personalization settings.</div>
          )}
        </section>
      ) : null}

      <style jsx>{`
        .desktop-dashboard-shell { display: none; }
        @media (min-width: 1024px) {
          .desktop-dashboard-shell { display: block; }
          .desktop-tab-section { margin-top: 16px; }
          .desktop-kpi-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--desktop-gap); margin-bottom: 18px; }
          .desktop-kpi-card, .desktop-ticket-rail-card { text-align: left; color: var(--text-strong); cursor: pointer; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); border-radius: 18px; padding: 14px; display: grid; gap: 7px; }
          .desktop-kpi-card { min-height: 104px; }
          .desktop-kpi-card:hover, .desktop-ticket-rail-card:hover, .desktop-ticket-rail-card.active { transform: translateY(-1px); border-color: rgba(93,255,141,0.18); box-shadow: var(--glow-green); }
          .desktop-kpi-label, .desktop-kpi-helper, .desktop-ticket-rail-helper, .desktop-page-subtitle { color: var(--muted); line-height: 1.4; }
          .desktop-kpi-label, .desktop-kpi-helper, .desktop-ticket-rail-helper { font-size: 12px; }
          .desktop-kpi-value { font-size: 32px; font-weight: 950; letter-spacing: -0.05em; line-height: 0.95; }
          .desktop-page-shell { padding: 20px; border-radius: 28px; overflow: hidden; }
          .desktop-page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
          .desktop-page-chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
          .desktop-page-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text); border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); }
          .desktop-page-chip.tone-tickets { background: rgba(93,255,141,0.12); border-color: rgba(93,255,141,0.18); }
          .desktop-page-chip.tone-members { background: rgba(99,213,255,0.12); border-color: rgba(99,213,255,0.18); }
          .desktop-page-chip.tone-activity { background: rgba(255,211,107,0.12); border-color: rgba(255,211,107,0.18); }
          .desktop-page-chip.tone-categories { background: rgba(178,109,255,0.12); border-color: rgba(178,109,255,0.18); }
          .desktop-page-title { margin: 0; font-size: 34px; line-height: 0.98; letter-spacing: -0.04em; font-weight: 950; color: var(--text-strong); }
          .desktop-page-subtitle { margin-top: 8px; max-width: 920px; }
          .desktop-dashboard-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--desktop-gap); align-items: start; }
          .desktop-grid-item { min-width: 0; }
          .desktop-item-full { grid-column: span 12; }
          .desktop-item-half { grid-column: span 6; }
          .desktop-item-third { grid-column: span 4; }
          .desktop-ticket-header-shell, .desktop-ticket-rail { display: grid; gap: 14px; margin-bottom: 14px; }
          .desktop-ticket-primary-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) 260px 220px auto; gap: 12px; align-items: end; }
          .desktop-ticket-field { display: grid; gap: 6px; min-width: 0; }
          .desktop-ticket-field.inline { width: min(220px, 100%); }
          .desktop-ticket-primary-actions, .desktop-ticket-inline-actions, .desktop-ticket-maintenance-grid { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; }
          .desktop-ticket-primary-actions { justify-content: flex-end; }
          .desktop-ticket-secondary-row, .desktop-ticket-maintenance-card, .desktop-ticket-rail-group { padding: 12px 14px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); }
          .desktop-ticket-secondary-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
          .desktop-ticket-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
          .desktop-filter-chip { min-height: 32px; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); font-size: 12px; color: var(--text); }
          .desktop-filter-chip.active { border-color: rgba(99,213,255,0.18); background: rgba(99,213,255,0.08); }
          .desktop-label, .desktop-ticket-rail-title { font-size: 11px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
          .desktop-ticket-maintenance-title { font-weight: 950; color: var(--text-strong); }
          .desktop-ticket-maintenance-copy { margin: 6px 0 12px; line-height: 1.55; }
          .desktop-ticket-rail-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
          .desktop-ticket-note { margin-bottom: 14px; font-size: 12px; line-height: 1.6; max-width: 980px; }
        }
        @media (min-width: 1024px) and (max-width: 1399px) {
          .desktop-item-half, .desktop-item-third { grid-column: span 12; }
          .desktop-kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .desktop-ticket-primary-grid, .desktop-ticket-rail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .desktop-ticket-primary-actions { grid-column: 1 / -1; justify-content: flex-start; }
          .desktop-ticket-secondary-row { align-items: stretch; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
