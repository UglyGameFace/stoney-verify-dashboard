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
import {
  reconcileTicketsAction,
  purgeStaleTicketsAction,
} from "@/lib/dashboardActions";
import { useDashboardPreferences } from "@/lib/useDashboardPreferences";

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
import DashboardSettingsPanel from "@/components/dashboard/DashboardSettingsPanel";
import DesktopDashboardView from "@/components/dashboard/DesktopDashboardView";

const MOBILE_TABS = ["home", "tickets", "members", "categories"];
const STALE_VISIBLE_REFRESH_MS = 20_000;
const BACKUP_REFRESH_INTERVAL_MS = 45_000;

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
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (seconds < 15) return "just now";
    if (minutes < 1) return `${seconds}s ago`;
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

  if (value.includes("critical") || value.includes("high")) {
    return "var(--tone-danger, #f87171)";
  }
  if (value.includes("moderate") || value.includes("medium")) {
    return "var(--tone-warn, #fbbf24)";
  }
  return "var(--tone-success, #4ade80)";
}

function getPanelToneClass(level) {
  const value = String(level || "").toLowerCase();
  if (value.includes("critical") || value.includes("high")) return "danger";
  if (value.includes("moderate") || value.includes("medium")) return "warn";
  return "ok";
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
  if (fraudFlags >= 4 || raidAlerts >= 2 || openTickets >= 14) {
    serverHealth = "Elevated";
  }
  if (fraudFlags >= 8 || raidAlerts >= 4 || openTickets >= 24) {
    serverHealth = "Critical";
  }

  let raidRisk = "Low";
  if (raidAlerts >= 1) {
    raidRisk = "Moderate";
  }
  if (raidAlerts >= 3) {
    raidRisk = "High";
  }

  let fraudRisk = "Low";
  if (fraudFlags >= 1 || pendingVerification >= 12) {
    fraudRisk = "Moderate";
  }
  if (fraudFlags >= 5) {
    fraudRisk = "High";
  }

  let ticketPressure = "Low";
  if (openTickets >= 6 || claimedTickets >= 4) {
    ticketPressure = "Moderate";
  }
  if (openTickets >= 14 || claimedTickets >= 8) {
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
      .filter((m) =>
        String(m?.role_state || "").toLowerCase().includes("conflict")
      )
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

      {isOpen ? <div style={{ marginTop: 14 }}>{children}</div> : null}
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
      subtitle="Live risk summary, moderation load, and verification pressure"
      expanded={expanded}
      onToggle={onToggle}
      defaultOpen
    >
      <div className="intelligence-grid">
        {intelligence.summaryItems.map((item) => (
          <div
            key={item.key}
            className={`intel-tile ${getPanelToneClass(item.tone)}`}
          >
            <span className="ticket-info-label">{item.label}</span>
            <span
              className="intel-value"
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

      <div className="detail-grid-3">
        <div className="card compact-detail-card">
          <div className="detail-card-title">Immediate Signals</div>
          <div className="muted detail-list">
            <div>Open Tickets: {intelligence.openTickets}</div>
            <div>Claimed Tickets: {intelligence.claimedTickets}</div>
            <div>Warns Today: {intelligence.warnsToday}</div>
            <div>Raid Alerts: {intelligence.raidAlerts}</div>
            <div>Fraud Flags: {intelligence.fraudFlags}</div>
          </div>
        </div>

        <div className="card compact-detail-card">
          <div className="detail-card-title">Verification Pressure</div>
          <div className="muted detail-list">
            <div>Pending Verification: {intelligence.pendingVerification}</div>
            <div>Verified Members: {intelligence.verifiedMembers}</div>
            <div>Former Members Tracked: {intelligence.formerMembers}</div>
            <div>Active Members: {intelligence.activeMembers}</div>
          </div>
        </div>

        <div className="card compact-detail-card">
          <div className="detail-card-title">Conflict Watch</div>

          {intelligence.flaggedMembers.length ? (
            <div className="muted detail-list">
              {intelligence.flaggedMembers.map((member) => (
                <div key={member.user_id}>
                  {getMemberDisplay(member)} — {safeText(member.role_state)}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted detail-list">
              No role conflicts are present in the current dataset.
            </div>
          )}
        </div>
      </div>
    </DashboardSection>
  );
}

function SimpleFeedPanel({ rows, emptyMessage, renderRow }) {
  if (!rows.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return <div className="space">{rows.map(renderRow)}</div>;
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
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceError, setMaintenanceError] = useState("");
  const [isMaintaining, setIsMaintaining] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(Date.now());
  const backupIntervalRef = useRef(null);

  const warnsSectionRef = useRef(null);
  const raidsSectionRef = useRef(null);
  const fraudSectionRef = useRef(null);

  const {
    preferences,
    setThemeValue,
    setDensity,
    toggleSectionVisibility,
    moveSection,
    resetPreferences,
  } = useDashboardPreferences();

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
    async ({
      silent = false,
      force = false,
      reason = "manual",
    } = {}) => {
      const now = Date.now();

      if (!force && refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      if (!silent) {
        setIsRefreshing(true);
      }

      try {
        const res = await fetch(
          `/api/dashboard/live?_ts=${now}&reason=${encodeURIComponent(reason)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-store, max-age=0",
              Pragma: "no-cache",
            },
          }
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to refresh dashboard.");
        }

        setData(json);
        setError("");
        lastRefreshAtRef.current = Date.now();
      } catch (err) {
        setError(err?.message || "Failed to refresh dashboard.");
      } finally {
        refreshInFlightRef.current = false;

        if (!silent) {
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  const maybeRefreshIfStale = useCallback(
    async (reason) => {
      const age = Date.now() - lastRefreshAtRef.current;
      if (age >= STALE_VISIBLE_REFRESH_MS) {
        await refresh({ silent: true, force: false, reason });
      }
    },
    [refresh]
  );

  const handleReconcileTickets = useCallback(
    async ({
      includeOpenWithMissingChannel = true,
      includeTranscriptBackfill = true,
      dryRun = false,
    } = {}) => {
      setIsMaintaining(true);
      setMaintenanceError("");
      setMaintenanceMessage("");

      try {
        const result = await reconcileTicketsAction({
          requestedBy: currentStaffId,
          staffId: currentStaffId,
          includeOpenWithMissingChannel,
          includeTranscriptBackfill,
          dryRun,
        });

        setMaintenanceMessage(
          dryRun
            ? `Reconcile preview finished. Scanned ${Number(result?.scanned || 0)} tickets and found ${safeArray(result?.tickets).length} candidate row(s).`
            : `Reconcile finished. Scanned ${Number(result?.scanned || 0)} tickets, updated ${Number(result?.updated || 0)}, and hid ${Number(result?.hidden || 0)} stale candidate row(s).`
        );

        await refresh({ silent: true, force: true, reason: "reconcile" });
      } catch (err) {
        setMaintenanceError(
          err?.message || "Failed to reconcile tickets."
        );
      } finally {
        setIsMaintaining(false);
      }
    },
    [currentStaffId, refresh]
  );

  const handlePreviewPurge = useCallback(async () => {
    setIsMaintaining(true);
    setMaintenanceError("");
    setMaintenanceMessage("");

    try {
      const result = await purgeStaleTicketsAction({
        requestedBy: currentStaffId,
        staffId: currentStaffId,
        dryRun: true,
        olderThanMinutes: 5,
      });

      setMaintenanceMessage(
        `Purge preview finished. Scanned ${Number(result?.scanned || 0)} tickets and found ${safeArray(result?.candidates).length} stale candidate row(s).`
      );
    } catch (err) {
      setMaintenanceError(
        err?.message || "Failed to preview stale purge."
      );
    } finally {
      setIsMaintaining(false);
    }
  }, [currentStaffId]);

  const handlePurgeStale = useCallback(async () => {
    setIsMaintaining(true);
    setMaintenanceError("");
    setMaintenanceMessage("");

    try {
      const result = await purgeStaleTicketsAction({
        requestedBy: currentStaffId,
        staffId: currentStaffId,
        dryRun: false,
        olderThanMinutes: 5,
      });

      setMaintenanceMessage(
        `Purge finished. Scanned ${Number(result?.scanned || 0)} tickets and removed ${Number(result?.removed || 0)} stale row(s).`
      );

      await refresh({ silent: true, force: true, reason: "purge-stale" });
    } catch (err) {
      setMaintenanceError(
        err?.message || "Failed to purge stale tickets."
      );
    } finally {
      setIsMaintaining(false);
    }
  }, [currentStaffId, refresh]);

  useEffect(() => {
    let supabase;
    let channel;

    function handleRealtimeChange() {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refresh({ silent: true, force: false, reason: "realtime" });
      }, 500);
    }

    function handleWindowFocus() {
      maybeRefreshIfStale("focus");
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        maybeRefreshIfStale("visible");
      }
    }

    function handleOnline() {
      refresh({ silent: true, force: true, reason: "online" });
    }

    async function initialRefresh() {
      await refresh({ silent: true, force: true, reason: "mount" });
    }

    initialRefresh();

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
            refresh({
              silent: true,
              force: true,
              reason: "realtime-subscribed",
            });
          }
        });
    } catch (err) {
      setError(err?.message || "Realtime client unavailable.");
    }

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    backupIntervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        maybeRefreshIfStale("backup-interval");
      }
    }, BACKUP_REFRESH_INTERVAL_MS);

    return () => {
      clearTimeout(refreshTimer.current);

      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }

      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [maybeRefreshIfStale, refresh]);

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
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      rows = rows.filter(
        (t) =>
          String(t.status || "").toLowerCase() === statusFilter
      );
    }

    if (priorityFilter !== "all") {
      rows = rows.filter(
        (t) =>
          String(t.priority || "").toLowerCase() === priorityFilter
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

      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    },
    []
  );

  const jumpToPanel = useCallback(
    (panelName) => {
      setActiveTab("home");
      openOnlyPanel(panelName);

      const refMap = {
        warns: warnsSectionRef,
        raids: raidsSectionRef,
        fraud: fraudSectionRef,
      };

      const targetRef = refMap[panelName];

      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (targetRef?.current) {
              targetRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            } else {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          });
        });
      }
    },
    [openOnlyPanel]
  );

  const lastRefreshLabel = timeAgo(lastRefreshAtRef.current);

  const sectionVisibility = preferences?.sectionVisibility || {};
  const homeLayout = preferences?.layout?.home || [];
  const membersLayout = preferences?.layout?.members || [];
  const density = preferences?.density || "comfortable";

  const homeSections = {
    intelligence: (
      <IntelligencePanel
        intelligence={intelligence}
        expanded={expandedPanels.intelligence}
        onToggle={() => togglePanel("intelligence")}
        onJumpToTickets={() => jumpToTickets({ status: "open" })}
        onJumpToWarns={() => jumpToPanel("warns")}
        onJumpToRaids={() => jumpToPanel("raids")}
        onJumpToFraud={() => jumpToPanel("fraud")}
      />
    ),
    stats: (
      <div className="metrics-grid">
        <ClickableStatCard
          title="Open Tickets"
          value={counts.openTickets}
          subtitle="Tap to open queue"
          onClick={() => jumpToTickets({ status: "open" })}
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
    ),
    quickActions: (
      <QuickActions
        onRefresh={() => refresh({ force: true, reason: "quick-actions" })}
        currentStaffId={currentStaffId}
      />
    ),
    activity: (
      <DashboardSection
        title="Activity Feed"
        subtitle={`${safeEvents.length} recent audit events loaded`}
        expanded={expandedPanels.activity}
        onToggle={() => togglePanel("activity")}
      >
        <AuditTimeline events={safeEvents} />
      </DashboardSection>
    ),
    warns: (
      <div ref={warnsSectionRef}>
        <DashboardSection
          title="Warn Intelligence"
          subtitle={`${safeWarns.length} warning record${safeWarns.length === 1 ? "" : "s"} in the last 24 hours`}
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
            rows={homeSummary.recentWarns}
            emptyMessage="No warnings were recorded in the last 24 hours."
            renderRow={(warn, index) => (
              <div
                key={warn?.id || `warn-${index}`}
                className="card"
                style={{ padding: 14 }}
              >
                <div style={{ fontWeight: 800 }}>
                  {safeText(warn?.display_name || warn?.username, "Unknown user")}
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
      </div>
    ),
    raids: (
      <div ref={raidsSectionRef}>
        <DashboardSection
          title="Raid Intelligence"
          subtitle={`${safeRaids.length} raid alert${safeRaids.length === 1 ? "" : "s"} in the last 24 hours`}
          expanded={expandedPanels.raids}
          onToggle={() => togglePanel("raids")}
        >
          <SimpleFeedPanel
            rows={homeSummary.recentRaids}
            emptyMessage="No raid alerts were recorded in the last 24 hours."
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
      </div>
    ),
    fraud: (
      <div ref={fraudSectionRef}>
        <DashboardSection
          title="Fraud Intelligence"
          subtitle={`${safeFraud.length} flagged record${safeFraud.length === 1 ? "" : "s"} in the current dataset`}
          expanded={expandedPanels.fraud}
          onToggle={() => togglePanel("fraud")}
        >
          {homeSummary.recentFraud.length ? (
            <SimpleFeedPanel
              rows={homeSummary.recentFraud}
              emptyMessage="No fraud items."
              renderRow={(fraud, index) => (
                <div
                  key={fraud?.id || `fraud-${index}`}
                  className="card"
                  style={{ padding: 14 }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {safeText(fraud?.display_name || fraud?.username, "Suspicious member")}
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
                  No fraud flags or role conflicts are present in the current dataset.
                </div>
              )}
            </div>
          )}
        </DashboardSection>
      </div>
    ),
  };

  const membersSections = {
    freshEntrants: (
      <DashboardSection
        title="Fresh Entrants"
        subtitle={`${safeRecentJoins.length} recent join record${safeRecentJoins.length === 1 ? "" : "s"} loaded`}
        expanded={expandedPanels.joins}
        onToggle={() => togglePanel("joins")}
      >
        <RecentJoinsCard joins={safeRecentJoins} />
      </DashboardSection>
    ),
    memberSnapshot: (
      <DashboardSection
        title="Member Snapshot"
        subtitle={`${safeMembers.length} member record${safeMembers.length === 1 ? "" : "s"} loaded`}
        expanded={expandedPanels.members}
        onToggle={() => togglePanel("members")}
      >
        <MemberSnapshot members={safeMembers} />
      </DashboardSection>
    ),
    staffMetrics: (
      <DashboardSection
        title="Staff Metrics"
        subtitle={`${safeMetrics.length} staff record${safeMetrics.length === 1 ? "" : "s"} loaded`}
        expanded={expandedPanels.staff}
        onToggle={() => togglePanel("staff")}
      >
        <StaffMetricsCard metrics={safeMetrics} />
      </DashboardSection>
    ),
    roleHierarchy: (
      <DashboardSection
        title="Role Hierarchy"
        subtitle={`${safeRoles.length} role record${safeRoles.length === 1 ? "" : "s"} loaded`}
        expanded={expandedPanels.roles}
        onToggle={() => togglePanel("roles")}
      >
        <RoleHierarchyCard
          roles={safeRoles}
          members={safeMembers}
          staffUserId={currentStaffId}
          refreshDashboardData={() =>
            refresh({ force: true, reason: "role-hierarchy" })
          }
        />
      </DashboardSection>
    ),
    memberSearch: (
      <DashboardSection
        title="Member Search"
        subtitle="Search the tracked guild member dataset"
        expanded={true}
        onToggle={null}
      >
        <MemberSearchCard />
      </DashboardSection>
    ),
  };

  const desktopCategorySection = (
    <CategoryManager
      categories={safeCategories}
      onRefresh={() => refresh({ force: true, reason: "categories" })}
    />
  );

  return (
    <>
      <Topbar />

      <div style={{ paddingBottom: 96 }}>
        <div className="desktop-only-nav">
          <DesktopTabBar
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div
          className="card dashboard-refresh-card"
          style={{ marginBottom: 16, padding: 12 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div className="muted" style={{ fontSize: 13 }}>
              Last successful refresh: {lastRefreshLabel}
            </div>

            <div
              className="dashboard-refresh-actions"
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 120 }}
                onClick={() => setSettingsOpen(true)}
              >
                Personalize UI
              </button>

              <button
                type="button"
                className="button ghost"
                style={{ width: "auto", minWidth: 120 }}
                onClick={() =>
                  refresh({ force: true, reason: "manual-header-refresh" })
                }
              >
                Refresh Now
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
                    dryRun: true,
                  })
                }
              >
                {isMaintaining ? "Working..." : "Preview Reconcile"}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        {maintenanceError ? (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {maintenanceError}
          </div>
        ) : null}

        {maintenanceMessage ? (
          <div className="info-banner" style={{ marginBottom: 16 }}>
            {maintenanceMessage}
          </div>
        ) : null}

        {isRefreshing ? (
          <div className="info-banner" style={{ marginBottom: 16 }}>
            Refreshing dashboard…
          </div>
        ) : null}

        <DesktopDashboardView
          activeTab={activeTab}
          counts={counts}
          safeEvents={safeEvents}
          safeWarns={safeWarns}
          safeRaids={safeRaids}
          safeFraud={safeFraud}
          safeCategories={desktopCategorySection}
          safeRecentJoins={safeRecentJoins}
          safeMembers={safeMembers}
          safeMetrics={safeMetrics}
          safeRoles={safeRoles}
          intelligence={intelligence}
          expandedPanels={expandedPanels}
          togglePanel={togglePanel}
          jumpToTickets={jumpToTickets}
          jumpToPanel={jumpToPanel}
          refresh={refresh}
          currentStaffId={currentStaffId}
          homeLayout={homeLayout}
          membersLayout={membersLayout}
          sectionVisibility={sectionVisibility}
          homeSections={homeSections}
          membersSections={membersSections}
          filteredTickets={
            <TicketQueueTable
              tickets={filteredTickets}
              currentStaffId={currentStaffId}
              onRefresh={() =>
                refresh({ force: true, reason: "ticket-controls" })
              }
            />
          }
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
        />

        <section
          className={`mobile-tab-panel ${activeTab === "home" ? "active" : ""}`}
        >
          <div className="dashboard-home-grid">
            {homeLayout
              .filter((key) => sectionVisibility[key] !== false)
              .map((key) => (
                <div key={`home-${key}`}>{homeSections[key] || null}</div>
              ))}
          </div>
        </section>

        <section
          className={`mobile-tab-panel ${activeTab === "tickets" ? "active" : ""}`}
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
              onRefresh={() =>
                refresh({ force: true, reason: "ticket-controls" })
              }
            />
          </div>
        </section>

        <section
          className={`mobile-tab-panel ${activeTab === "members" ? "active" : ""}`}
        >
          <div className="dashboard-members-grid">
            {membersLayout
              .filter((key) => sectionVisibility[key] !== false)
              .map((key) => (
                <div key={`members-${key}`}>{membersSections[key] || null}</div>
              ))}
          </div>
        </section>

        <section
          className={`mobile-tab-panel ${activeTab === "categories" ? "active" : ""}`}
        >
          {sectionVisibility.categories !== false ? (
            <div className="card">
              <CategoryManager
                categories={safeCategories}
                onRefresh={() => refresh({ force: true, reason: "categories" })}
              />
            </div>
          ) : (
            <div className="empty-state">
              Categories is hidden in your personalization settings.
            </div>
          )}
        </section>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={MOBILE_TABS}
      />

      <DashboardSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        setThemeValue={setThemeValue}
        setDensity={setDensity}
        toggleSectionVisibility={toggleSectionVisibility}
        moveSection={moveSection}
        resetPreferences={resetPreferences}
      />

      <style jsx>{`
        .desktop-only-nav {
          display: none;
        }

        .dashboard-home-grid,
        .dashboard-members-grid {
          display: grid;
          gap: ${density === "compact"
            ? "12px"
            : density === "spacious"
              ? "22px"
              : "16px"};
        }

        .dashboard-members-grid {
          align-items: start;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: ${density === "compact"
            ? "10px"
            : density === "spacious"
              ? "16px"
              : "12px"};
        }

        .intelligence-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: ${density === "compact"
            ? "10px"
            : density === "spacious"
              ? "16px"
              : "12px"};
          margin-bottom: 14px;
          align-items: stretch;
        }

        .intel-tile {
          border-radius: 18px;
          padding: ${density === "compact"
            ? "12px"
            : density === "spacious"
              ? "18px"
              : "14px"};
          display: grid;
          gap: 8px;
          border: 1px solid var(--panel-border, rgba(255,255,255,0.08));
          background: var(--panel-bg-soft, rgba(255,255,255,0.02));
          min-width: 0;
          overflow: hidden;
        }

        .intel-tile.ok {
          border-color: color-mix(
            in srgb,
            var(--tone-success, #4ade80) 22%,
            transparent
          );
          background: color-mix(
            in srgb,
            var(--tone-success, #4ade80) 10%,
            transparent
          );
        }

        .intel-tile.warn {
          border-color: color-mix(
            in srgb,
            var(--tone-warn, #fbbf24) 22%,
            transparent
          );
          background: color-mix(
            in srgb,
            var(--tone-warn, #fbbf24) 10%,
            transparent
          );
        }

        .intel-tile.danger {
          border-color: color-mix(
            in srgb,
            var(--tone-danger, #f87171) 22%,
            transparent
          );
          background: color-mix(
            in srgb,
            var(--tone-danger, #f87171) 10%,
            transparent
          );
        }

        .intel-value {
          font-size: clamp(20px, 5vw, 28px);
          line-height: 1.05;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .detail-grid-3 {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${density === "compact"
            ? "10px"
            : density === "spacious"
              ? "16px"
              : "12px"};
        }

        .compact-detail-card {
          padding: ${density === "compact"
            ? "12px"
            : density === "spacious"
              ? "18px"
              : "14px"};
        }

        .detail-card-title {
          font-weight: 800;
          margin-bottom: 8px;
        }

        .detail-list {
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        @media (min-width: 768px) {
          .metrics-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .intelligence-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .detail-grid-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .desktop-only-nav {
            display: block;
          }

          .dashboard-home-grid,
          .dashboard-members-grid {
            gap: ${density === "compact"
              ? "14px"
              : density === "spacious"
                ? "24px"
                : "18px"};
          }

          .dashboard-members-grid {
            grid-template-columns: 1.2fr 1.2fr;
          }

          .dashboard-members-grid :global(.compact-panel:nth-child(3)),
          .dashboard-members-grid :global(.compact-panel:nth-child(4)),
          .dashboard-members-grid :global(.compact-panel:nth-child(5)) {
            grid-column: span 1;
          }

          .mobile-tab-panel {
            display: none !important;
          }
        }

        @media (max-width: 640px) {
          .intelligence-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-refresh-actions {
            width: 100%;
          }

          .dashboard-refresh-actions :global(button) {
            flex: 1 1 0;
            min-width: 0 !important;
          }
        }
      `}</style>
    </>
  );
}
