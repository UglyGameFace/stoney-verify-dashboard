"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { sortTickets } from "@/lib/priority";
import Topbar from "@/components/Topbar";
import StatCard from "@/components/StatCard";
import QuickActions from "@/components/QuickActions";
import AuditTimeline from "@/components/AuditTimeline";
import RoleHierarchyCard from "@/components/RoleHierarchyCard";
import StaffMetricsCard from "@/components/StaffMetricsCard";
import MemberSearchCard from "@/components/MemberSearchCard";
import TicketQueueTable from "@/components/TicketQueueTable";
import CategoryManager from "@/components/CategoryManager";
import MobileBottomNav from "@/components/MobileBottomNav";
import RecentJoinsCard from "@/components/RecentJoinsCard";
import MemberSnapshot from "@/components/dashboard/MemberSnapshot";

const MOBILE_TABS = ["home", "tickets", "members", "categories"];

function formatMemberName(member) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.user_id ||
    "Unknown Member"
  );
}

function formatTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function getStaffUserId(initialData, staffName) {
  const possible =
    initialData?.staffUserId ||
    initialData?.staff_user_id ||
    initialData?.viewer?.user_id ||
    initialData?.viewer?.id ||
    initialData?.auth?.user_id ||
    initialData?.auth?.id ||
    null;

  if (possible) return String(possible);

  const metrics = Array.isArray(initialData?.metrics) ? initialData.metrics : [];
  const matchedMetric = metrics.find((m) => {
    const metricName = String(m?.staff_name || "").trim().toLowerCase();
    return metricName && metricName === String(staffName || "").trim().toLowerCase();
  });

  if (matchedMetric?.staff_id) {
    return String(matchedMetric.staff_id);
  }

  return null;
}

export default function DashboardClient({ initialData, staffName }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority_desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  const currentStaffId = useMemo(
    () => getStaffUserId(initialData, staffName),
    [initialData, staffName]
  );

  async function refresh({ silent = false } = {}) {
    if (!silent) setIsRefreshing(true);
    setError("");

    try {
      const res = await fetch("/api/dashboard/live", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to refresh dashboard.");
      }

      setData(json);
    } catch (err) {
      setError(err?.message || "Failed to refresh dashboard.");
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }

  useEffect(() => {
    let supabase;
    let channel;

    async function handleRealtimeChange() {
      await refresh({ silent: true });
    }

    try {
      supabase = getBrowserSupabase();

      channel = supabase
        .channel("dashboard-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_messages" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_notes" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_categories" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "audit_events" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "member_joins" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "guild_members" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "guild_roles" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "raid_events" },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bot_commands" },
          handleRealtimeChange
        )
        .subscribe((status) => {
          console.log("dashboard realtime status:", status);
          if (status === "SUBSCRIBED") {
            refresh({ silent: true });
          }
        });
    } catch (err) {
      setError(err?.message || "Realtime client unavailable.");
      return;
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const filteredTickets = useMemo(() => {
    let rows = [...(data?.tickets || [])];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((t) =>
        [
          t.username,
          t.user_id,
          t.title,
          t.category,
          t.mod_suggestion,
          t.claimed_by,
          t.channel_name,
          t.discord_thread_id,
          t.channel_id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      rows = rows.filter((t) => String(t.status || "").toLowerCase() === statusFilter);
    }

    if (priorityFilter !== "all") {
      rows = rows.filter(
        (t) => String(t.priority || "").toLowerCase() === priorityFilter
      );
    }

    return sortTickets(rows, sortBy);
  }, [data?.tickets, search, statusFilter, priorityFilter, sortBy]);

  const counts = data?.counts || {
    openTickets: 0,
    warnsToday: 0,
    raidAlerts: 0,
    fraudFlags: 0,
  };

  const safeEvents = data?.events || [];
  const safeRoles = data?.roles || [];
  const safeMetrics = data?.metrics || [];
  const safeCategories = data?.categories || [];
  const safeRecentJoins = data?.recentJoins || [];
  const safeRecentActiveMembers = data?.recentActiveMembers || [];
  const safeRecentFormerMembers = data?.recentFormerMembers || [];

  const allMemberRows =
    data?.guildMembers ||
    data?.members ||
    data?.memberRows ||
    safeRecentJoins ||
    [];

  const memberCounts = data?.memberCounts || {
    tracked: allMemberRows.length,
    active: allMemberRows.filter((m) => m.in_guild !== false).length,
    former: allMemberRows.filter((m) => m.in_guild === false).length,
    pendingVerification: allMemberRows.filter((m) => m.has_unverified).length,
    verified: allMemberRows.filter((m) => m.has_verified_role).length,
    staff: allMemberRows.filter((m) => m.has_staff_role).length,
  };

  const memberSummary = useMemo(() => {
    const rows = allMemberRows;
    const total = memberCounts.tracked;
    const inServer = memberCounts.active;
    const leftServer = memberCounts.former;
    const verified = memberCounts.verified;
    const pending = memberCounts.pendingVerification;
    const staff = memberCounts.staff;

    return { total, inServer, leftServer, verified, pending, staff, rows };
  }, [allMemberRows, memberCounts]);

  const memberPulse = useMemo(() => {
    const activePreview = safeRecentActiveMembers.slice(0, 5);
    const formerPreview = safeRecentFormerMembers.slice(0, 5);

    return {
      activePreview,
      formerPreview,
    };
  }, [safeRecentActiveMembers, safeRecentFormerMembers]);

  function isActiveTab(tab) {
    return activeTab === tab;
  }

  return (
    <>
      <Topbar />

      {error ? (
        <div className="error-banner stoner-banner" style={{ marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      <section
        className={`mobile-tab-panel ${isActiveTab("home") ? "active" : ""}`}
        id="overview"
      >
        <section className="hero">
          <div className="card stoner-hero-card compact-hero">
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div className="muted">Control Deck</div>

              <button
                className="button ghost"
                type="button"
                onClick={() => refresh()}
                disabled={isRefreshing}
                style={{ width: "auto", minWidth: 110 }}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <h2 style={{ marginTop: 0 }}>
              Run tickets, verification, joins, and role sync from one cleaner lounge
            </h2>

            <p className="muted" style={{ marginBottom: 0 }}>
              Live staff controls, greener visuals, tighter member tracking, and less mobile clutter.
            </p>
          </div>

          <QuickActions onRefresh={refresh} currentStaffId={currentStaffId} />
        </section>

        <section className="metrics">
          <StatCard
            title="Open Tickets"
            value={counts.openTickets}
            subtitle="Current queue in rotation"
          />
          <StatCard
            title="Warns Today"
            value={counts.warnsToday}
            subtitle="Spam and scam enforcement"
          />
          <StatCard
            title="Raid Alerts"
            value={counts.raidAlerts}
            subtitle="Join spike detections"
          />
          <StatCard
            title="Fraud Flags"
            value={counts.fraudFlags}
            subtitle="Manual verification review"
          />
        </section>

        <section className="grid-2">
          <AuditTimeline events={safeEvents} />

          <div className="space">
            <div className="card stoner-status-card">
              <h2 style={{ marginTop: 0 }}>Session Pulse</h2>

              <div className="space">
                <div className="row">
                  <span className="status-dot" />
                  <span>Realtime subscriptions active</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>Authenticated identity: {staffName}</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>Queue and panels update without full reloads</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>Current sync state: {isRefreshing ? "Refreshing..." : "Idle"}</span>
                </div>
              </div>
            </div>

            <MemberSnapshot members={allMemberRows} />
          </div>
        </section>
      </section>

      <section
        className={`mobile-tab-panel ${isActiveTab("tickets") ? "active" : ""}`}
        id="tickets"
      >
        <div className="card" style={{ marginBottom: 18 }}>
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
            <h2 style={{ margin: 0 }}>Ticket Queue</h2>
            <div className="muted" style={{ fontSize: 14 }}>
              {filteredTickets.length} result{filteredTickets.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="filters">
            <input
              className="input"
              placeholder="Search user, title, category, suggestion, channel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="select"
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
              className="select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="priority_desc">Priority</option>
              <option value="updated_desc">Updated desc</option>
              <option value="updated_asc">Updated asc</option>
              <option value="created_desc">Created desc</option>
              <option value="created_asc">Created asc</option>
            </select>
          </div>
        </div>

        <TicketQueueTable
          tickets={filteredTickets}
          currentStaffId={currentStaffId}
          onRefresh={refresh}
        />
      </section>

      <section
        className={`mobile-tab-panel ${isActiveTab("members") ? "active" : ""}`}
        id="members"
      >
        <section className="grid-2 members-top-grid" style={{ marginBottom: 18 }}>
          <RecentJoinsCard joins={safeRecentJoins} />
          <MemberSearchCard />
        </section>

        <section className="grid-2" style={{ marginBottom: 18 }}>
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
              <h2 style={{ margin: 0 }}>Member Control Snapshot</h2>
              <div className="member-search-summary">
                <span className="badge">{memberCounts.tracked} tracked</span>
                <span className="badge claimed">{memberCounts.active} active</span>
                <span className="badge closed">{memberCounts.former} former</span>
              </div>
            </div>

            <div className="member-detail-grid">
              <div className="member-detail-item">
                <span className="ticket-info-label">Pending Verify</span>
                <span>{memberCounts.pendingVerification}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Verified</span>
                <span>{memberCounts.verified}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Staff</span>
                <span>{memberCounts.staff}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Recent Active</span>
                <span>{safeRecentActiveMembers.length}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Recent Former</span>
                <span>{safeRecentFormerMembers.length}</span>
              </div>

              <div className="member-detail-item">
                <span className="ticket-info-label">Realtime Sync</span>
                <span>{isRefreshing ? "Refreshing..." : "Live"}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Former Member Watch</h2>

            {memberPulse.formerPreview.length ? (
              <div className="space">
                {memberPulse.formerPreview.map((member) => (
                  <div
                    key={member.user_id}
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-strong)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {formatMemberName(member)}
                      </div>
                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {member.user_id}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 92 }}>
                      <div className="badge closed">Former</div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        {formatTime(member.updated_at || member.synced_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No former members in the current recent snapshot.
              </div>
            )}
          </div>
        </section>

        <section className="grid-2 members-bottom-grid">
          <RoleHierarchyCard
            roles={safeRoles}
            members={allMemberRows}
            staffUserId={currentStaffId}
            refreshDashboardData={refresh}
          />
          <StaffMetricsCard metrics={safeMetrics} />
        </section>
      </section>

      <section
        className={`mobile-tab-panel ${isActiveTab("categories") ? "active" : ""}`}
        id="categories"
      >
        <section className="grid-2">
          <CategoryManager categories={safeCategories} onRefresh={refresh} />

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Flow Notes</h2>
            <div className="space">
              <div className="info-banner stoner-banner">
                Keep category flow tight so staff can handle issues fast without
                bouncing back into Discord for every small step.
              </div>

              <div className="space">
                <div className="row">
                  <span className="status-dot" />
                  <span>Verification flow should stay simple and green-lit</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>Appeals and fraud review should stay clearly separated</span>
                </div>

                <div className="row">
                  <span className="status-dot" />
                  <span>High-priority queue items should stay obvious on desktop and mobile</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      <MobileBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={MOBILE_TABS}
      />
    </>
  );
}
