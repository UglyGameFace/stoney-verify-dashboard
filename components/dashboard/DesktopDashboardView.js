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
      label: "Open Tickets",
      value: Number(counts?.openTickets || 0),
      action: () => jumpToTickets?.({ status: "open" }),
    },
    {
      key: "warnsToday",
      label: "Warns Today",
      value: Number(counts?.warnsToday || 0),
      action: () => jumpToPanel?.("warns"),
    },
    {
      key: "raidAlerts",
      label: "Raid Alerts",
      value: Number(counts?.raidAlerts || 0),
      action: () => jumpToPanel?.("raids"),
    },
    {
      key: "fraudFlags",
      label: "Fraud Flags",
      value: Number(counts?.fraudFlags || 0),
      action: () => jumpToPanel?.("fraud"),
    },
    {
      key: "pendingVerification",
      label: "Pending Verification",
      value: Number(intelligence?.pendingVerification || 0),
      action: () => jumpToPanel?.("fraud"),
    },
    {
      key: "verifiedMembers",
      label: "Verified Members",
      value: Number(intelligence?.verifiedMembers || 0),
      action: null,
    },
  ];

  return (
    <>
      <div className="desktop-kpi-strip">
        {items.map((item) => {
          const card = (
            <>
              <span className="desktop-kpi-label">{item.label}</span>
              <span className="desktop-kpi-value">{item.value}</span>
            </>
          );

          if (item.action) {
            return (
              <button
                key={item.key}
                type="button"
                className="desktop-kpi-card clickable"
                onClick={item.action}
              >
                {card}
              </button>
            );
          }

          return (
            <div key={item.key} className="desktop-kpi-card">
              {card}
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
          border: 1px solid var(--panel-border, rgba(255, 255, 255, 0.08));
          background: var(--panel-bg-soft, rgba(255, 255, 255, 0.02));
          border-radius: 18px;
          padding: 14px;
          text-align: left;
          color: var(--text-strong, #f8fafc);
          display: grid;
          gap: 8px;
          min-height: 88px;
        }

        .desktop-kpi-card.clickable {
          cursor: pointer;
        }

        .desktop-kpi-label {
          font-size: 12px;
          color: var(--text-muted, rgba(255, 255, 255, 0.72));
          line-height: 1.25;
        }

        .desktop-kpi-value {
          font-size: 30px;
          font-weight: 900;
          line-height: 1;
          overflow-wrap: anywhere;
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

function DesktopPageShell({ title, subtitle, actions, children }) {
  return (
    <div className="desktop-page-shell card">
      <div className="desktop-page-head">
        <div className="desktop-page-copy">
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle ? (
            <div className="muted" style={{ marginTop: 6 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {actions ? <div className="desktop-page-actions">{actions}</div> : null}
      </div>

      <div className="desktop-page-body">{children}</div>

      <style jsx>{`
        .desktop-page-shell {
          padding: 18px;
        }

        .desktop-page-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .desktop-page-copy {
          min-width: 0;
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
    density === "compact" ? "14px" : density === "spacious" ? "24px" : "18px";

  const pagePadding =
    density === "compact" ? "14px" : density === "spacious" ? "22px" : "18px";

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
            {homeLayout
              .filter((key) => sectionVisibility[key] !== false)
              .map((key, index) => (
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
            title="Ticket Queue"
            subtitle="Live moderation queue with repair, transcript, and filtering controls"
            actions={
              <>
                <button
                  type="button"
                  className="button ghost"
                  style={{ width: "auto", minWidth: 120 }}
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPriorityFilter("all");
                  }}
                >
                  Clear Filters
                </button>

                <button
                  type="button"
                  className="button ghost"
                  style={{ width: "auto", minWidth: 120 }}
                  onClick={() =>
                    refresh({ force: true, reason: "manual-ticket-refresh" })
                  }
                >
                  Refresh Queue
                </button>

                <button
                  type="button"
                  className="button ghost"
                  style={{ width: "auto", minWidth: 140 }}
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
                  style={{ width: "auto", minWidth: 140 }}
                  disabled={isMaintaining}
                  onClick={handlePreviewPurge}
                >
                  {isMaintaining ? "Working..." : "Preview Purge"}
                </button>

                <button
                  type="button"
                  className="button danger"
                  style={{ width: "auto", minWidth: 140 }}
                  disabled={isMaintaining}
                  onClick={handlePurgeStale}
                >
                  {isMaintaining ? "Working..." : "Purge Stale"}
                </button>
              </>
            }
          >
            <div className="muted desktop-ticket-note">
              Reconcile repairs stale ticket rows that no longer reflect Discord
              truth. Purge removes dead closed or deleted rows that no longer have
              a usable live channel.
            </div>

            <div className="desktop-ticket-filter-grid">
              <input
                className="input"
                placeholder="Search tickets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="claimed">Claimed</option>
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

            <div>{filteredTickets}</div>
          </DesktopPageShell>
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="desktop-tab-section">
          <div className="desktop-members-grid">
            {membersLayout
              .filter((key) => sectionVisibility[key] !== false)
              .map((key, index) => (
                <div
                  key={`desktop-members-${key}`}
                  className={`desktop-grid-item desktop-members-item desktop-members-item-${index + 1}`}
                >
                  {membersSections[key] || null}
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {activeTab === "categories" ? (
        <section className="desktop-tab-section">
          {sectionVisibility.categories !== false ? (
            <DesktopPageShell
              title="Categories"
              subtitle="Channel grouping, structure control, and organization tools"
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
            line-height: 1.5;
          }

          .desktop-ticket-filter-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(180px, 1fr));
            gap: 10px;
            margin-bottom: 14px;
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
          .desktop-home-item-7 {
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
          .desktop-members-item-5 {
            grid-column: span 6;
          }

          :global(.desktop-page-shell.card) {
            padding: ${pagePadding};
          }
        }

        @media (min-width: 1024px) and (max-width: 1399px) {
          .desktop-ticket-filter-grid {
            grid-template-columns: repeat(2, minmax(220px, 1fr));
          }

          .desktop-home-item-2,
          .desktop-home-item-3,
          .desktop-home-item-4,
          .desktop-home-item-5,
          .desktop-home-item-6,
          .desktop-home-item-7 {
            grid-column: span 12;
          }

          .desktop-members-item-1,
          .desktop-members-item-2,
          .desktop-members-item-3,
          .desktop-members-item-4,
          .desktop-members-item-5 {
            grid-column: span 12;
          }
        }
      `}</style>
    </div>
  );
}
