"use client";

export default function DesktopDashboardView({
  activeTab,
  counts,
  safeEvents,
  safeWarns,
  safeRaids,
  safeFraud,
  safeCategories,
  safeRecentJoins,
  safeMembers,
  safeMetrics,
  safeRoles,
  intelligence,
  expandedPanels,
  togglePanel,
  jumpToTickets,
  jumpToPanel,
  refresh,
  currentStaffId,
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
}) {
  if (typeof window !== "undefined" && window.innerWidth < 1024) {
    return null;
  }

  return (
    <div className="desktop-dashboard-shell">
      {activeTab === "home" ? (
        <section className="desktop-tab-section">
          <div className="desktop-home-grid">
            {homeLayout
              .filter((key) => sectionVisibility[key] !== false)
              .map((key) => (
                <div key={`desktop-home-${key}`} className="desktop-grid-item">
                  {homeSections[key] || null}
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {activeTab === "tickets" ? (
        <section className="desktop-tab-section">
          <div className="card">
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
              <div>
                <h2 style={{ margin: 0 }}>Ticket Queue</h2>
                <div className="muted" style={{ marginTop: 6 }}>
                  Live moderation queue with repair, transcript, and filtering controls
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
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
                  onClick={() => refresh({ force: true, reason: "manual-ticket-refresh" })}
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
              </div>
            </div>

            <div
              className="muted"
              style={{
                marginBottom: 14,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Reconcile repairs stale ticket rows that no longer reflect Discord truth.
              Purge removes dead closed or deleted rows that no longer have a usable live channel.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
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
          </div>
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="desktop-tab-section">
          <div className="desktop-members-grid">
            {membersLayout
              .filter((key) => sectionVisibility[key] !== false)
              .map((key) => (
                <div key={`desktop-members-${key}`} className="desktop-grid-item">
                  {membersSections[key] || null}
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {activeTab === "categories" ? (
        <section className="desktop-tab-section">
          {sectionVisibility.categories !== false ? (
            <div className="card">{safeCategories}</div>
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

          .desktop-home-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: 18px;
            align-items: start;
          }

          .desktop-home-grid > .desktop-grid-item:nth-child(1) {
            grid-column: span 12;
          }

          .desktop-home-grid > .desktop-grid-item:nth-child(2) {
            grid-column: span 12;
          }

          .desktop-home-grid > .desktop-grid-item:nth-child(3) {
            grid-column: span 12;
          }

          .desktop-home-grid > .desktop-grid-item:nth-child(4),
          .desktop-home-grid > .desktop-grid-item:nth-child(5),
          .desktop-home-grid > .desktop-grid-item:nth-child(6),
          .desktop-home-grid > .desktop-grid-item:nth-child(7) {
            grid-column: span 6;
          }

          .desktop-members-grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: 18px;
            align-items: start;
          }

          .desktop-members-grid > .desktop-grid-item:nth-child(1),
          .desktop-members-grid > .desktop-grid-item:nth-child(2) {
            grid-column: span 6;
          }

          .desktop-members-grid > .desktop-grid-item:nth-child(3),
          .desktop-members-grid > .desktop-grid-item:nth-child(4),
          .desktop-members-grid > .desktop-grid-item:nth-child(5) {
            grid-column: span 4;
          }
        }
      `}</style>
    </div>
  );
}
