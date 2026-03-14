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

function formatTime(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function timeAgo(value) {
  if (!value) return "—";

  try {
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) return "—";

    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
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

function getMemberDisplay(member) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.user_id ||
    "Unknown Member"
  );
}

function getTicketStatusCount(tickets, status) {
  return safeArray(tickets).filter(
    (t) => String(t?.status || "").toLowerCase() === status
  ).length;
}

function getSeverityColor(level) {
  const value = String(level || "").toLowerCase();

  if (value.includes("critical") || value.includes("high")) return "#f87171";
  if (value.includes("moderate") || value.includes("medium")) return "#fbbf24";
  return "#4ade80";
}

function buildModeratorIntelligence(data) {
  const counts = data?.counts || {};
  const tickets = safeArray(data?.tickets);
  const members = safeArray(data?.guildMembers || data?.members);
  const pendingVerification = Number(data?.memberCounts?.pendingVerification || 0);
  const verifiedMembers = Number(data?.memberCounts?.verified || 0);
  const formerMembers = Number(data?.memberCounts?.former || 0);
  const activeMembers = Number(data?.memberCounts?.active || 0);

  const openTickets = Number(counts?.openTickets || 0);
  const warnsToday = Number(counts?.warnsToday || 0);
  const raidAlerts = Number(counts?.raidAlerts || 0);
  const fraudFlags = Number(counts?.fraudFlags || 0);
  const claimedTickets = getTicketStatusCount(tickets, "claimed");

  let serverHealth = "Stable";
  if (fraudFlags >= 5 || raidAlerts >= 3 || openTickets >= 20) {
    serverHealth = "Elevated";
  }
  if (fraudFlags >= 10 || raidAlerts >= 5 || openTickets >= 35) {
    serverHealth = "Critical";
  }

  let raidRisk = "Low";
  if (raidAlerts >= 1 || formerMembers >= 10) {
    raidRisk = "Moderate";
  }
  if (raidAlerts >= 3) {
    raidRisk = "High";
  }

  let fraudRisk = "Low";
  if (fraudFlags >= 1 || pendingVerification >= 10) {
    fraudRisk = "Moderate";
  }
  if (fraudFlags >= 5) {
    fraudRisk = "High";
  }

  let ticketPressure = "Low";
  if (openTickets >= 8 || claimedTickets >= 5) {
    ticketPressure = "Moderate";
  }
  if (openTickets >= 16 || claimedTickets >= 10) {
    ticketPressure = "High";
  }

  let verificationPressure = "Low";
  if (pendingVerification >= 8) {
    verificationPressure = "Moderate";
  }
  if (pendingVerification >= 16) {
    verificationPressure = "High";
  }

  const verifiedRate =
    activeMembers > 0
      ? Math.round((verifiedMembers / activeMembers) * 100)
      : 0;

  const summaryItems = [
    {
      key: "health",
      label: "Server Health",
      value: serverHealth,
      tone: serverHealth,
    },
    {
      key: "raid",
      label: "Raid Risk",
      value: raidRisk,
      tone: raidRisk,
    },
    {
      key: "fraud",
      label: "Fraud Risk",
      value: fraudRisk,
      tone: fraudRisk,
    },
    {
      key: "tickets",
      label: "Ticket Pressure",
      value: ticketPressure,
      tone: ticketPressure,
    },
    {
      key: "verification",
      label: "Verification Queue",
      value: `${pendingVerification} pending`,
      tone: verificationPressure,
    },
    {
      key: "verified-rate",
      label: "Verified Rate",
      value: `${verifiedRate}%`,
      tone: verifiedRate >= 80 ? "Low" : verifiedRate >= 60 ? "Moderate" : "High",
    },
  ];

  return {
    serverHealth,
    raidRisk,
    fraudRisk,
    ticketPressure,
    verificationPressure,
    openTickets,
    warnsToday,
    raidAlerts,
    fraudFlags,
    pendingVerification,
    verifiedMembers,
    formerMembers,
    activeMembers,
    claimedTickets,
    summaryItems,
    flaggedMembers: members
      .filter((m) => String(m?.role_state || "").toLowerCase().includes("conflict"))
      .slice(0, 8),
  };
}

function DashboardSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
  actions = null,
  defaultOpen = false,
}) {
  const isOpen = expanded ?? defaultOpen;

  return (
    <div className="card compact-panel">
      <div
        className="panel-header"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: onToggle ? "pointer" : "default",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              className="muted"
              style={{ marginTop: 4, fontSize: 13 }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
          {onToggle ? (
            <span className="badge">
              {isOpen ? "Hide" : "Show"}
            </span>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <div style={{ marginTop: 14 }}>{children}</div>
      ) : null}
    </div>
  );
}

function ClickableStatCard({ title, value, onClick, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <StatCard title={title} value={value} />
      {subtitle ? (
        <div
          className="muted"
          style={{
            marginTop: 8,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </button>
  );
}

function IntelligencePanel({
  intelligence,
  expanded,
  onToggle,
  onJumpToTickets,
  onJumpToWarns,
  onJumpToRaids,
  onJumpToFraud,
}) {
  return (
    <DashboardSection
      title="Moderator Intelligence"
      subtitle="Live risk summary, moderation pressure, and queue health"
      expanded={expanded}
      onToggle={onToggle}
      defaultOpen
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {intelligence.summaryItems.map((item) => (
          <div
            key={item.key}
            className="member-detail-item"
            style={{
              border: `1px solid ${getSeverityColor(item.tone)}33`,
              background: `${getSeverityColor(item.tone)}10`,
            }}
          >
            <span className="ticket-info-label">{item.label}</span>
            <span
              style={{
                fontWeight: 800,
                color: getSeverityColor(item.tone),
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          className="button"
          style={{ width: "auto", minWidth: 150 }}
          onClick={onJumpToTickets}
        >
          Open Ticket Queue
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 130 }}
          onClick={onJumpToWarns}
        >
          Review Warns
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 130 }}
          onClick={onJumpToRaids}
        >
          Review Raids
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 130 }}
          onClick={onJumpToFraud}
        >
          Review Fraud
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Immediate Signals
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div>Open Tickets: {intelligence.openTickets}</div>
            <div>Claimed Tickets: {intelligence.claimedTickets}</div>
            <div>Warns Today: {intelligence.warnsToday}</div>
            <div>Raid Alerts: {intelligence.raidAlerts}</div>
            <div>Fraud Flags: {intelligence.fraudFlags}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Verification Pressure
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div>Pending Verification: {intelligence.pendingVerification}</div>
            <div>Verified Members: {intelligence.verifiedMembers}</div>
            <div>Former Members Tracked: {intelligence.formerMembers}</div>
            <div>Active Members: {intelligence.activeMembers}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Conflict Watch
          </div>

          {intelligence.flaggedMembers.length ? (
            <div
              className="muted"
              style={{ fontSize: 13, lineHeight: 1.6 }}
            >
              {intelligence.flaggedMembers.map((member) => (
                <div key={member.user_id}>
                  {getMemberDisplay(member)} — {safeText(member.role_state)}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              No role conflict members detected in the current payload.
            </div>
          )}
        </div>
      </div>
    </DashboardSection>
  );
}

function SimpleFeedPanel({
  title,
  rows,
  emptyMessage,
  renderRow,
}) {
  if (!rows.length) {
    return (
      <div className="empty-state">{emptyMessage}</div>
    );
  }

  return (
    <div className="space">
      {rows.map(renderRow)}
    </div>
  );
}

function DesktopTabBar({ activeTab, onChange }) {
  return (
    <div
      className="card"
      style={{
        padding: 12,
        marginBottom: 16,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {MOBILE_TABS.map((tab) => {
        const active = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            className={active ? "button" : "button ghost"}
            style={{ width: "auto", minWidth: 110 }}
            onClick={() => onChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        );
      })}
    </div>
  );
}

export default function DashboardClient({
  initialData,
  staffName,
}) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority_desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [expandedPanels, setExpandedPanels] = useState({
    intelligence: true,
    activity: true,
    warns: false,
    raids: false,
    fraud: false,
    joins: true,
    members: true,
    roles: false,
    staff: false,
  });

  const refreshTimer = useRef(null);

  const currentStaffId = useMemo(
    () => getStaffUserId(initialData, staffName),
    [initialData, staffName]
  );

  const togglePanel = useCallback((name) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  }, []);

  const openOnlyPanel = useCallback((name) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [name]: true,
    }));
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setIsRefreshing(true);

      setError("");

      try {
        const res = await fetch("/api/dashboard/live", {
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(
            json?.error || "Failed to refresh dashboard."
          );
        }

        setData(json);
      } catch (err) {
        setError(
          err?.message || "Failed to refresh dashboard."
        );
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    let supabase;
    let channel;

    function handleRealtimeChange() {
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
        err?.message || "Realtime client unavailable."
      );
    }

    return () => {
      clearTimeout(refreshTimer.current);

      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refresh]);

  const counts = data?.counts || {
    openTickets: 0,
    warnsToday: 0,
    raidAlerts: 0,
    fraudFlags: 0,
  };

  const safeEvents = safeArray(data?.events);
  const safeRoles = safeArray(data?.roles);
  const safeMetrics = safeArray(data?.metrics);
  const safeCategories = safeArray(data?.categories);
  const safeRecentJoins = safeArray(data?.recentJoins);
  const safeMembers = data?.guildMembers || data?.members || [];
  const safeTickets = safeArray(data?.tickets);
  const safeWarns = safeArray(data?.warns);
  const safeRaids = safeArray(data?.raids);
  const safeFraud = safeArray(data?.fraud || data?.fraudFlagsList);

  const intelligence = useMemo(
    () => buildModeratorIntelligence(data),
    [data]
  );

  const filteredTickets = useMemo(() => {
    let rows = [...safeTickets];

    if (search.trim()) {
      const q = search.toLowerCase();

      rows = rows.filter((t) =>
        [
          t.username,
          t.user_id,
          t.title,
          t.category,
          t.claimed_by,
          t.channel_id,
          t.discord_thread_id,
          t.closed_reason,
        ]
          .filter(Boolean)
          .some((v) =>
            String(v).toLowerCase().includes(q)
          )
      );
    }

    if (statusFilter !== "all") {
      rows = rows.filter(
        (t) =>
          String(t.status || "").toLowerCase() ===
          statusFilter
      );
    }

    if (priorityFilter !== "all") {
      rows = rows.filter(
        (t) =>
          String(t.priority || "").toLowerCase() ===
          priorityFilter
      );
    }

    return sortTickets(rows, sortBy);
  }, [
    safeTickets,
    search,
    statusFilter,
    priorityFilter,
    sortBy,
  ]);

  const homeSummary = useMemo(() => {
    return {
      recentEvents: safeEvents.slice(0, 5),
      recentWarns: safeWarns.slice(0, 8),
      recentRaids: safeRaids.slice(0, 8),
      recentFraud: safeFraud.slice(0, 8),
    };
  }, [safeEvents, safeWarns, safeRaids, safeFraud]);

  const jumpToTickets = useCallback(
    ({ status = "all", priority = "all", query = "" } = {}) => {
      setActiveTab("tickets");
      setStatusFilter(status);
      setPriorityFilter(priority);
      if (typeof query === "string") {
        setSearch(query);
      }
    },
    []
  );

  const jumpToPanel = useCallback(
    (panelName) => {
      setActiveTab("home");
      openOnlyPanel(panelName);
    },
    [openOnlyPanel]
  );

  return (
    <>
      <Topbar />

      <div
        style={{
          paddingBottom: 96,
        }}
      >
        <div className="desktop-only-nav">
          <DesktopTabBar
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {error ? (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        {isRefreshing ? (
          <div
            className="info-banner"
            style={{ marginBottom: 16 }}
          >
            Refreshing dashboard…
          </div>
        ) : null}

        {/* HOME */}
        <section
          className={`mobile-tab-panel ${
            activeTab === "home" ? "active" : ""
          }`}
        >
          <div className="dashboard-home-grid">
            <IntelligencePanel
              intelligence={intelligence}
              expanded={expandedPanels.intelligence}
              onToggle={() => togglePanel("intelligence")}
              onJumpToTickets={() =>
                jumpToTickets({ status: "open" })
              }
              onJumpToWarns={() => jumpToPanel("warns")}
              onJumpToRaids={() => jumpToPanel("raids")}
              onJumpToFraud={() => jumpToPanel("fraud")}
            />

            <div className="metrics-grid">
              <ClickableStatCard
                title="Open Tickets"
                value={counts.openTickets}
                subtitle="Tap to open queue"
                onClick={() =>
                  jumpToTickets({ status: "open" })
                }
              />

              <ClickableStatCard
                title="Warns Today"
                value={counts.warnsToday}
                subtitle="Tap to review warnings"
                onClick={() => jumpToPanel("warns")}
              />

              <ClickableStatCard
                title="Raid Alerts"
                value={counts.raidAlerts}
                subtitle="Tap to review raids"
                onClick={() => jumpToPanel("raids")}
              />

              <ClickableStatCard
                title="Fraud Flags"
                value={counts.fraudFlags}
                subtitle="Tap to review fraud"
                onClick={() => jumpToPanel("fraud")}
              />
            </div>

            <QuickActions
              onRefresh={refresh}
              currentStaffId={currentStaffId}
            />

            <DashboardSection
              title="Activity Feed"
              subtitle={`${safeEvents.length} recent audit events loaded`}
              expanded={expandedPanels.activity}
              onToggle={() => togglePanel("activity")}
            >
              <AuditTimeline events={safeEvents} />
            </DashboardSection>

            <DashboardSection
              title="Warn Intelligence"
              subtitle="Warnings detected in the current dashboard payload"
              expanded={expandedPanels.warns}
              onToggle={() => togglePanel("warns")}
              actions={
                <button
                  type="button"
                  className="button ghost"
                  style={{ width: "auto", minWidth: 120 }}
                  onClick={() => jumpToTickets({ status: "open" })}
                >
                  Open Tickets
                </button>
              }
            >
              <SimpleFeedPanel
                title="Warns"
                rows={homeSummary.recentWarns}
                emptyMessage="No warn details are available in the current API payload yet. The counter is live, but warn row details still need to be returned from the route."
                renderRow={(warn, index) => (
                  <div
                    key={warn?.id || `warn-${index}`}
                    className="card"
                    style={{ padding: 14 }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {safeText(warn?.username, "Unknown user")}
                    </div>
                    <div
                      className="muted"
                      style={{ marginTop: 6, fontSize: 13 }}
                    >
                      {safeText(warn?.reason, "No reason provided")}
                    </div>
                    <div
                      className="muted"
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      {formatTime(warn?.created_at)}
                    </div>
                  </div>
                )}
              />
            </DashboardSection>

            <DashboardSection
              title="Raid Intelligence"
              subtitle="Recent raid detections and join pressure"
              expanded={expandedPanels.raids}
              onToggle={() => togglePanel("raids")}
            >
              <SimpleFeedPanel
                title="Raids"
                rows={homeSummary.recentRaids}
                emptyMessage="No raid detail rows are available in the current API payload yet. The counter is live, but raid row details still need to be returned from the route."
                renderRow={(raid, index) => (
                  <div
                    key={raid?.id || `raid-${index}`}
                    className="card"
                    style={{ padding: 14 }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {safeText(raid?.summary, "Raid event")}
                    </div>
                    <div
                      className="muted"
                      style={{ marginTop: 6, fontSize: 13 }}
                    >
                      Join count: {safeText(raid?.join_count, "—")} • Window:{" "}
                      {safeText(raid?.window_seconds, "—")}s • Severity:{" "}
                      {safeText(raid?.severity, "unknown")}
                    </div>
                    <div
                      className="muted"
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      {formatTime(raid?.created_at)}
                    </div>
                  </div>
                )}
              />
            </DashboardSection>

            <DashboardSection
              title="Fraud Intelligence"
              subtitle="Suspicious verification and conflict signals"
              expanded={expandedPanels.fraud}
              onToggle={() => togglePanel("fraud")}
            >
              {homeSummary.recentFraud.length ? (
                <SimpleFeedPanel
                  title="Fraud"
                  rows={homeSummary.recentFraud}
                  emptyMessage="No fraud items."
                  renderRow={(fraud, index) => (
                    <div
                      key={fraud?.id || `fraud-${index}`}
                      className="card"
                      style={{ padding: 14 }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {safeText(fraud?.username, "Suspicious member")}
                      </div>
                      <div
                        className="muted"
                        style={{ marginTop: 6, fontSize: 13 }}
                      >
                        Score: {safeText(fraud?.score, "0")} • Flagged:{" "}
                        {String(Boolean(fraud?.flagged))}
                      </div>

                      {Array.isArray(fraud?.reasons) && fraud.reasons.length ? (
                        <div
                          className="muted"
                          style={{ marginTop: 8, fontSize: 12 }}
                        >
                          {fraud.reasons.join(" • ")}
                        </div>
                      ) : null}
                    </div>
                  )}
                />
              ) : (
                <div className="space">
                  {intelligence.flaggedMembers.length ? (
                    intelligence.flaggedMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="card"
                        style={{ padding: 14 }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {getMemberDisplay(member)}
                        </div>
                        <div
                          className="muted"
                          style={{ marginTop: 6, fontSize: 13 }}
                        >
                          Role state: {safeText(member?.role_state)}
                        </div>
                        <div
                          className="muted"
                          style={{ marginTop: 6, fontSize: 12 }}
                        >
                          {safeText(
                            member?.role_state_reason,
                            "Role conflict detected"
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      No fraud detail rows are available in the current API payload yet. The counter is live, and conflict members are also clear right now.
                    </div>
                  )}
                </div>
              )}
            </DashboardSection>
          </div>
        </section>

        {/* TICKETS */}
        <section
          className={`mobile-tab-panel ${
            activeTab === "tickets" ? "active" : ""
          }`}
        >
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
                <div
                  className="muted"
                  style={{ marginTop: 6 }}
                >
                  Interactive queue with transcript-ready controls and moderator filters
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
                  onClick={() => refresh()}
                >
                  Refresh Queue
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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

            <TicketQueueTable
              tickets={filteredTickets}
              currentStaffId={currentStaffId}
              onRefresh={refresh}
            />
          </div>
        </section>

        {/* MEMBERS */}
        <section
          className={`mobile-tab-panel ${
            activeTab === "members" ? "active" : ""
          }`}
        >
          <div className="dashboard-members-grid">
            <DashboardSection
              title="Fresh Entrants"
              subtitle={`${safeRecentJoins.length} tracked joins in the current response`}
              expanded={expandedPanels.joins}
              onToggle={() => togglePanel("joins")}
            >
              <RecentJoinsCard joins={safeRecentJoins} />
            </DashboardSection>

            <DashboardSection
              title="Member Snapshot"
              subtitle={`${safeMembers.length} member rows loaded`}
              expanded={expandedPanels.members}
              onToggle={() => togglePanel("members")}
            >
              <MemberSnapshot members={safeMembers} />
            </DashboardSection>

            <DashboardSection
              title="Role Hierarchy"
              subtitle={`${safeRoles.length} roles loaded`}
              expanded={expandedPanels.roles}
              onToggle={() => togglePanel("roles")}
            >
              <RoleHierarchyCard
                roles={safeRoles}
                members={safeMembers}
                staffUserId={currentStaffId}
                refreshDashboardData={refresh}
              />
            </DashboardSection>

            <DashboardSection
              title="Staff Metrics"
              subtitle={`${safeMetrics.length} staff records loaded`}
              expanded={expandedPanels.staff}
              onToggle={() => togglePanel("staff")}
            >
              <StaffMetricsCard metrics={safeMetrics} />
            </DashboardSection>

            <div className="card">
              <MemberSearchCard />
            </div>
          </div>
        </section>

        {/* CATEGORIES */}
        <section
          className={`mobile-tab-panel ${
            activeTab === "categories" ? "active" : ""
          }`}
        >
          <div className="card">
            <CategoryManager
              categories={safeCategories}
              onRefresh={refresh}
            />
          </div>
        </section>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={MOBILE_TABS}
      />

      <style jsx>{`
        .desktop-only-nav {
          display: none;
        }

        .dashboard-home-grid,
        .dashboard-members-grid {
          display: grid;
          gap: 16px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        @media (min-width: 768px) {
          .metrics-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .desktop-only-nav {
            display: block;
          }

          .dashboard-home-grid,
          .dashboard-members-grid {
            gap: 18px;
          }
        }
      `}</style>
    </>
  );
}
