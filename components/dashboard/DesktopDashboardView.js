"use client";

function DesktopKpiStrip({
  counts = {},
  intelligence = {},
  jumpToTickets,
  jumpToPanel,
}) {
  const items = [
    {
      key: "openTickets",
      label: "Active Queue",
      value: Number(counts?.openTickets || 0),
      helper: "Open + claimed tickets",
      action: () => jumpToTickets?.({ status: "active" }),
      tone: "green",
    },
    {
      key: "warnsToday",
      label: "Warn Heat",
      value: Number(counts?.warnsToday || 0),
      helper: "Last 24 hours",
      action: () => jumpToPanel?.("warns"),
      tone: "amber",
    },
    {
      key: "raidAlerts",
      label: "Raid Signals",
      value: Number(counts?.raidAlerts || 0),
      helper: "Recent alerts",
      action: () => jumpToPanel?.("raids"),
      tone: "blue",
    },
    {
      key: "fraudFlags",
      label: "Fraud Smoke",
      value: Number(counts?.fraudFlags || 0),
      helper: "Flagged accounts",
      action: () => jumpToPanel?.("fraud"),
      tone: "pink",
    },
    {
      key: "pendingVerification",
      label: "Pending Verify",
      value: Number(intelligence?.pendingVerification || 0),
      helper: "Queue pressure",
      action: () => jumpToTickets?.({ status: "active" }),
      tone: "purple",
    },
    {
      key: "verifiedMembers",
      label: "Verified Core",
      value: Number(intelligence?.verifiedMembers || 0),
      helper: "Members verified",
      action: null,
      tone: "green",
    },
  ];

  return (
    <>
      <div className="desktop-kpi-strip">
        {items.map((item) => {
          const content = (
            <>
              <span className="desktop-kpi-label">{item.label}</span>
              <span className={`desktop-kpi-value tone-${item.tone}`}>
                {item.value}
              </span>
              <span className="desktop-kpi-helper">{item.helper}</span>
            </>
          );

          if (item.action) {
            return (
              <button
                key={item.key}
                type="button"
                className={`desktop-kpi-card clickable tone-${item.tone}`}
                onClick={item.action}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={item.key}
              className={`desktop-kpi-card tone-${item.tone}`}
            >
              {content}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .desktop-kpi-strip {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
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
          min-height: 110px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(93, 255, 141, 0.07), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
            linear-gradient(180deg, rgba(18, 30, 42, 0.95), rgba(8, 16, 26, 0.95));
          overflow: hidden;
        }

        .desktop-kpi-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.06),
            rgba(255, 255, 255, 0)
          );
          opacity: 0.55;
        }

        .desktop-kpi-card.clickable {
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .desktop-kpi-card.clickable:hover {
          transform: translateY(-2px);
          border-color: rgba(93, 255, 141, 0.18);
          box-shadow: var(--glow-green);
        }

        .desktop-kpi-label {
          font-size: 12px;
          color: var(--muted, rgba(255, 255, 255, 0.72));
          line-height: 1.2;
          position: relative;
          z-index: 1;
        }

        .desktop-kpi-value {
          font-size: 34px;
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.05em;
          overflow-wrap: anywhere;
          position: relative;
          z-index: 1;
        }

        .desktop-kpi-helper {
          font-size: 12px;
          color: var(--muted, rgba(255, 255, 255, 0.72));
          position: relative;
          z-index: 1;
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

        @media (max-width: 1499px) {
          .desktop-kpi-strip {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1199px) {
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
  actions,
  children,
  tone = "default",
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
                    ? "Support Routing"
                    : "Dashboard"}
            </span>
          </div>

          <h2 className="desktop-page-title">{title}</h2>

          {subtitle ? (
            <div className="muted desktop-page-subtitle">{subtitle}</div>
          ) : null}
        </div>

        {actions ? <div className="desktop-page-actions">{actions}</div> : null}
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
          max-width: 900px;
          line-height: 1.55;
        }

        .desktop-page-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .desktop-page-body {
          min-width: 0;
        }
      `}</style>
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
  return (
    <div className="desktop-ticket-header-shell">
      <div className="desktop-ticket-filter-grid">
        <input
          className="input"
          placeholder="Search tickets, categories, channels, users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="active">Active (Open + Claimed)</option>
          <option value="all">All statuses</option>
          <option value="open_only">Open Only</option>
          <option value="claimed">Claimed Only</option>
          <option value="closed">Closed</option>
          <option value="deleted">Deleted</option>
        </select>

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

      <div className="desktop-ticket-action-rail">
        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 132 }}
          onClick={() =>
            refresh({ force: true, reason: "desktop-ticket-refresh" })
          }
        >
          Refresh Queue
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 144 }}
          disabled={isMaintaining}
          onClick={() =>
            handleReconcileTickets({
              includeOpenWithMissingChannel: true,
              includeTranscriptBackfill: true,
              dryRun: false,
            })
          }
        >
          {isMaintaining ? "Working..." : "Reconcile"}
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 144 }}
          disabled={isMaintaining}
          onClick={handlePreviewPurge}
        >
          {isMaintaining ? "Working..." : "Preview Purge"}
        </button>

        <button
          type="button"
          className="button danger"
          style={{ width: "auto", minWidth: 144 }}
          disabled={isMaintaining}
          onClick={handlePurgeStale}
        >
          {isMaintaining ? "Working..." : "Purge Stale"}
        </button>
      </div>

      <style jsx>{`
        .desktop-ticket-header-shell {
          display: grid;
          gap: 14px;
          margin-bottom: 14px;
        }

        .desktop-ticket-filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(180px, 1fr));
          gap: 10px;
        }

        .desktop-ticket-action-rail {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        @media (max-width: 1399px) {
          .desktop-ticket-filter-grid {
            grid-template-columns: repeat(2, minmax(220px, 1fr));
          }
        }
      `}</style>
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

  const visibleHomeKeys = homeLayout.filter(
    (key) => sectionVisibility[key] !== false
  );
  const visibleMembersKeys = membersLayout.filter(
    (key) => sectionVisibility[key] !== false
  );

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
                className={`desktop-grid-item desktop-home-item desktop-home-item-${index + 1}`}
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
            title={
              statusFilter === "closed"
                ? "Closed Ticket History"
                : statusFilter === "deleted"
                  ? "Deleted Ticket History"
                  : statusFilter === "all"
                    ? "Ticket History & Queue"
                    : statusFilter === "claimed"
                      ? "Claimed Ticket Queue"
                      : statusFilter === "open_only"
                        ? "Open Ticket Queue"
                        : "Active Ticket Queue"
            }
            subtitle={
              statusFilter === "closed"
                ? "Closed tickets remain visible here so staff can review and reopen when needed."
                : statusFilter === "deleted"
                  ? "Deleted ticket records remain visible here for audit and historical review."
                  : statusFilter === "all"
                    ? "Active and historical tickets together for review, auditing, and reopen workflows."
                    : "Smoke-tested live moderation queue with fast filtering, repair controls, and cleaner action density."
            }
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

            <div className="muted desktop-ticket-note">
              Reconcile repairs stale ticket rows that no longer reflect Discord
              truth. Purge removes dead closed or deleted rows that no longer
              have a usable live channel.
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
                  className={`desktop-grid-item desktop-members-item desktop-members-item-${index + 1}`}
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
            line-height: 1.55;
          }

          .desktop-home-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: ${gap};
            align-items: start;
          }

          .desktop-home-item-1 {
            grid-column: span 12;
          }

          .desktop-home-item-2,
          .desktop-home-item-3 {
            grid-column: span 6;
          }

          .desktop-home-item-4,
          .desktop-home-item-5,
          .desktop-home-item-6,
          .desktop-home-item-7,
          .desktop-home-item-8,
          .desktop-home-item-9 {
            grid-column: span 6;
          }

          .desktop-members-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: ${gap};
            align-items: start;
          }

          .desktop-members-item-1,
          .desktop-members-item-2 {
            grid-column: span 6;
          }

          .desktop-members-item-3 {
            grid-column: span 12;
          }

          .desktop-members-item-4,
          .desktop-members-item-5,
          .desktop-members-item-6 {
            grid-column: span 6;
          }

          .desktop-grid-item {
            min-width: 0;
          }
        }

        @media (min-width: 1024px) and (max-width: 1399px) {
          .desktop-home-item-2,
          .desktop-home-item-3,
          .desktop-home-item-4,
          .desktop-home-item-5,
          .desktop-home-item-6,
          .desktop-home-item-7,
          .desktop-home-item-8,
          .desktop-home-item-9 {
            grid-column: span 12;
          }

          .desktop-members-item-1,
          .desktop-members-item-2,
          .desktop-members-item-3,
          .desktop-members-item-4,
          .desktop-members-item-5,
          .desktop-members-item-6 {
            grid-column: span 12;
          }
        }
      `}</style>
    </div>
  );
}
