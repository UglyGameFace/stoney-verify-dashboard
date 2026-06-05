// ============================================================
// File: components/DashboardClient.js
// Purpose:
//   Main dashboard workspace shell.
//   This version reduces stacked control clutter, improves
//   ticket-first workflow on desktop/mobile, and makes the
//   workspace feel more like one operator surface.
// ============================================================

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

const WORKSPACE_TAB_META = {
  home: {
    label: "Overview",
    eyebrow: "Moderation Workspace",
    title: "Overview Control Room",
    subtitle:
      "Risk, activity, and moderation pressure in one place so staff knows what matters first.",
  },
  tickets: {
    label: "Tickets",
    eyebrow: "Moderation Workspace",
    title: "Live Ticket Operations",
    subtitle:
      "Queue-first workspace for faster claiming, quicker scanning, and fewer accidental maintenance clicks.",
  },
  members: {
    label: "Members",
    eyebrow: "Moderation Workspace",
    title: "Member Investigation Desk",
    subtitle:
      "Search people fast, inspect history, and jump back into ticket action without losing context.",
  },
  categories: {
    label: "Categories",
    eyebrow: "Moderation Workspace",
    title: "Routing + Intake Lab",
    subtitle:
      "Tune category logic and jump straight into the ticket flows those categories feed.",
  },
};

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

function firstPresent(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return null;
}

function getStaffUserId(initialData, staffName, initialStaffId = null) {
  const possible = firstPresent(
    initialStaffId,
    initialData?.staffUserId,
    initialData?.staff_user_id,
    initialData?.viewer?.discord_id,
    initialData?.viewer?.user_id,
    initialData?.viewer?.id,
    initialData?.auth?.discord_id,
    initialData?.auth?.user_id,
    initialData?.auth?.id,
    initialData?.member?.user_id,
    initialData?.profile?.user_id
  );

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

function DesktopWorkspaceBar({
  activeTab,
  onChange,
  onRefresh,
  onOpenSettings,
  lastRefreshLabel,
  isRefreshing,
  isModalPaused,
  counts,
  intelligence,
  jumpToTickets,
  jumpToPanel,
}) {
  const meta = WORKSPACE_TAB_META[activeTab] || WORKSPACE_TAB_META.home;

  return (
    <>
      <div className="card desktop-workspace-bar">
        <div className="desktop-workspace-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="desktop-workspace-eyebrow">{meta.eyebrow}</div>
            <div className="desktop-workspace-title">{meta.title}</div>
            <div className="muted desktop-workspace-copy">{meta.subtitle}</div>
          </div>

          <div className="desktop-workspace-cta-row">
            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 132 }}
              onClick={onOpenSettings}
            >
              Personalize UI
            </button>

            <button
              type="button"
              className="button"
              style={{ width: "auto", minWidth: 136 }}
              onClick={onRefresh}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Now"}
            </button>
          </div>
        </div>

        <div className="desktop-workspace-tab-row">
          {MOBILE_TABS.map((tab) => {
            const tabMeta = WORKSPACE_TAB_META[tab] || {
              label: tab.charAt(0).toUpperCase() + tab.slice(1),
            };
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                className={`desktop-workspace-tab ${active ? "active" : ""}`}
                onClick={() => onChange(tab, { preserveScroll: true })}
              >
                <span className="desktop-workspace-tab-label">{tabMeta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="desktop-workspace-status-row">
          <button
            type="button"
            className={`desktop-status-pill ${activeTab === "tickets" ? "active" : ""}`}
            onClick={() => jumpToTickets({ status: "queue" })}
          >
            <span>Queue</span>
            <strong>{Number(counts?.queueTotal || 0)}</strong>
          </button>

          <button
            type="button"
            className="desktop-status-pill"
            onClick={() => jumpToTickets({ status: "unclaimed" })}
          >
            <span>Unclaimed</span>
            <strong>{Number(counts?.queueUnclaimed || 0)}</strong>
          </button>

          <button
            type="button"
            className="desktop-status-pill"
            onClick={() => jumpToTickets({ status: "claimed" })}
          >
            <span>Claimed</span>
            <strong>{Number(counts?.queueClaimed || 0)}</strong>
          </button>

          <button
            type="button"
            className="desktop-status-pill"
            onClick={() => jumpToPanel("fraud")}
          >
            <span>Fraud Flags</span>
            <strong>{Number(counts?.fraudFlags || 0)}</strong>
          </button>

          <button
            type="button"
            className="desktop-status-pill"
            onClick={() => jumpToTickets({ status: "queue" })}
          >
            <span>Pending Verify</span>
            <strong>{Number(intelligence?.pendingVerification || 0)}</strong>
          </button>
        </div>

        <div className="desktop-workspace-footer">
          <div className="desktop-workspace-footer-meta">
            <span>Last successful refresh: {lastRefreshLabel}</span>
            {isModalPaused ? <span>Refresh paused while another modal is open</span> : null}
          </div>
        </div>
      </div>

      <style jsx>{`
        .desktop-workspace-bar {
          padding: 18px;
          margin-bottom: 16px;
          border-radius: 26px;
          box-shadow: var(--shadow-strong), var(--glow-green);
        }

        .desktop-workspace-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .desktop-workspace-eyebrow {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .desktop-workspace-title {
          font-size: clamp(28px, 3vw, 40px);
          line-height: 0.98;
          letter-spacing: -0.045em;
          font-weight: 900;
          color: var(--text-strong);
          text-shadow:
            0 0 18px rgba(93, 255, 141, 0.08),
            0 0 18px rgba(99, 213, 255, 0.06);
        }

        .desktop-workspace-copy {
          margin-top: 8px;
          max-width: 860px;
          line-height: 1.55;
        }

        .desktop-workspace-cta-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .desktop-workspace-tab-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          padding: 10px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 12px;
        }

        .desktop-workspace-tab {
          min-height: 48px;
          padding: 12px 16px;
          border-radius: 16px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.02);
          color: var(--muted);
          font-weight: 800;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .desktop-workspace-tab:hover,
        .desktop-workspace-tab.active {
          color: white;
          background:
            linear-gradient(135deg, rgba(93, 255, 141, 0.18), rgba(99, 213, 255, 0.16));
          border-color: rgba(93, 255, 141, 0.18);
          box-shadow: var(--glow-green);
        }

        .desktop-workspace-tab-label {
          display: block;
          line-height: 1;
        }

        .desktop-workspace-status-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }

        .desktop-status-pill {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
          color: var(--text);
          min-height: 52px;
          padding: 12px 14px;
          cursor: pointer;
          transition: 0.16s ease;
          text-align: left;
        }

        .desktop-status-pill:hover,
        .desktop-status-pill.active {
          border-color: rgba(99, 213, 255, 0.2);
          background: rgba(99, 213, 255, 0.08);
          box-shadow: var(--glow-blue);
        }

        .desktop-status-pill span {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.2;
        }

        .desktop-status-pill strong {
          font-size: 18px;
          font-weight: 900;
          color: var(--text-strong);
          line-height: 1;
        }

        .desktop-workspace-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .desktop-workspace-footer-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.5;
        }

        @media (max-width: 1399px) {
          .desktop-workspace-status-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1199px) {
          .desktop-workspace-status-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  );
}

function MobileWorkspaceBar({
  activeTab,
  onRefresh,
  onOpenSettings,
  lastRefreshLabel,
  isRefreshing,
  isModalPaused,
}) {
  const meta = WORKSPACE_TAB_META[activeTab] || WORKSPACE_TAB_META.home;

  return (
    <>
      <div className="card mobile-workspace-bar">
        <div className="mobile-workspace-top">
          <div style={{ minWidth: 0 }}>
            <div className="mobile-workspace-eyebrow">{meta.label}</div>
            <div className="mobile-workspace-title">{meta.title}</div>
            <div className="muted mobile-workspace-copy">{meta.subtitle}</div>
          </div>
        </div>

        <div className="mobile-workspace-meta">
          <span>Last refresh: {lastRefreshLabel}</span>
          {isModalPaused ? <span>Paused while modal is open</span> : null}
        </div>

        <div className="mobile-workspace-actions">
          <button type="button" className="button ghost" onClick={onOpenSettings}>
            Personalize UI
          </button>
          <button type="button" className="button" onClick={onRefresh}>
            {isRefreshing ? "Refreshing..." : "Refresh Now"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .mobile-workspace-bar {
          padding: 14px;
          margin-bottom: 12px;
          border-radius: 22px;
        }

        .mobile-workspace-top {
          margin-bottom: 12px;
        }

        .mobile-workspace-eyebrow {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .mobile-workspace-title {
          font-size: 24px;
          line-height: 1.02;
          letter-spacing: -0.04em;
          font-weight: 900;
          color: var(--text-strong);
        }

        .mobile-workspace-copy {
          margin-top: 8px;
          line-height: 1.5;
          font-size: 13px;
        }

        .mobile-workspace-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.45;
          margin-bottom: 12px;
        }

        .mobile-workspace-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        @media (max-width: 479px) {
          .mobile-workspace-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

export default function DashboardClient({
  initialData,
  staffName,
  initialStaffId = null,
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
  const [showMobileTicketFilters, setShowMobileTicketFilters] = useState(false);
  const [showMobileTicketMaintenance, setShowMobileTicketMaintenance] = useState(false);

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
    () => getStaffUserId(initialData, staffName, initialStaffId),
    [initialData, staffName, initialStaffId]
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
    "message": "Seed dashboard staff identity from server session",
    "sha": "b19defbe92d557b155bca56f41ffad565aa19637",
    "branch": "main"
  }