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
  syncActiveTicketsAction,
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
const STALE_VISIBLE_REFRESH_MS = 45_000;
const BACKUP_REFRESH_INTERVAL_MS = 90_000;
const RESUME_PENDING_REFRESH_CHECK_MS = 1500;
const MOBILE_NAV_RESERVED_PX = 84;
const REALTIME_DEBOUNCE_MS = 1250;
const DESKTOP_LAYOUT_MIN_WIDTH = 1024;

const LEGACY_CATEGORY_ALIASES = {
  verification: [
    "verification_issue",
    "verification issue",
    "verify_issue",
    "verify issue",
    "verification",
    "verify",
  ],
  appeal: ["appeal", "appeals", "ban appeal", "timeout appeal"],
  report: [
    "report",
    "report_issue",
    "report issue",
    "incident",
    "report incident",
    "report / incident",
  ],
  partnership: ["partnership", "partner", "collab", "collaboration"],
  question: ["question", "questions"],
  general: ["general", "general support", "support", "help"],
  custom: [],
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLegacyAliasesForCategory(category) {
  const keys = [
    normalizeText(category?.slug),
    normalizeText(category?.intake_type),
    normalizeText(category?.name),
  ];

  const out = new Set();

  for (const key of keys) {
    const aliases = LEGACY_CATEGORY_ALIASES[key] || [];
    for (const alias of aliases) out.add(normalizeText(alias));
  }

  return [...out];
}

function ticketMatchesSelectedCategory(ticket, selectedCategory) {
  if (!selectedCategory) return true;

  const selectedId = String(selectedCategory?.id || "").trim();
  const selectedSlug = normalizeText(selectedCategory?.slug);
  const selectedName = normalizeText(selectedCategory?.name);
  const selectedIntake = normalizeText(selectedCategory?.intake_type);
  const selectedKeywords = Array.isArray(selectedCategory?.match_keywords)
    ? selectedCategory.match_keywords.map((k) => normalizeText(k))
    : [];
  const legacyAliases = getLegacyAliasesForCategory(selectedCategory);

  const ticketCategoryId = String(ticket?.category_id || "").trim();
  const ticketMatchedCategoryId = String(ticket?.matched_category_id || "").trim();

  if (
    selectedId &&
    (ticketCategoryId === selectedId || ticketMatchedCategoryId === selectedId)
  ) {
    return true;
  }

  const ticketValues = [
    ticket?.category,
    ticket?.raw_category,
    ticket?.matched_category_name,
    ticket?.matched_category_slug,
    ticket?.matched_intake_type,
    ticket?.title,
    ticket?.initial_message,
    ticket?.mod_suggestion,
    ticket?.closed_reason,
    ticket?.channel_name,
  ]
    .filter(Boolean)
    .map((v) => normalizeText(v));

  const needles = [
    selectedSlug,
    selectedName,
    selectedIntake,
    ...selectedKeywords,
    ...legacyAliases,
  ].filter(Boolean);

  return needles.some((needle) =>
    ticketValues.some((value) => value === needle || value.includes(needle))
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
      metricName === String(staffName || "").trim().toLowerCase()
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
    (t) => String(t?.status || t?.ticket_status || "").toLowerCase() === status
  ).length;
}

function getClaimedById(ticket) {
  const value =
    ticket?.claimed_by_id ??
    ticket?.assigned_to_id ??
    ticket?.assigned_to ??
    ticket?.claimed_by ??
    "";

  const text = String(value || "").trim();
  if (!text) return "";
  return text;
}

function isTicketClaimed(ticket) {
  if (ticket?.is_claimed === true) return true;
  const status = String(ticket?.status || ticket?.ticket_status || "").toLowerCase();
  if (status === "claimed") return true;
  return Boolean(getClaimedById(ticket));
}

function isTicketUnclaimed(ticket) {
  if (ticket?.is_unclaimed === true) return true;
  const status = String(ticket?.status || ticket?.ticket_status || "").toLowerCase();
  if (status !== "open") return false;
  return !getClaimedById(ticket);
}

function isTicketOverdue(ticket) {
  if (ticket?.overdue === true) return true;

  const createdAtMs = new Date(
    String(ticket?.created_at || ticket?.updated_at || "")
  ).getTime();

  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return false;

  const ageMs = Date.now() - createdAtMs;
  return ageMs >= 60 * 60 * 1000;
}

function statusMatchesFilter(ticket, filterValue, currentStaffId = null) {
  const status = String(ticket?.status || ticket?.ticket_status || "").toLowerCase();
  const claimedById = getClaimedById(ticket);
  const currentStaffIdText = String(currentStaffId || "").trim();

  if (filterValue === "all") return true;
  if (filterValue === "active") return status === "open" || status === "claimed";
  if (filterValue === "queue") return status === "open" || status === "claimed";
  if (filterValue === "open_only") return status === "open";
  if (filterValue === "unclaimed") return isTicketUnclaimed(ticket);
  if (filterValue === "claimed") return isTicketClaimed(ticket);
  if (filterValue === "my_claimed") {
    if (!currentStaffIdText) return false;
    return isTicketClaimed(ticket) && claimedById === currentStaffIdText;
  }
  if (filterValue === "closed") return status === "closed";
  if (filterValue === "deleted") return status === "deleted";

  return status === filterValue;
}

function isActiveTicketStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return value === "open" || value === "claimed";
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

function isBlockingModalOpen() {
  if (typeof document === "undefined") return false;

  if (
    document.body?.dataset?.settingsOpen === "true" ||
    document.querySelector(".settings-overlay")
  ) {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    );

    return dialogs.some((dialog) => {
      if (!(dialog instanceof HTMLElement)) return false;
      if (dialog.closest(".settings-overlay")) return false;
      if (
        String(dialog.getAttribute("aria-label") || "").trim().toLowerCase() ===
        "dashboard personalization"
      ) {
        return false;
      }
      return true;
    });
  }

  return Boolean(
    document.querySelector(".member-modal-backdrop") ||
      Array.from(
        document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      ).some((dialog) => {
        if (!(dialog instanceof HTMLElement)) return false;
        if (dialog.closest(".settings-overlay")) return false;
        if (
          String(dialog.getAttribute("aria-label") || "").trim().toLowerCase() ===
          "dashboard personalization"
        ) {
          return false;
        }
        return true;
      })
  );
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

  const serverHealth = data?.intelligence?.serverHealth || (
    fraudFlags >= 8 || raidAlerts >= 4 || openTickets >= 24
      ? "Critical"
      : fraudFlags >= 4 || raidAlerts >= 2 || openTickets >= 14
        ? "Elevated"
        : "Stable"
  );

  const raidRisk = data?.intelligence?.raidRisk || (
    raidAlerts >= 3 ? "High" : raidAlerts >= 1 ? "Moderate" : "Low"
  );

  const fraudRisk = data?.intelligence?.fraudRisk || (
    fraudFlags >= 5
      ? "High"
      : fraudFlags >= 1 || pendingVerification >= 12
        ? "Moderate"
        : "Low"
  );

  const ticketPressure = data?.intelligence?.ticketPressure || (
    openTickets >= 14 || claimedTickets >= 8
      ? "High"
      : openTickets >= 6 || claimedTickets >= 4
        ? "Moderate"
        : "Low"
  );

  const verificationPressure = data?.intelligence?.verificationPressure || (
    pendingVerification >= 16
      ? "High"
      : pendingVerification >= 8
        ? "Moderate"
        : "Low"
  );

  const verifiedRate =
    Number.isFinite(Number(data?.intelligence?.verifiedRate))
      ? Number(data.intelligence.verifiedRate)
      : activeMembers > 0
        ? Math.round((verifiedMembers / activeMembers) * 100)
        : 0;

  const summaryItems = [
    { key: "health", label: "Server Health", value: serverHealth, tone: serverHealth },
    { key: "raid", label: "Raid Risk", value: raidRisk, tone: raidRisk },
    { key: "fraud", label: "Fraud Risk", value: fraudRisk, tone: fraudRisk },
    { key: "tickets", label: "Ticket Pressure", value: ticketPressure, tone: ticketPressure },
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
      tone:
        verifiedRate >= 80
          ? "Low"
          : verifiedRate >= 60
            ? "Moderate"
            : "High",
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
    reasons: {
      serverHealth:
        data?.intelligence?.reasons?.serverHealth ||
        "No major threshold is currently tripping the health score.",
      raidRiskReason:
        data?.intelligence?.reasons?.raidRiskReason ||
        "No recent raid alert threshold was crossed.",
      fraudRiskReason:
        data?.intelligence?.reasons?.fraudRiskReason ||
        "No active fraud flags are currently driving the score.",
      ticketPressureReason:
        data?.intelligence?.reasons?.ticketPressureReason ||
        "Ticket load is within normal range.",
      verificationPressureReason:
        data?.intelligence?.reasons?.verificationPressureReason ||
        "Verification queue is under control.",
    },
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
    <div className="card compact-panel dashboard-section-shell">
      <div
        className="panel-header"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          cursor: onToggle ? "pointer" : "default",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: "var(--text-strong)" }}>
            {title}
          </div>

          {subtitle ? (
            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
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
            <span className="badge">{isOpen ? "Hide" : "Show"}</span>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <div className="dashboard-section-body" style={{ marginTop: 14 }}>
          {children}
        </div>
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
          <div className="detail-card-title">Why The Current Scores</div>
          <div className="muted detail-list">
            <div><strong>Fraud:</strong> {safeText(intelligence.reasons.fraudRiskReason)}</div>
            <div><strong>Tickets:</strong> {safeText(intelligence.reasons.ticketPressureReason)}</div>
            <div><strong>Verification:</strong> {safeText(intelligence.reasons.verificationPressureReason)}</div>
            <div><strong>Raid:</strong> {safeText(intelligence.reasons.raidRiskReason)}</div>
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
            onClick={() => onChange(tab, { preserveScroll: true })}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        );
      })}
    </div>
  );
}

function useIsDesktopLayout(minWidth = DESKTOP_LAYOUT_MIN_WIDTH) {
  const getValue = () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= minWidth;
  };

  const [isDesktop, setIsDesktop] = useState(getValue);

  useEffect(() => {
    function update() {
      setIsDesktop(getValue());
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [minWidth]);

  return isDesktop;
}

function ticketDedupKey(ticket) {
  return (
    String(ticket?.id || "").trim() ||
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim() ||
    [
      String(ticket?.user_id || "").trim(),
      String(ticket?.category_id || "").trim(),
      String(ticket?.matched_category_id || "").trim(),
      String(ticket?.category || "").trim(),
      String(ticket?.status || ticket?.ticket_status || "").trim(),
      String(ticket?.created_at || "").trim(),
    ].join("::")
  );
}

function mergeUniqueTickets(...ticketSets) {
  const merged = [];
  const seen = new Set();

  for (const set of ticketSets) {
    for (const ticket of safeArray(set)) {
      const key = ticketDedupKey(ticket);
      if (!key) {
        merged.push(ticket);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(ticket);
    }
  }

  return merged;
}

function getEffectsModeClass(mode) {
  const value = String(mode || "").trim().toLowerCase();
  if (value === "minimal") return "effects-minimal";
  if (value === "reduced") return "effects-reduced";
  return "effects-full";
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
  const [isModalPaused, setIsModalPaused] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("queue");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority_desc");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
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

  const isDesktopLayout = useIsDesktopLayout();

  const refreshTimer = useRef(null);
  const refreshInFlightRef = useRef(false);
  const pendingRefreshReasonRef = useRef("");
  const lastRefreshAtRef = useRef(Date.now());
  const backupIntervalRef = useRef(null);
  const resumeIntervalRef = useRef(null);

  const warnsSectionRef = useRef(null);
  const raidsSectionRef = useRef(null);
  const fraudSectionRef = useRef(null);

  const tabScrollMemoryRef = useRef({
    home: 0,
    tickets: 0,
    members: 0,
    categories: 0,
  });

  const activeTabRef = useRef("home");

  const {
    preferences,
    profiles,
    activeProfileId,
    lastUsedProfileId,
    setThemeValue,
    setDensity,
    toggleSectionVisibility,
    moveSection,
    resetPreferences,
    saveProfile,
    saveActiveProfile,
    loadProfile,
    renameProfile,
    deleteProfile,
  } = useDashboardPreferences();

  const currentStaffId = useMemo(
    () => getStaffUserId(initialData, staffName),
    [initialData, staffName]
  );

  const shouldPauseRefresh = useCallback(() => {
    return settingsOpen || isBlockingModalOpen();
  }, [settingsOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    if (settingsOpen) {
      document.body.dataset.settingsOpen = "true";
    } else {
      delete document.body.dataset.settingsOpen;
    }

    return () => {
      delete document.body.dataset.settingsOpen;
    };
  }, [settingsOpen]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const rememberCurrentScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    tabScrollMemoryRef.current[activeTabRef.current] = window.scrollY || 0;
  }, []);

  const restoreTabScroll = useCallback((tabKey, fallbackTop = 0) => {
    if (typeof window === "undefined") return;
    const nextY = Number(tabScrollMemoryRef.current?.[tabKey] ?? fallbackTop);
    window.scrollTo({
      top: Number.isFinite(nextY) ? nextY : 0,
      behavior: "auto",
    });
  }, []);

  const handleTabChange = useCallback((nextTab, options = {}) => {
    const {
      preserveScroll = true,
      resetToTop = false,
    } = options;

    if (!nextTab || nextTab === activeTabRef.current) return;

    if (typeof window !== "undefined") {
      tabScrollMemoryRef.current[activeTabRef.current] = window.scrollY || 0;
    }

    setActiveTab(nextTab);

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (resetToTop) {
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }

          if (preserveScroll) {
            restoreTabScroll(nextTab, 0);
          }
        });
      });
    }
  }, [restoreTabScroll]);

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
      const pauseNow = shouldPauseRefresh();

      if (pauseNow) {
        setIsModalPaused(true);
      } else {
        setIsModalPaused(false);
      }

      if (!force && (refreshInFlightRef.current || pauseNow)) {
        pendingRefreshReasonRef.current = reason;
        return;
      }

      refreshInFlightRef.current = true;

      if (!silent) setIsRefreshing(true);

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
        pendingRefreshReasonRef.current = "";
        setIsModalPaused(false);
      } catch (err) {
        setError(err?.message || "Failed to refresh dashboard.");
      } finally {
        refreshInFlightRef.current = false;
        if (!silent) setIsRefreshing(false);
      }
    },
    [shouldPauseRefresh]
  );

  const maybeRefreshIfStale = useCallback(
    async (reason) => {
      const pauseNow = shouldPauseRefresh();

      if (pauseNow) {
        pendingRefreshReasonRef.current = reason;
        setIsModalPaused(true);
        return;
      }

      setIsModalPaused(false);

      const age = Date.now() - lastRefreshAtRef.current;
      if (age >= STALE_VISIBLE_REFRESH_MS) {
        await refresh({ silent: true, force: false, reason });
      }
    },
    [refresh, shouldPauseRefresh]
  );

  const handleSyncActiveTickets = useCallback(
    async ({
      dryRun = false,
      includeClosedVisibleChannels = true,
    } = {}) => {
      setIsMaintaining(true);
      setMaintenanceError("");
      setMaintenanceMessage("");

      try {
        const result = await syncActiveTicketsAction({
          requestedBy: currentStaffId,
          staffId: currentStaffId,
          dryRun,
          includeClosedVisibleChannels,
        });

        const summary = result?.command?.result || result?.result || null;

        setMaintenanceMessage(
          dryRun
            ? "Ticket sync preview queued successfully."
            : summary
              ? "Active ticket sync finished successfully."
              : "Active ticket sync queued successfully."
        );

        await refresh({ silent: true, force: true, reason: "sync-active" });
      } catch (err) {
        setMaintenanceError(
          err?.message || "Failed to sync active tickets."
        );
      } finally {
        setIsMaintaining(false);
      }
    },
    [currentStaffId, refresh]
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

    function scheduleRefresh(reason, force = false) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        const pauseNow = shouldPauseRefresh();

        if (pauseNow && !force) {
          pendingRefreshReasonRef.current = reason;
          setIsModalPaused(true);
          return;
        }

        if (!pauseNow) {
          setIsModalPaused(false);
        }

        refresh({ silent: true, force, reason });
      }, REALTIME_DEBOUNCE_MS);
    }

    function handleRealtimeChange() {
      scheduleRefresh("realtime");
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
      const pauseNow = shouldPauseRefresh();

      if (pauseNow) {
        pendingRefreshReasonRef.current = "online";
        setIsModalPaused(true);
        return;
      }

      setIsModalPaused(false);
      refresh({ silent: true, force: true, reason: "online" });
    }

    if (!initialData) {
      refresh({ silent: true, force: true, reason: "mount-no-data" });
    } else {
      lastRefreshAtRef.current = Date.now();
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
        .subscribe();
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

    resumeIntervalRef.current = setInterval(() => {
      const pendingReason = pendingRefreshReasonRef.current;
      if (!pendingReason) return;
      if (refreshInFlightRef.current) return;

      const pauseNow = shouldPauseRefresh();
      if (pauseNow) {
        setIsModalPaused(true);
        return;
      }

      setIsModalPaused(false);
      pendingRefreshReasonRef.current = "";
      refresh({
        silent: true,
        force: true,
        reason: `${pendingReason}-resume`,
      });
    }, RESUME_PENDING_REFRESH_CHECK_MS);

    return () => {
      clearTimeout(refreshTimer.current);

      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }

      if (resumeIntervalRef.current) {
        clearInterval(resumeIntervalRef.current);
      }

      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [initialData, maybeRefreshIfStale, refresh, shouldPauseRefresh]);

  useEffect(() => {
    if (settingsOpen) {
      rememberCurrentScroll();
      setIsModalPaused(true);
      if (pendingRefreshReasonRef.current === "settings-open") {
        pendingRefreshReasonRef.current = "";
      }
    } else if (!shouldPauseRefresh()) {
      setIsModalPaused(false);
    }
  }, [settingsOpen, shouldPauseRefresh, rememberCurrentScroll]);

  const counts = data?.counts || {
    openTickets: 0,
    warnsToday: 0,
    raidAlerts: 0,
    fraudFlags: 0,
  };

  const safeEvents = safeArray(data?.events || data?.activityFeed);
  const safeRoles = safeArray(data?.roles);
  const safeMetrics = safeArray(data?.metrics);
  const safeCategories = safeArray(data?.categories);
  const safeRecentJoins = safeArray(data?.recentJoins);
  const safeMembers = data?.guildMembers || data?.members || [];

  const safeTickets = useMemo(() => {
    const allRows = safeArray(data?.tickets);
    const activeRows = safeArray(data?.activeTickets);
    const closedRows = safeArray(data?.closedTickets);

    const merged = mergeUniqueTickets(allRows, activeRows, closedRows);
    return sortTickets(merged, "updated_desc");
  }, [data?.tickets, data?.activeTickets, data?.closedTickets]);

  const safeActiveTickets = useMemo(() => {
    const activeRows = safeArray(data?.activeTickets);
    if (activeRows.length) {
      return sortTickets(
        mergeUniqueTickets(activeRows),
        "priority_desc"
      );
    }

    return sortTickets(
      safeTickets.filter((ticket) =>
        isActiveTicketStatus(ticket?.status || ticket?.ticket_status)
      ),
      "priority_desc"
    );
  }, [data?.activeTickets, safeTickets]);

  const safeClosedTickets = useMemo(() => {
    const closedRows = safeArray(data?.closedTickets);
    if (closedRows.length) {
      return sortTickets(
        mergeUniqueTickets(closedRows),
        "updated_desc"
      );
    }

    return sortTickets(
      safeTickets.filter((ticket) => {
        const status = String(ticket?.status || ticket?.ticket_status || "").toLowerCase();
        return status === "closed" || status === "deleted";
      }),
      "updated_desc"
    );
  }, [data?.closedTickets, safeTickets]);

  const safeWarns = safeArray(data?.warns);
  const safeRaids = safeArray(data?.raids);
  const safeFraud = safeArray(data?.fraud || data?.fraudFlagsList);

  const enhancedCounts = useMemo(() => {
    const queueRows = safeTickets.filter((ticket) =>
      statusMatchesFilter(ticket, "queue", currentStaffId)
    );
    const unclaimedRows = safeTickets.filter((ticket) =>
      statusMatchesFilter(ticket, "unclaimed", currentStaffId)
    );
    const claimedRows = safeTickets.filter((ticket) =>
      statusMatchesFilter(ticket, "claimed", currentStaffId)
    );
    const overdueRows = queueRows.filter((ticket) => isTicketOverdue(ticket));

    return {
      ...counts,
      queueTotal: queueRows.length,
      queueUnclaimed: unclaimedRows.length,
      queueClaimed: claimedRows.length,
      queueOverdue: overdueRows.length,
    };
  }, [counts, safeTickets, currentStaffId]);

  const intelligence = useMemo(
    () => buildModeratorIntelligence({
      ...data,
      tickets: safeTickets,
    }),
    [data, safeTickets]
  );

  const filteredTickets = useMemo(() => {
    let rows = [...safeTickets];

    if (statusFilter === "queue" || statusFilter === "active") {
      rows = [...safeActiveTickets];
    } else if (statusFilter === "closed" || statusFilter === "deleted") {
      rows = safeClosedTickets.filter((ticket) =>
        statusMatchesFilter(ticket, statusFilter, currentStaffId)
      );
    } else if (statusFilter === "unclaimed") {
      rows = safeTickets.filter((ticket) =>
        statusMatchesFilter(ticket, "unclaimed", currentStaffId)
      );
    } else if (statusFilter === "claimed") {
      rows = safeTickets.filter((ticket) =>
        statusMatchesFilter(ticket, "claimed", currentStaffId)
      );
    } else if (statusFilter === "my_claimed") {
      rows = safeTickets.filter((ticket) =>
        statusMatchesFilter(ticket, "my_claimed", currentStaffId)
      );
    }

    if (selectedCategoryFilter) {
      rows = rows.filter((ticket) =>
        ticketMatchesSelectedCategory(ticket, selectedCategoryFilter)
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();

      rows = rows.filter((t) =>
        [
          t.username,
          t.user_id,
          t.title,
          t.category,
          t.raw_category,
          t.matched_category_name,
          t.matched_category_slug,
          t.matched_intake_type,
          t.claimed_by,
          t.claimed_by_id,
          t.assigned_to,
          t.channel_id,
          t.discord_thread_id,
          t.closed_reason,
          t.channel_name,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (
      statusFilter !== "all" &&
      statusFilter !== "active" &&
      statusFilter !== "queue" &&
      statusFilter !== "closed" &&
      statusFilter !== "deleted" &&
      statusFilter !== "unclaimed" &&
      statusFilter !== "claimed" &&
      statusFilter !== "my_claimed"
    ) {
      rows = rows.filter((t) => statusMatchesFilter(t, statusFilter, currentStaffId));
    }

    if (priorityFilter !== "all") {
      rows = rows.filter(
        (t) => String(t.priority || "").toLowerCase() === priorityFilter
      );
    }

    return sortTickets(rows, sortBy);
  }, [
    safeTickets,
    safeActiveTickets,
    safeClosedTickets,
    selectedCategoryFilter,
    search,
    statusFilter,
    priorityFilter,
    sortBy,
    currentStaffId,
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
    ({ status = "queue", priority = "all", query = "" } = {}) => {
      setStatusFilter(status);
      setPriorityFilter(priority);
      setSelectedCategoryFilter(null);
      if (typeof query === "string") setSearch(query);
      handleTabChange("tickets", { resetToTop: true });
    },
    [handleTabChange]
  );

  const jumpToPanel = useCallback(
    (panelName) => {
      openOnlyPanel(panelName);
      handleTabChange("home", { preserveScroll: true });

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
            }
          });
        });
      }
    },
    [handleTabChange, openOnlyPanel]
  );

  const lastRefreshLabel = timeAgo(lastRefreshAtRef.current);

  const sectionVisibility = preferences?.sectionVisibility || {};
  const homeLayout = preferences?.layout?.home || [];
  const membersLayout = preferences?.layout?.members || [];
  const density = preferences?.density || "comfortable";
  const theme = preferences?.theme || {};
  const effectsMode = theme?.effectsMode || "full";

  const handleFindTicketsByCategory = useCallback((category) => {
    setSelectedCategoryFilter(category || null);
    setSearch("");
    setStatusFilter("queue");
    setPriorityFilter("all");
    handleTabChange("tickets", { resetToTop: true });
  }, [handleTabChange]);

  const clearTicketFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("queue");
    setPriorityFilter("all");
    setSelectedCategoryFilter(null);
  }, []);

  const mobileExtraActions = useMemo(
    () => [
      {
        key: "warns",
        label: "Open Warns",
        icon: "⚠️",
        onClick: () => jumpToPanel("warns"),
      },
      {
        key: "raids",
        label: "Open Raids",
        icon: "🚨",
        onClick: () => jumpToPanel("raids"),
      },
      {
        key: "fraud",
        label: "Open Fraud",
        icon: "🕵️",
        onClick: () => jumpToPanel("fraud"),
      },
    ],
    [jumpToPanel]
  );

  const homeSections = {
    intelligence: (
      <IntelligencePanel
        intelligence={intelligence}
        expanded={expandedPanels.intelligence}
        onToggle={() => togglePanel("intelligence")}
        onJumpToTickets={() => jumpToTickets({ status: "queue" })}
        onJumpToWarns={() => jumpToPanel("warns")}
        onJumpToRaids={() => jumpToPanel("raids")}
        onJumpToFraud={() => jumpToPanel("fraud")}
      />
    ),
    stats: (
      <div className="metrics-grid">
        <ClickableStatCard
          title="Open Tickets"
          value={enhancedCounts.queueTotal}
          subtitle="Tap to open queue"
          onClick={() => jumpToTickets({ status: "queue" })}
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
        subtitle={`${safeEvents.length} recent activity records loaded`}
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
              onClick={() => jumpToTickets({ status: "queue" })}
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
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  {safeText(warn?.reason, "No reason provided")}
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
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
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  Join count: {safeText(raid?.join_count, "—")} • Window:{" "}
                  {safeText(raid?.window_seconds, "—")}s • Severity:{" "}
                  {safeText(raid?.severity, "unknown")}
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
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
                  <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                    Score: {safeText(fraud?.score, "0")} • Flagged:{" "}
                    {String(Boolean(fraud?.flagged))}
                  </div>

                  {Array.isArray(fraud?.reasons) && fraud.reasons.length ? (
                    <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
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
                    <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                      Role state: {safeText(member?.role_state)}
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
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
        <div className="profile-scroll-safe-zone">
          <MemberSnapshot members={safeMembers} />
        </div>
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
        <div className="profile-scroll-safe-zone">
          <MemberSearchCard
            currentStaffId={currentStaffId}
            onRefresh={() => refresh({ force: true, reason: "member-search-action" })}
          />
        </div>
      </DashboardSection>
    ),
  };

  const desktopCategorySection = (
    <CategoryManager
      categories={safeCategories}
      tickets={safeTickets}
      onRefresh={() => refresh({ force: true, reason: "categories" })}
      onFindTicketsByCategory={handleFindTicketsByCategory}
    />
  );

  const commonRefreshCard = (
    <div
      className="card dashboard-refresh-card"
      style={{ marginBottom: 14, padding: 12 }}
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
          {isModalPaused ? " • refresh paused while another modal is open" : ""}
        </div>

        <div
          className="dashboard-refresh-actions"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 120 }}
            onClick={() => {
              rememberCurrentScroll();
              setSettingsOpen(true);
            }}
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
              handleSyncActiveTickets({
                dryRun: false,
                includeClosedVisibleChannels: true,
              })
            }
          >
            {isMaintaining ? "Working..." : "Sync Active"}
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
  );

  const themeVars = {
    "--accent": theme?.accent || "#45d483",
    "--accent2": theme?.accent2 || "#3b82f6",
    "--text-strong": theme?.textStrong || "#f8fafc",
    "--text-muted": theme?.textMuted || "#b8c0cc",
  };

  return (
    <>
      <Topbar />

      <div
        className={`dashboard-page-shell ${getEffectsModeClass(effectsMode)} density-${density}`}
        style={{
          ...themeVars,
          paddingBottom: isDesktopLayout
            ? 32
            : `calc(${MOBILE_NAV_RESERVED_PX}px + env(safe-area-inset-bottom, 0px) + 8px)`,
        }}
      >
        {isDesktopLayout ? (
          <>
            <div className="desktop-only-nav">
              <DesktopTabBar activeTab={activeTab} onChange={handleTabChange} />
            </div>

            {commonRefreshCard}

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
              counts={enhancedCounts}
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
                  queueMode={statusFilter}
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
              density={density}
            />
          </>
        ) : (
          <>
            {commonRefreshCard}

            {error ? (
              <div className="error-banner" style={{ marginBottom: 14 }}>
                {error}
              </div>
            ) : null}

            {maintenanceError ? (
              <div className="error-banner" style={{ marginBottom: 14 }}>
                {maintenanceError}
              </div>
            ) : null}

            {maintenanceMessage ? (
              <div className="info-banner" style={{ marginBottom: 14 }}>
                {maintenanceMessage}
              </div>
            ) : null}

            {isRefreshing ? (
              <div className="info-banner" style={{ marginBottom: 14 }}>
                Refreshing dashboard…
              </div>
            ) : null}

            <section className={`mobile-tab-panel ${activeTab === "home" ? "active" : ""}`}>
              <div className="dashboard-home-grid">
                {homeLayout
                  .filter((key) => sectionVisibility[key] !== false)
                  .map((key) => (
                    <div key={`home-${key}`}>{homeSections[key] || null}</div>
                  ))}
              </div>
            </section>

            <section className={`mobile-tab-panel ${activeTab === "tickets" ? "active" : ""}`}>
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
                      Live moderation queue with claim-state, repair, transcript, and filtering controls
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="button ghost"
                      style={{ width: "auto", minWidth: 120 }}
                      onClick={clearTicketFilters}
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
                        handleSyncActiveTickets({
                          dryRun: false,
                          includeClosedVisibleChannels: true,
                        })
                      }
                    >
                      {isMaintaining ? "Working..." : "Sync Active"}
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

                {selectedCategoryFilter ? (
                  <div className="info-banner" style={{ marginBottom: 14 }}>
                    Filtering tickets by category:{" "}
                    <strong>
                      {selectedCategoryFilter?.name ||
                        selectedCategoryFilter?.slug ||
                        "Selected Category"}
                    </strong>
                  </div>
                ) : null}

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
                    placeholder="Search tickets, categories, intake types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

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

                <div className="profile-scroll-safe-zone">
                  <TicketQueueTable
                    tickets={filteredTickets}
                    currentStaffId={currentStaffId}
                    queueMode={statusFilter}
                    onRefresh={() =>
                      refresh({ force: true, reason: "ticket-controls" })
                    }
                  />
                </div>
              </div>
            </section>

            <section className={`mobile-tab-panel ${activeTab === "members" ? "active" : ""}`}>
              <div className="dashboard-members-grid">
                {[...membersLayout]
                  .filter((key, index, arr) => arr.indexOf(key) === index)
                  .filter((key) => sectionVisibility[key] !== false)
                  .map((key) => (
                    <div key={`members-${key}`}>{membersSections[key] || null}</div>
                  ))}
              </div>
            </section>

            <section className={`mobile-tab-panel ${activeTab === "categories" ? "active" : ""}`}>
              {sectionVisibility.categories !== false ? (
                <div className="profile-scroll-safe-zone">
                  <CategoryManager
                    categories={safeCategories}
                    tickets={safeTickets}
                    onRefresh={() => refresh({ force: true, reason: "categories" })}
                    onFindTicketsByCategory={handleFindTicketsByCategory}
                  />
                </div>
              ) : (
                <div className="empty-state">
                  Categories is hidden in your personalization settings.
                </div>
              )}
            </section>

            <MobileBottomNav
              activeTab={activeTab}
              onChange={(tab) => handleTabChange(tab, { preserveScroll: true })}
              tabs={MOBILE_TABS}
              title="Staff jumps"
              actionButtonLabel="Actions"
              extraActions={mobileExtraActions}
            />
          </>
        )}
      </div>

      <DashboardSettingsPanel
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              restoreTabScroll(activeTabRef.current, 0);
            });
          });
        }}
        preferences={preferences}
        profiles={profiles}
        activeProfileId={activeProfileId}
        lastUsedProfileId={lastUsedProfileId}
        setThemeValue={setThemeValue}
        setDensity={setDensity}
        toggleSectionVisibility={toggleSectionVisibility}
        moveSection={moveSection}
        resetPreferences={resetPreferences}
        saveProfile={saveProfile}
        saveActiveProfile={saveActiveProfile}
        loadProfile={loadProfile}
        renameProfile={renameProfile}
        deleteProfile={deleteProfile}
      />

      <style jsx>{`
        .dashboard-page-shell {
          position: relative;
          min-height: 100vh;
        }

        .dashboard-page-shell.effects-reduced :global(.card),
        .dashboard-page-shell.effects-reduced :global(.button),
        .dashboard-page-shell.effects-reduced :global(.input) {
          backdrop-filter: none !important;
          filter: none !important;
        }

        .dashboard-page-shell.effects-minimal :global(.card),
        .dashboard-page-shell.effects-minimal :global(.button),
        .dashboard-page-shell.effects-minimal :global(.input) {
          backdrop-filter: none !important;
          filter: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .dashboard-page-shell.density-compact .dashboard-home-grid,
        .dashboard-page-shell.density-compact .dashboard-members-grid {
          gap: 12px;
        }

        .dashboard-page-shell.density-comfortable .dashboard-home-grid,
        .dashboard-page-shell.density-comfortable .dashboard-members-grid {
          gap: 16px;
        }

        .dashboard-page-shell.density-spacious .dashboard-home-grid,
        .dashboard-page-shell.density-spacious .dashboard-members-grid {
          gap: 22px;
        }

        .desktop-only-nav {
          display: block;
        }

        .dashboard-home-grid,
        .dashboard-members-grid {
          display: grid;
          align-items: start;
          overflow: visible;
        }

        .dashboard-section-shell,
        .dashboard-section-body,
        .profile-scroll-safe-zone {
          overflow: visible !important;
          min-height: 0;
        }

        .profile-scroll-safe-zone {
          position: relative;
          z-index: 1;
          padding-bottom: 8px;
        }

        .mobile-tab-panel {
          display: none;
          overflow: visible;
        }

        .mobile-tab-panel.active {
          display: block;
          padding-bottom: 8px;
        }

        .intelligence-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .intel-tile {
          border-radius: 14px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          display: grid;
          gap: 6px;
        }

        .detail-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .compact-detail-card {
          padding: 14px;
        }

        .detail-card-title {
          font-weight: 800;
          margin-bottom: 8px;
        }

        .detail-list {
          display: grid;
          gap: 6px;
          font-size: 13px;
          line-height: 1.45;
        }

        @media (min-width: 1024px) {
          .mobile-tab-panel {
            display: none !important;
          }
        }

        @media (max-width: 1023px) {
          .desktop-only-nav {
            display: none;
          }

          .dashboard-refresh-card {
            margin-bottom: 12px !important;
            padding: 10px !important;
          }

          .dashboard-refresh-actions {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
