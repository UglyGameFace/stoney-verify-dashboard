"use client";

import { useEffect, useMemo, useState } from "react";
import QuickActions from "@/components/QuickActions";
import MobileBottomNav from "@/components/MobileBottomNav";

const DASHBOARD_TABS = ["home", "tickets", "members", "categories"];
const HOME_HASH_TARGETS = ["home", "actions", "activity"];
const SCROLL_TARGET_ALIASES = {
  activity: "actions",
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function countOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function modSignalsTag(counts) {
  const warns = countOrNull(counts?.warnsToday);
  const raids = countOrNull(counts?.raidAlerts);
  const fraud = countOrNull(counts?.fraudFlags);
  const total = Number(warns || 0) + Number(raids || 0) + Number(fraud || 0);
  return total > 0 ? String(total) : "Review";
}

function getHashTarget(value) {
  return String(value || "").replace(/^#/, "").trim().toLowerCase();
}

function normalizeTab(value) {
  const text = getHashTarget(value);
  if (DASHBOARD_TABS.includes(text)) return text;
  if (HOME_HASH_TARGETS.includes(text)) return "home";
  return "home";
}

function getHashTab() {
  if (typeof window === "undefined") return "home";
  return normalizeTab(window.location.hash);
}

function scrollToHashTarget(hashValue) {
  if (typeof document === "undefined") return;
  const rawTarget = getHashTarget(hashValue);
  if (!rawTarget) return;
  const target = SCROLL_TARGET_ALIASES[rawTarget] || rawTarget;
  window.setTimeout(() => {
    document.getElementById(target)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, 0);
}

function getStaffId(data, initialStaffId) {
  return safeText(
    initialStaffId ||
      data?.staffUserId ||
      data?.staff_user_id ||
      data?.viewer?.discord_id ||
      data?.viewer?.user_id ||
      data?.viewer?.id ||
      data?.auth?.discord_id ||
      data?.auth?.user_id ||
      data?.auth?.id ||
      data?.member?.user_id ||
      data?.profile?.user_id,
    ""
  );
}

function Row({ title, subtitle, tag }) {
  return (
    <div className="card lite-row">
      <div>
        <strong>{safeText(title, "Item")}</strong>
        <div className="muted">{safeText(subtitle, "Loaded from dashboard data")}</div>
      </div>
      {tag ? <span className="badge">{tag}</span> : null}
    </div>
  );
}

function List({ rows, type }) {
  const items = safeArray(rows).slice(0, 12);
  if (!items.length) return <div className="card empty-state">No {type} loaded yet.</div>;
  return (
    <div className="space">
      {items.map((item, index) => (
        <Row
          key={item?.id || item?.user_id || item?.channel_id || index}
          title={item?.title || item?.display_name || item?.username || item?.name || item?.channel_name || type}
          subtitle={item?.description || item?.category || item?.role_state || item?.status || item?.slug}
          tag={item?.status || item?.intake_type || item?.member_status}
        />
      ))}
    </div>
  );
}

export default function DashboardClient({ initialData, staffName, initialStaffId = null }) {
  const [data, setData] = useState(initialData || {});
  const [tab, setTab] = useState("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const staffId = useMemo(() => getStaffId(data, initialStaffId), [data, initialStaffId]);
  const tickets = safeArray(data?.tickets || data?.activeTickets);
  const members = safeArray(data?.guildMembers || data?.members || data?.memberRows);
  const categories = safeArray(data?.categories);
  const counts = data?.counts || {};

  useEffect(() => {
    const syncTabFromHash = () => {
      const nextTab = getHashTab();
      setTab(nextTab);
      scrollToHashTarget(window.location.hash);
    };

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  function selectTab(nextTab) {
    const normalized = normalizeTab(nextTab);
    setTab(normalized);
    if (typeof window !== "undefined") {
      const nextHash = normalized === "home" ? "" : `#${normalized}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
      }
    }
  }

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/live?_ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error || "Failed to refresh dashboard.");
      setData(json);
    } catch (err) {
      setError(err?.message || "Failed to refresh dashboard.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lite-shell">
      <div className="card lite-hero">
        <div>
          <div className="muted">Moderation Workspace</div>
          <h1>Dashboard Control Room</h1>
          <p className="muted">Signed in as {safeText(staffName, "Staff")}. Data is scoped to the selected server.</p>
        </div>
        <button className="button ghost" type="button" onClick={refresh} disabled={busy}>{busy ? "Refreshing..." : "Refresh"}</button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card lite-tabs" id="dashboard-tabs">
        {DASHBOARD_TABS.map((item) => (
          <button key={item} type="button" className={`button ${tab === item ? "primary" : "ghost"}`} onClick={() => selectTab(item)}>
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "home" ? (
        <div className="space" id="home">
          <div className="lite-grid">
            <Row title="Open Tickets" subtitle="Current dashboard count" tag={String(Number(counts?.openTickets || tickets.length || 0))} />
            <Row title="Mod Signals" subtitle="Warnings, raids, and fraud flags need source review before trusting zero." tag={modSignalsTag(counts)} />
            <Row title="Ready Categories" subtitle="Configured ticket routes" tag={String(categories.length)} />
            <Row title="Tracked Members" subtitle="Loaded member rows" tag={String(members.length)} />
          </div>
          <div id="actions" className="dashboard-anchor-target">
            <QuickActions onRefresh={refresh} currentStaffId={staffId} />
          </div>
        </div>
      ) : tab === "tickets" ? (
        <div id="tickets"><List rows={tickets} type="tickets" /></div>
      ) : tab === "members" ? (
        <div id="members"><List rows={members} type="members" /></div>
      ) : (
        <div id="categories"><List rows={categories} type="categories" /></div>
      )}

      <MobileBottomNav activeTab={tab} onChange={selectTab} />

      <style jsx>{`
        .lite-shell { display: grid; gap: 16px; padding-bottom: 110px; }
        .lite-hero { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .lite-hero h1 { margin: 0; font-size: clamp(30px, 5vw, 48px); line-height: 1; }
        .lite-tabs { display: flex; gap: 10px; flex-wrap: wrap; scroll-margin-top: 18px; }
        .lite-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
        .lite-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px; }
        .dashboard-anchor-target { scroll-margin-top: 18px; }
        @media (max-width: 720px) { .lite-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
    </div>
  );
}
