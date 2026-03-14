"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";

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

/* ------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------ */

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

  const metrics = Array.isArray(initialData?.metrics)
    ? initialData.metrics
    : [];

  const matchedMetric = metrics.find((m) => {
    const metricName = String(m?.staff_name || "")
      .trim()
      .toLowerCase();

    return (
      metricName &&
      metricName ===
        String(staffName || "")
          .trim()
          .toLowerCase()
    );
  });

  if (matchedMetric?.staff_id) {
    return String(matchedMetric.staff_id);
  }

  return null;
}

/* ------------------------------------------------ */
/* Dashboard */
/* ------------------------------------------------ */

export default function DashboardClient({
  initialData,
  staffName,
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [priorityFilter, setPriorityFilter] =
    useState("all");

  const [sortBy, setSortBy] =
    useState("priority_desc");

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("home");

  const [expandedPanels, setExpandedPanels] =
    useState({});

  const refreshTimer = useRef(null);

  const currentStaffId = useMemo(
    () => getStaffUserId(initialData, staffName),
    [initialData, staffName]
  );

  /* ------------------------------------------------ */
  /* Expandable panels */
  /* ------------------------------------------------ */

  const togglePanel = (name) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  /* ------------------------------------------------ */
  /* Refresh */
  /* ------------------------------------------------ */

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setIsRefreshing(true);

      setError("");

      try {
        const res = await fetch(
          "/api/dashboard/live",
          { cache: "no-store" }
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(
            json.error ||
              "Failed to refresh dashboard."
          );
        }

        setData(json);
      } catch (err) {
        setError(
          err?.message ||
            "Failed to refresh dashboard."
        );
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    []
  );

  /* ------------------------------------------------ */
  /* Realtime subscription (throttled) */
  /* ------------------------------------------------ */

  useEffect(() => {
    let supabase;
    let channel;

    async function handleRealtimeChange() {
      clearTimeout(refreshTimer.current);

      refreshTimer.current = setTimeout(() => {
        refresh({ silent: true });
      }, 600);
    }

    try {
      supabase = getBrowserSupabase();

      channel = supabase
        .channel("dashboard-live")

        .on(
          "postgres_changes",
          { event: "*", schema: "public" },
          handleRealtimeChange
        )

        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            refresh({ silent: true });
          }
        });
    } catch (err) {
      setError(
        err?.message ||
          "Realtime client unavailable."
      );
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refresh]);

  /* ------------------------------------------------ */
  /* Data safety */
  /* ------------------------------------------------ */

  const counts = data?.counts || {
    openTickets: 0,
    warnsToday: 0,
    raidAlerts: 0,
    fraudFlags: 0,
  };

  const safeEvents =
    Array.isArray(data?.events)
      ? data.events
      : [];

  const safeRoles =
    Array.isArray(data?.roles)
      ? data.roles
      : [];

  const safeMetrics =
    Array.isArray(data?.metrics)
      ? data.metrics
      : [];

  const safeCategories =
    Array.isArray(data?.categories)
      ? data.categories
      : [];

  const safeRecentJoins =
    Array.isArray(data?.recentJoins)
      ? data.recentJoins
      : [];

  const safeMembers =
    data?.guildMembers ||
    data?.members ||
    [];

  /* ------------------------------------------------ */
  /* Ticket filtering */
  /* ------------------------------------------------ */

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
        ]
          .filter(Boolean)
          .some((v) =>
            String(v)
              .toLowerCase()
              .includes(q)
          )
      );
    }

    if (statusFilter !== "all") {
      rows = rows.filter(
        (t) =>
          String(t.status || "")
            .toLowerCase() === statusFilter
      );
    }

    if (priorityFilter !== "all") {
      rows = rows.filter(
        (t) =>
          String(t.priority || "")
            .toLowerCase() ===
          priorityFilter
      );
    }

    return sortTickets(rows, sortBy);
  }, [
    data?.tickets,
    search,
    statusFilter,
    priorityFilter,
    sortBy,
  ]);

  /* ------------------------------------------------ */
  /* UI helpers */
  /* ------------------------------------------------ */

  function isActiveTab(tab) {
    return activeTab === tab;
  }

  /* ------------------------------------------------ */
  /* Render */
  /* ------------------------------------------------ */

  return (
    <>
      <Topbar />

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* ---------------- HOME ---------------- */}

      <section
        className={`mobile-tab-panel ${
          isActiveTab("home") ? "active" : ""
        }`}
      >
        <section className="metrics">
          <StatCard
            title="Open Tickets"
            value={counts.openTickets}
          />
          <StatCard
            title="Warns Today"
            value={counts.warnsToday}
          />
          <StatCard
            title="Raid Alerts"
            value={counts.raidAlerts}
          />
          <StatCard
            title="Fraud Flags"
            value={counts.fraudFlags}
          />
        </section>

        {/* Expandable audit timeline */}

        <div className="card compact-panel">
          <div
            className="panel-header"
            onClick={() =>
              togglePanel("audit")
            }
          >
            Audit Timeline
          </div>

          {expandedPanels.audit && (
            <AuditTimeline
              events={safeEvents}
            />
          )}
        </div>
      </section>

      {/* ---------------- TICKETS ---------------- */}

      <section
        className={`mobile-tab-panel ${
          isActiveTab("tickets")
            ? "active"
            : ""
        }`}
      >
        <div className="card">
          <h2>Ticket Queue</h2>

          <input
            className="input"
            placeholder="Search tickets"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <TicketQueueTable
            tickets={filteredTickets}
            currentStaffId={currentStaffId}
            onRefresh={refresh}
          />
        </div>
      </section>

      {/* ---------------- MEMBERS ---------------- */}

      <section
        className={`mobile-tab-panel ${
          isActiveTab("members")
            ? "active"
            : ""
        }`}
      >
        <div className="card compact-panel">
          <div
            className="panel-header"
            onClick={() =>
              togglePanel("joins")
            }
          >
            Recent Joins
          </div>

          {expandedPanels.joins && (
            <RecentJoinsCard
              joins={safeRecentJoins}
            />
          )}
        </div>

        <div className="card compact-panel">
          <div
            className="panel-header"
            onClick={() =>
              togglePanel("members")
            }
          >
            Member Snapshot
          </div>

          {expandedPanels.members && (
            <MemberSnapshot
              members={safeMembers}
            />
          )}
        </div>

        <div className="card compact-panel">
          <div
            className="panel-header"
            onClick={() =>
              togglePanel("roles")
            }
          >
            Role Hierarchy
          </div>

          {expandedPanels.roles && (
            <RoleHierarchyCard
              roles={safeRoles}
              members={safeMembers}
              staffUserId={currentStaffId}
              refreshDashboardData={
                refresh
              }
            />
          )}
        </div>

        <div className="card compact-panel">
          <div
            className="panel-header"
            onClick={() =>
              togglePanel("staff")
            }
          >
            Staff Metrics
          </div>

          {expandedPanels.staff && (
            <StaffMetricsCard
              metrics={safeMetrics}
            />
          )}
        </div>

        <MemberSearchCard />
      </section>

      {/* ---------------- CATEGORIES ---------------- */}

      <section
        className={`mobile-tab-panel ${
          isActiveTab("categories")
            ? "active"
            : ""
        }`}
      >
        <CategoryManager
          categories={safeCategories}
          onRefresh={refresh}
        />
      </section>

      {/* Bottom nav */}

      <MobileBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={MOBILE_TABS}
      />
    </>
  );
}
