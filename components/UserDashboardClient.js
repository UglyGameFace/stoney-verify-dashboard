"use client";

import { useEffect, useRef, useState } from "react";
import Topbar from "@/components/Topbar";
import MobileBottomNav from "@/components/MobileBottomNav";

const USER_TABS = ["home", "tickets", "account"];

const FALLBACK_CATEGORIES = [
  {
    id: "fallback-verification",
    name: "Verification",
    slug: "verification",
    description: "Help with pending verification or missing verified access.",
    intake_type: "verification",
    button_label: "Open Verification Ticket",
    is_default: true,
  },
  {
    id: "fallback-appeal",
    name: "Appeal",
    slug: "appeal",
    description: "Appeal a moderation action or request a review.",
    intake_type: "appeal",
    button_label: "Open Appeal Ticket",
    is_default: false,
  },
  {
    id: "fallback-report",
    name: "Report / Incident",
    slug: "report",
    description: "Report a member, suspicious activity, scam, abuse, or another incident.",
    intake_type: "report",
    button_label: "Open Report Ticket",
    is_default: false,
  },
  {
    id: "fallback-question",
    name: "Question",
    slug: "question",
    description: "General support questions, access issues, or guidance.",
    intake_type: "question",
    button_label: "Open Question Ticket",
    is_default: false,
  },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeCount(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
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

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function getVisibleCategories(categories) {
  const rows = safeArray(categories).filter((item) => item && item.name);
  return rows.length ? rows : FALLBACK_CATEGORIES;
}

function getVerificationState(member, verificationFlags = [], viewer = {}) {
  const viewerVerification = String(viewer?.verification_label || "").trim();

  if (member?.has_staff_role) return { label: "Staff", tone: "low" };
  if (member?.has_verified_role) return { label: "Verified", tone: "low" };
  if (member?.has_unverified) return { label: "Pending Verification", tone: "medium" };

  if (viewerVerification) {
    const normalized = normalizeLabel(viewerVerification);

    if (normalized.includes("staff")) return { label: "Staff", tone: "low" };
    if (normalized.includes("verified")) return { label: "Verified", tone: "low" };
    if (normalized.includes("pending")) {
      return { label: "Pending Verification", tone: "medium" };
    }
    if (normalized.includes("review")) return { label: "Needs Review", tone: "danger" };
    if (normalized.includes("not synced")) return { label: "Not Synced Yet", tone: "warn" };

    return { label: viewerVerification, tone: "warn" };
  }

  if (safeArray(verificationFlags).some((f) => Boolean(f?.flagged))) {
    return { label: "Needs Review", tone: "danger" };
  }

  return { label: "Not Synced Yet", tone: "warn" };
}

function getAccessLabel(member, viewer = {}) {
  if (member?.has_staff_role) return "Staff";
  if (member?.has_verified_role) return "Verified";
  if (member?.has_unverified) return "Limited";

  const viewerAccess = String(viewer?.access_label || "").trim();
  if (viewerAccess) {
    const normalized = normalizeLabel(viewerAccess);
    if (normalized.includes("staff")) return "Staff";
    if (normalized.includes("verified")) return "Verified";
    if (normalized.includes("limited")) return "Limited";
    if (normalized.includes("not synced")) return "Not Synced Yet";
    return viewerAccess;
  }

  return "Not Synced Yet";
}

function getRoleSummary(member, viewer = {}) {
  const names = Array.isArray(member?.role_names)
    ? member.role_names
    : Array.isArray(viewer?.role_names)
      ? viewer.role_names
      : [];
  return names.filter(Boolean).slice(0, 16);
}

function getDisplayName(viewer, member) {
  return (
    member?.display_name ||
    member?.global_name ||
    viewer?.display_name ||
    viewer?.global_name ||
    viewer?.username ||
    "Member"
  );
}

function getUsername(viewer, member) {
  return member?.username || viewer?.username || "Unknown";
}

function getMemberAvatarUrl(viewer, member) {
  const candidates = [
    member?.avatar_url,
    viewer?.avatar_url,
    viewer?.avatar,
    viewer?.image,
    viewer?.picture,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }

  return "";
}

function buildDiscordChannelUrl(ticket, initialData) {
  const guildId =
    initialData?.guildId ||
    initialData?.viewer?.guild_id ||
    initialData?.member?.guild_id ||
    initialData?.guild_id ||
    "";

  const channelId = String(ticket?.channel_id || "").trim();

  if (!guildId || !channelId) return "";
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

function buildTicketSummary(ticket) {
  return [
    `Title: ${safeText(ticket?.title)}`,
    `Category: ${safeText(ticket?.matched_category_name || ticket?.category)}`,
    `Status: ${safeText(ticket?.status)}`,
    `Priority: ${safeText(ticket?.priority)}`,
    `Channel: ${safeText(ticket?.channel_name)}`,
    `Channel ID: ${safeText(ticket?.channel_id)}`,
    `Created: ${safeText(ticket?.created_at)}`,
    `Updated: ${safeText(ticket?.updated_at)}`,
    `Claimed By: ${safeText(ticket?.claimed_by)}`,
    `Closed Reason: ${safeText(ticket?.closed_reason)}`,
  ].join("\n");
}

function formatEventTypeLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Activity";
  return raw
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getActivityTimestamp(event) {
  return event?.created_at || event?.updated_at || null;
}

function buildTicketLookup(tickets) {
  const map = new Map();

  safeArray(tickets).forEach((ticket) => {
    if (ticket?.id) {
      map.set(String(ticket.id), ticket);
    }
  });

  return map;
}

function resolveActivityTicket(event, ticketLookup) {
  const possibleIds = [
    event?.ticket_id,
    event?.source_ticket_id,
    event?.verification_ticket_id,
    event?.metadata?.ticket_id,
    event?.metadata?.source_ticket_id,
    event?.metadata?.verification_ticket_id,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  for (const id of possibleIds) {
    if (ticketLookup.has(id)) return ticketLookup.get(id);
  }

  return null;
}

function getActivityTitle(event) {
  const directTitle = String(event?.title || "").trim();
  if (directTitle) return directTitle;
  return formatEventTypeLabel(event?.event_type || event?.type || event?.action);
}

function getActivityReason(event) {
  const candidates = [
    event?.reason,
    event?.message,
    event?.description,
    event?.metadata?.reason,
    event?.metadata?.message,
    event?.metadata?.description,
    event?.metadata?.note_body,
    event?.metadata?.content,
    event?.metadata?.summary,
    event?.metadata?.status_text,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text) return text;
  }

  return "";
}

function getActivityActor(event) {
  const candidates = [
    event?.actor_name,
    event?.staff_name,
    event?.metadata?.actor_name,
    event?.metadata?.staff_name,
    event?.metadata?.approved_by_name,
    event?.actor_id,
    event?.staff_id,
    event?.metadata?.actor_id,
    event?.metadata?.staff_id,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text) return text;
  }

  return "System";
}

function getActivityTicketLabel(event, ticketLookup) {
  const matchedTicket = resolveActivityTicket(event, ticketLookup);
  if (matchedTicket) {
    return safeText(
      matchedTicket?.title || matchedTicket?.channel_name || matchedTicket?.channel_id,
      "Linked Ticket"
    );
  }

  const candidates = [
    event?.metadata?.ticket_title,
    event?.metadata?.title,
    event?.metadata?.channel_name,
    event?.metadata?.ticket_channel_name,
    event?.metadata?.ticket_id,
    event?.ticket_id,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text) return text;
  }

  return "Ticket Activity";
}

function getDashboardEntry(initialData, member) {
  const entry = safeObject(initialData?.entry);

  return {
    joined_at: entry?.joined_at || member?.joined_at || null,
    join_source: entry?.join_source || null,
    entry_method: entry?.entry_method || entry?.join_source || null,
    invite_code: entry?.invite_code || null,
    inviter_id: entry?.inviter_id || null,
    inviter_name: entry?.inviter_name || null,
    vanity_used: Boolean(entry?.vanity_used),
  };
}

function getLatestVcSession(initialData) {
  return (
    safeArray(initialData?.vcSessions)
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
      )[0] || null
  );
}

function getDashboardVerificationSummary(initialData, member, verificationFlags, viewer) {
  const fallback = getVerificationState(member, verificationFlags, viewer);
  const summary = safeObject(initialData?.verification);
  const latestVc = getLatestVcSession(initialData);

  return {
    label: safeText(summary?.status, fallback.label),
    flag_count: safeCount(summary?.flag_count, safeArray(verificationFlags).length),
    flagged_count: safeCount(
      summary?.flagged_count,
      safeArray(verificationFlags).filter((item) => item?.flagged).length
    ),
    latest_flag_at: summary?.latest_flag_at || null,
    vc_latest_status: safeText(summary?.vc_latest_status, latestVc?.status || "—"),
    vc_request_count: safeCount(summary?.vc_request_count, safeArray(initialData?.vcSessions).length),
    vc_completed_count: safeCount(
      summary?.vc_completed_count,
      safeArray(initialData?.vcSessions).filter((item) => item?.completed_at).length
    ),
  };
}

function getHistoricalNameList(initialData, viewer, member) {
  const names = [];

  [
    member?.display_name,
    member?.username,
    member?.nickname,
    viewer?.display_name,
    viewer?.global_name,
    viewer?.username,
    ...safeArray(initialData?.historicalUsernames),
  ].forEach((value) => {
    const clean = String(value || "").trim();
    if (clean) names.push(clean);
  });

  safeArray(initialData?.usernameHistory).forEach((row) => {
    [row?.username, row?.display_name, row?.nickname].forEach((value) => {
      const clean = String(value || "").trim();
      if (clean) names.push(clean);
    });
  });

  return [...new Set(names)].slice(0, 20);
}

function getDashboardRelationships(initialData) {
  const relationships = safeObject(initialData?.relationships);

  return {
    invite_code: relationships?.invite_code || null,
    inviter_id: relationships?.inviter_id || null,
    inviter_name: relationships?.inviter_name || null,
    vanity_used: Boolean(relationships?.vanity_used),
    vouch_count: safeCount(relationships?.vouch_count, safeArray(initialData?.vouches).length),
    latest_vouch_at: relationships?.latest_vouch_at || null,
  };
}

function getRecentVouches(initialData) {
  return safeArray(initialData?.vouches).slice(0, 4);
}

function getPrimaryAction({ member, openTicket, verificationFlags, viewer }) {
  const hasFlags = safeArray(verificationFlags).some((f) => Boolean(f?.flagged));
  const verification = getVerificationState(member, verificationFlags, viewer);

  if (openTicket) {
    return {
      title: "You already have an open ticket",
      body: "Keep updates in that same thread so staff can help you faster.",
      primaryLabel: "View My Ticket",
      primaryTab: "tickets",
      secondaryLabel: "View Account",
      secondaryTab: "account",
      suggestedCategorySlug: null,
      tone: "low",
    };
  }

  if (member?.has_unverified || verification.label === "Pending Verification") {
    return {
      title: "You still need verification",
      body: "Open a verification ticket so staff can review your access.",
      primaryLabel: "Open Verification Ticket",
      primaryTab: "home",
      secondaryLabel: "View Account",
      secondaryTab: "account",
      suggestedCategorySlug: "verification",
      tone: "medium",
    };
  }

  if (hasFlags || verification.label === "Needs Review") {
    return {
      title: "Your account needs review",
      body: "Open a support ticket so staff can manually review your account state.",
      primaryLabel: "Open Review Ticket",
      primaryTab: "home",
      secondaryLabel: "View Account",
      secondaryTab: "account",
      suggestedCategorySlug: "verification",
      tone: "danger",
    };
  }

  if (member?.has_verified_role || verification.label === "Verified") {
    return {
      title: "You are verified",
      body: "If something still looks wrong, open the support category that best matches your issue.",
      primaryLabel: "Open Support Ticket",
      primaryTab: "home",
      secondaryLabel: "View My Tickets",
      secondaryTab: "tickets",
      suggestedCategorySlug: null,
      tone: "low",
    };
  }

  return {
    title: "Need help?",
    body: "Open the support category that best matches your issue.",
    primaryLabel: "Open Support Ticket",
    primaryTab: "home",
    secondaryLabel: "View Account",
    secondaryTab: "account",
    suggestedCategorySlug: null,
    tone: "medium",
  };
}

function StatusBadge({ label, tone = "default" }) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

function Section({ title, subtitle, children, actions = null, tone = "default" }) {
  return (
    <div className={`card member-section tone-${tone}`}>
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
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle ? (
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function OverviewTiles({ verification, openTicket, member, viewer, recentActivityCount = 0 }) {
  const accessLabel = getAccessLabel(member, viewer);

  return (
    <div className="summary-grid">
      <div className="summary-tile neon-green">
        <div className="ticket-info-label">Verification</div>
        <div className="summary-value">{verification.label}</div>
      </div>

      <div className="summary-tile neon-blue">
        <div className="ticket-info-label">Open Ticket</div>
        <div className="summary-value">{openTicket ? "Yes" : "No"}</div>
      </div>

      <div className="summary-tile neon-purple">
        <div className="ticket-info-label">Access</div>
        <div className="summary-value">{accessLabel}</div>
      </div>

      <div className="summary-tile neon-blue">
        <div className="ticket-info-label">Recent Activity</div>
        <div className="summary-value">{recentActivityCount}</div>
      </div>
    </div>
  );
}

function CurrentTicketCard({ ticket, initialData }) {
  if (!ticket) {
    return <div className="empty-state">You do not currently have an open ticket.</div>;
  }

  const discordUrl = buildDiscordChannelUrl(ticket, initialData);

  return (
    <div className="ticket-row-card emphasis">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="profile-name" style={{ fontSize: 18 }}>
            {safeText(ticket?.title, "Open Ticket")}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Updated {timeAgo(ticket?.updated_at || ticket?.created_at)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label={safeText(ticket?.status)} tone="medium" />
          <StatusBadge label={safeText(ticket?.priority)} />
        </div>
      </div>

      <div className="info-grid" style={{ marginTop: 12 }}>
        <div className="mini-card">
          <div className="ticket-info-label">Category</div>
          <div>{safeText(ticket?.matched_category_name || ticket?.category)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Channel</div>
          <div>{safeText(ticket?.channel_name || ticket?.channel_id)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Created</div>
          <div>{formatTime(ticket?.created_at)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Claimed By</div>
          <div>{safeText(ticket?.claimed_by)}</div>
        </div>
      </div>

      {discordUrl ? (
        <div style={{ marginTop: 12 }}>
          <a
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className="button ghost"
            style={{ width: "auto", minWidth: 180, textAlign: "center", textDecoration: "none" }}
          >
            Open In Discord
          </a>
        </div>
      ) : null}
    </div>
  );
}

function CategoryCard({ category, highlighted, onUseThisCategory, isCreating }) {
  return (
    <div className={`ticket-row-card category-card ${highlighted ? "emphasis" : ""}`}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="profile-name" style={{ fontSize: 16 }}>
            {safeText(category?.name)}
          </div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
            {safeText(category?.description, "No description provided.")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label={safeText(category?.intake_type, "general")} />
          {category?.is_default ? <StatusBadge label="Default" tone="low" /> : null}
          {highlighted ? <StatusBadge label="Recommended" tone="medium" /> : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button
          type="button"
          className="button primary"
          style={{ width: "auto", minWidth: 190 }}
          onClick={() => onUseThisCategory(category)}
          disabled={isCreating}
        >
          {isCreating ? "Submitting..." : safeText(category?.button_label, "Use This Category")}
        </button>
      </div>
    </div>
  );
}

function TicketActions({
  ticket,
  initialData,
  onRefreshStatus,
  onRequestReopen,
  onNotice,
}) {
  const discordUrl = buildDiscordChannelUrl(ticket, initialData);
  const isClosed = normalizeStatus(ticket?.status) === "closed";
  const isDeleted = normalizeStatus(ticket?.status) === "deleted";

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      onNotice(successMessage, "success");
    } catch {
      onNotice("Copy failed on this device.", "error");
    }
  }

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div className="action-grid">
        {discordUrl ? (
          <a
            href={discordUrl}
            target="_blank"
            rel="noreferrer"
            className="button ghost"
            style={{ width: "auto", minWidth: 150, textAlign: "center", textDecoration: "none" }}
          >
            Open In Discord
          </a>
        ) : null}

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 150 }}
          onClick={() => copyText(safeText(ticket?.channel_id, ""), "Channel ID copied.")}
        >
          Copy Channel ID
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 160 }}
          onClick={() => copyText(buildTicketSummary(ticket), "Ticket summary copied.")}
        >
          Copy Ticket Summary
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 150 }}
          onClick={onRefreshStatus}
        >
          Refresh Status
        </button>

        {isClosed && !isDeleted ? (
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 170 }}
            onClick={onRequestReopen}
          >
            Request Reopen Review
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  expanded,
  onToggle,
  initialData,
  onRefreshStatus,
  onRequestReopen,
  onNotice,
}) {
  return (
    <div className={`ticket-row-card ticket-card-shell ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="ticket-card-button"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
            <div className="profile-name" style={{ fontSize: 17 }}>
              {safeText(ticket?.title, "Ticket")}
            </div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {safeText(ticket?.matched_category_name || ticket?.category)} •{" "}
              {safeText(ticket?.channel_name || ticket?.channel_id)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label={safeText(ticket?.status)} />
            <StatusBadge label={safeText(ticket?.priority)} />
          </div>
        </div>

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div className="muted" style={{ textAlign: "left" }}>
            Updated {timeAgo(ticket?.updated_at || ticket?.created_at)}
          </div>
          <div className="muted" style={{ fontWeight: 800 }}>
            {expanded ? "Hide Actions" : "Open Actions"}
          </div>
        </div>
      </button>

      {expanded ? (
        <TicketActions
          ticket={ticket}
          initialData={initialData}
          onRefreshStatus={onRefreshStatus}
          onRequestReopen={onRequestReopen}
          onNotice={onNotice}
        />
      ) : null}
    </div>
  );
}

function ActivityCard({ event, ticketLookup }) {
  const title = getActivityTitle(event);
  const reason = getActivityReason(event);
  const actor = getActivityActor(event);
  const ticketLabel = getActivityTicketLabel(event, ticketLookup);
  const eventType = formatEventTypeLabel(event?.event_type);
  const sourceLabel = safeText(event?._source, "event");
  const timestamp = getActivityTimestamp(event);

  return (
    <div className="ticket-row-card activity-card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="profile-name" style={{ fontSize: 16 }}>
            {title}
          </div>
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
            {ticketLabel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label={eventType} tone="medium" />
          <StatusBadge label={sourceLabel} />
        </div>
      </div>

      <div className="info-grid" style={{ marginTop: 12 }}>
        <div className="mini-card">
          <div className="ticket-info-label">Actor</div>
          <div>{actor}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">When</div>
          <div>{formatTime(timestamp)}</div>
        </div>
      </div>

      {reason ? (
        <div className="mini-card" style={{ marginTop: 12 }}>
          <div className="ticket-info-label">Details</div>
          <div style={{ lineHeight: 1.6, overflowWrap: "anywhere" }}>{reason}</div>
        </div>
      ) : null}
    </div>
  );
}

function RecentActivitySection({ recentActivity, recentTickets }) {
  const ticketLookup = buildTicketLookup(recentTickets);

  return (
    <Section
      title="Recent Ticket Activity"
      subtitle={`${safeArray(recentActivity).length} recent event${safeArray(recentActivity).length === 1 ? "" : "s"} tied to your account`}
      tone="history"
    >
      {!safeArray(recentActivity).length ? (
        <div className="empty-state">No recent ticket activity has shown up yet.</div>
      ) : (
        <div className="space">
          {safeArray(recentActivity).map((event) => (
            <ActivityCard
              key={event?.id || `${event?.event_type || "event"}-${event?.created_at || Math.random()}`}
              event={event}
              ticketLookup={ticketLookup}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function HomeExtraSignals({
  initialData,
  member,
  verificationFlags,
  viewer,
  openTicket,
}) {
  const entry = getDashboardEntry(initialData, member);
  const relationships = getDashboardRelationships(initialData);
  const ticketSummary = safeObject(initialData?.ticketSummary);
  const verificationSummary = getDashboardVerificationSummary(
    initialData,
    member,
    verificationFlags,
    viewer
  );
  const historicalNames = getHistoricalNameList(initialData, viewer, member);

  return (
    <>
      <div className="info-grid" style={{ marginTop: 14 }}>
        <div className="mini-card">
          <div className="ticket-info-label">Total Tickets</div>
          <div>{safeCount(ticketSummary?.total)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Open / Claimed</div>
          <div>{safeCount(ticketSummary?.open, openTicket ? 1 : 0)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Verification Flags</div>
          <div>{safeCount(verificationSummary?.flag_count)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Joined Via</div>
          <div>{safeText(entry?.entry_method || entry?.join_source, "Unknown")}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Vouches</div>
          <div>{safeCount(relationships?.vouch_count)}</div>
        </div>

        <div className="mini-card">
          <div className="ticket-info-label">Latest VC Status</div>
          <div>{safeText(verificationSummary?.vc_latest_status, "—")}</div>
        </div>
      </div>

      {historicalNames.length > 1 ? (
        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Known Names
          </div>
          <div className="roles">
            {historicalNames.map((name) => (
              <span key={name} className="badge">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function HomeTab({
  member,
  openTicket,
  verificationFlags,
  categories,
  initialData,
  onUseCategory,
  onGoToTab,
  isCreating,
  recentActivity,
}) {
  const viewer = initialData?.viewer || {};
  const verification = getVerificationState(member, verificationFlags, viewer);
  const action = getPrimaryAction({ member, openTicket, verificationFlags, viewer });
  const visibleCategories = getVisibleCategories(categories);

  return (
    <div className="user-dashboard-grid">
      <Section title="Overview" subtitle="Your status and next step" tone="account">
        <OverviewTiles
          verification={verification}
          openTicket={openTicket}
          member={member}
          viewer={viewer}
          recentActivityCount={safeArray(recentActivity).length}
        />

        <div className={`status-panel ${action.tone}`} style={{ marginTop: 14 }}>
          <div className="status-title">{action.title}</div>
          <div className="muted" style={{ lineHeight: 1.6 }}>
            {action.body}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 14,
            }}
          >
            <button
              type="button"
              className="button primary"
              style={{ width: "auto", minWidth: 170 }}
              onClick={() => onGoToTab(action.primaryTab)}
              disabled={isCreating}
            >
              {action.primaryLabel}
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 170 }}
              onClick={() => onGoToTab(action.secondaryTab)}
              disabled={isCreating}
            >
              {action.secondaryLabel}
            </button>
          </div>
        </div>

        <HomeExtraSignals
          initialData={initialData}
          member={member}
          verificationFlags={verificationFlags}
          viewer={viewer}
          openTicket={openTicket}
        />
      </Section>

      <Section
        title="Current Ticket"
        subtitle="Your active support thread"
        tone="ticket"
      >
        <CurrentTicketCard ticket={openTicket} initialData={initialData} />
      </Section>

      <Section
        title="Support Categories"
        subtitle="Pick the category that best matches your issue"
        tone="categories"
      >
        <div className="space">
          {visibleCategories.map((category) => {
            const highlighted =
              action?.suggestedCategorySlug &&
              String(category?.slug || "").trim().toLowerCase() ===
                String(action.suggestedCategorySlug || "").trim().toLowerCase();

            return (
              <CategoryCard
                key={category.id}
                category={category}
                highlighted={highlighted}
                onUseThisCategory={onUseCategory}
                isCreating={isCreating}
              />
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function TicketsTab({
  recentTickets,
  recentActivity,
  initialData,
  isPolling,
  onRefreshAllTickets,
  onRequestReopen,
  onNotice,
}) {
  const [expandedTicketId, setExpandedTicketId] = useState(null);

  const activeTickets = safeArray(recentTickets).filter((ticket) =>
    ["open", "claimed"].includes(normalizeStatus(ticket?.status))
  );

  const closedTickets = safeArray(recentTickets)
    .filter((ticket) => normalizeStatus(ticket?.status) === "closed")
    .slice(0, 8);

  function toggleTicket(id) {
    setExpandedTicketId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="user-dashboard-grid">
      <Section
        title="Active Tickets"
        subtitle={`${activeTickets.length} active ticket${activeTickets.length === 1 ? "" : "s"}`}
        tone="ticket"
        actions={isPolling ? <span className="badge medium">Refreshing…</span> : null}
      >
        {!activeTickets.length ? (
          <div className="empty-state">You do not currently have an active ticket.</div>
        ) : (
          <div className="space">
            {activeTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                expanded={expandedTicketId === ticket.id}
                onToggle={() => toggleTicket(ticket.id)}
                initialData={initialData}
                onRefreshStatus={onRefreshAllTickets}
                onRequestReopen={() => onRequestReopen(ticket)}
                onNotice={onNotice}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Recent Closed Tickets"
        subtitle={`${closedTickets.length} recent closed ticket${closedTickets.length === 1 ? "" : "s"}`}
        tone="history"
      >
        {!closedTickets.length ? (
          <div className="empty-state">No recent closed ticket history found.</div>
        ) : (
          <div className="space">
            {closedTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                expanded={expandedTicketId === ticket.id}
                onToggle={() => toggleTicket(ticket.id)}
                initialData={initialData}
                onRefreshStatus={onRefreshAllTickets}
                onRequestReopen={() => onRequestReopen(ticket)}
                onNotice={onNotice}
              />
            ))}
          </div>
        )}
      </Section>

      <RecentActivitySection
        recentActivity={recentActivity}
        recentTickets={recentTickets}
      />
    </div>
  );
}

function AccountExtraSections({
  initialData,
  member,
  verificationFlags,
  viewer,
  recentActivity,
}) {
  const entry = getDashboardEntry(initialData, member);
  const relationships = getDashboardRelationships(initialData);
  const stats = safeObject(initialData?.stats);
  const verification = getDashboardVerificationSummary(
    initialData,
    member,
    verificationFlags,
    viewer
  );
  const latestVc = getLatestVcSession(initialData);
  const historicalNames = getHistoricalNameList(initialData, viewer, member);
  const vouches = getRecentVouches(initialData);

  return (
    <>
      <Section
        title="Verification & Activity"
        subtitle="Signals tied to your review and support history"
        tone="history"
      >
        <div className="info-grid">
          <div className="mini-card">
            <div className="ticket-info-label">Dashboard Status</div>
            <div>{verification.label}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Flag Count</div>
            <div>{safeCount(verification.flag_count)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Flagged Count</div>
            <div>{safeCount(verification.flagged_count)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Latest Flag</div>
            <div>{formatTime(verification.latest_flag_at)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Latest VC Status</div>
            <div>{safeText(verification.vc_latest_status, safeText(latestVc?.status))}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">VC Requests</div>
            <div>{safeCount(verification.vc_request_count)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">VC Completed</div>
            <div>{safeCount(verification.vc_completed_count)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Recent Activity</div>
            <div>{safeCount(stats?.activity_count, safeArray(recentActivity).length)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Recent Vouches
          </div>

          {vouches.length ? (
            <div className="space">
              {vouches.map((vouch) => (
                <div
                  key={vouch?.id || `${vouch?.actor_id || "vouch"}-${vouch?.created_at || ""}`}
                  className="mini-card"
                >
                  <div className="ticket-info-label">
                    {safeText(vouch?.actor_name || vouch?.actor_id, "Member Vouch")}
                  </div>
                  <div style={{ lineHeight: 1.6 }}>
                    {safeText(vouch?.reason, "No note provided.")}
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {formatTime(vouch?.created_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 14 }}>
              No vouch history is visible here yet.
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Name & Join History"
        subtitle="What the dashboard currently remembers about you"
        tone="account"
      >
        <div className="info-grid">
          <div className="mini-card">
            <div className="ticket-info-label">Entry Method</div>
            <div>{safeText(entry?.entry_method || entry?.join_source, "Unknown")}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Invited By</div>
            <div>{safeText(entry?.inviter_name || entry?.inviter_id, "Unknown")}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Invite Code</div>
            <div>
              {safeText(entry?.invite_code, entry?.vanity_used ? "Vanity Link" : "Unknown")}
            </div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Latest Vouch</div>
            <div>{formatTime(relationships?.latest_vouch_at)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Known Names
          </div>
          {historicalNames.length ? (
            <div className="roles">
              {historicalNames.map((name) => (
                <span key={name} className="badge">
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 14 }}>
              No historical name data is visible yet.
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

function AccountTab({ viewer, member, verificationFlags, initialData, recentActivity }) {
  const verification = getVerificationState(member, verificationFlags, viewer);
  const roles = getRoleSummary(member, viewer);
  const avatarUrl = getMemberAvatarUrl(viewer, member);
  const displayName = getDisplayName(viewer, member);
  const username = getUsername(viewer, member);
  const accessLabel = getAccessLabel(member, viewer);
  const entry = getDashboardEntry(initialData, member);

  return (
    <div className="user-dashboard-grid">
      <Section
        title="My Account"
        subtitle="Basic server identity and access details"
        tone="account"
      >
        <div className="account-header">
          <div className="account-avatar">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${displayName} avatar`}
                width="64"
                height="64"
              />
            ) : (
              <div className="account-avatar-fallback">
                <span>{String(displayName || "M").trim().charAt(0).toUpperCase() || "M"}</span>
              </div>
            )}
          </div>

          <div className="account-header-copy">
            <div className="profile-name" style={{ fontSize: 22 }}>
              {displayName}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {username}
            </div>
          </div>
        </div>

        <div className="info-grid" style={{ marginTop: 14 }}>
          <div className="mini-card">
            <div className="ticket-info-label">Discord ID</div>
            <div>{safeText(viewer?.discord_id)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Joined</div>
            <div>{formatTime(entry?.joined_at || member?.joined_at)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Verification</div>
            <div>{verification.label}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Access</div>
            <div>{accessLabel}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Entry Method</div>
            <div>{safeText(entry?.entry_method || entry?.join_source, "Unknown")}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Invited By</div>
            <div>{safeText(entry?.inviter_name || entry?.inviter_id, "Unknown")}</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="ticket-info-label" style={{ marginBottom: 8 }}>
            Roles
          </div>

          {roles.length ? (
            <div className="roles">
              {roles.map((role) => (
                <span key={role} className="badge">
                  {role}
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 14 }}>
              No roles are currently visible here.
            </div>
          )}
        </div>
      </Section>

      <AccountExtraSections
        initialData={initialData}
        member={member}
        verificationFlags={verificationFlags}
        viewer={viewer}
        recentActivity={recentActivity}
      />
    </div>
  );
}

export default function UserDashboardClient({ initialData }) {
  const [activeTab, setActiveTab] = useState("home");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("info");
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [userTickets, setUserTickets] = useState(safeArray(initialData?.recentTickets));
  const [userOpenTicket, setUserOpenTicket] = useState(initialData?.openTicket || null);
  const [userRecentActivity, setUserRecentActivity] = useState(
    safeArray(initialData?.recentActivity)
  );

  const noticeTimerRef = useRef(null);

  const viewer = initialData?.viewer || {};
  const member = initialData?.member || null;
  const categories = safeArray(initialData?.categories);
  const verificationFlags = safeArray(initialData?.verificationFlags);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function goToTab(tab) {
    if (USER_TABS.includes(tab)) {
      setActiveTab(tab);
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    }
  }

  function showTempNotice(text, tone = "info") {
    setNotice(text);
    setNoticeTone(tone);

    if (typeof window !== "undefined") {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }

      noticeTimerRef.current = window.setTimeout(() => {
        setNotice("");
        setNoticeTone("info");
      }, 3600);
    }
  }

  async function refreshTicketsNow() {
    setIsPolling(true);

    try {
      const res = await fetch(`/api/user/dashboard?_ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to refresh ticket status.");
      }

      const nextOpenTicket = data?.openTicket || null;
      const nextRecentTickets = Array.isArray(data?.recentTickets)
        ? data.recentTickets
        : [];
      const nextRecentActivity = Array.isArray(data?.recentActivity)
        ? data.recentActivity
        : [];

      setUserOpenTicket(nextOpenTicket);
      setUserTickets(nextRecentTickets);
      setUserRecentActivity(nextRecentActivity);
      showTempNotice("Ticket status refreshed.", "success");
      return Boolean(nextOpenTicket);
    } catch (error) {
      showTempNotice(
        error instanceof Error ? error.message : "Failed to refresh ticket status.",
        "error"
      );
      return false;
    } finally {
      setIsPolling(false);
    }
  }

  async function pollForCreatedTicket() {
    setIsPolling(true);

    let found = false;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, attempt === 0 ? 1500 : 2200)
      );

      try {
        const res = await fetch(`/api/user/dashboard?_ts=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, max-age=0",
            Pragma: "no-cache",
          },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) continue;

        const nextOpenTicket = data?.openTicket || null;
        const nextRecentTickets = Array.isArray(data?.recentTickets)
          ? data.recentTickets
          : [];
        const nextRecentActivity = Array.isArray(data?.recentActivity)
          ? data.recentActivity
          : [];

        setUserOpenTicket(nextOpenTicket);
        setUserTickets(nextRecentTickets);
        setUserRecentActivity(nextRecentActivity);

        if (nextOpenTicket) {
          found = true;
          break;
        }
      } catch {
        // keep polling
      }
    }

    setIsPolling(false);
    return found;
  }

  async function queueTicketForCategory(category, extraMessage = "") {
    if (isCreating) return;

    setIsCreating(true);

    try {
      const res = await fetch("/api/user/tickets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          category_slug: category?.slug || category?.intake_type || "general",
          intake_type: category?.intake_type || "general",
          message: extraMessage || "",
          priority: "medium",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409 && data?.existing_ticket) {
          const existing = data.existing_ticket;
          setUserOpenTicket(existing);
          setUserTickets((prev) => {
            const existingRows = safeArray(prev).filter((row) => row?.id !== existing.id);
            return [existing, ...existingRows];
          });
          goToTab("tickets");
          showTempNotice(
            "You already have an open ticket, so I took you to it instead.",
            "warn"
          );
          return;
        }

        if (res.status === 409 && data?.existing_command) {
          goToTab("tickets");
          showTempNotice(
            "A ticket request is already being processed. Your Discord ticket should appear shortly.",
            "warn"
          );
          void pollForCreatedTicket();
          return;
        }

        throw new Error(data?.error || "Failed to submit ticket request.");
      }

      goToTab("tickets");
      showTempNotice(
        `${safeText(category?.name, "Support")} request queued. Your Discord ticket should appear shortly.`,
        "success"
      );

      const found = await pollForCreatedTicket();

      if (!found) {
        showTempNotice(
          "Your request was queued successfully, but the ticket has not appeared in the dashboard yet. The bot may still be processing it.",
          "warn"
        );
      }
    } catch (error) {
      showTempNotice(
        error instanceof Error ? error.message : "Failed to submit ticket request.",
        "error"
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleUseCategory(category) {
    queueTicketForCategory(category);
  }

  function handleRequestReopen(ticket) {
    const reopenCategory =
      getVisibleCategories(categories).find(
        (item) => String(item?.slug || "").trim().toLowerCase() === "appeal"
      ) || FALLBACK_CATEGORIES[1] || FALLBACK_CATEGORIES[0];

    queueTicketForCategory(
      reopenCategory,
      `Member requested review or reopen help for prior ticket: ${safeText(
        ticket?.title
      )} (${safeText(ticket?.channel_name || ticket?.channel_id, "no-channel")}).`
    );
  }

  return (
    <>
      <Topbar />

      <main style={{ paddingBottom: 96 }}>
        {notice ? (
          <div
            className={
              noticeTone === "error"
                ? "error-banner"
                : noticeTone === "warn"
                  ? "warning-banner"
                  : "info-banner"
            }
            style={{ marginBottom: 16 }}
          >
            {notice}
          </div>
        ) : null}

        <div className="desktop-tab-bar desktop-command-bar">
          {USER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`desktop-command-pill ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <section className={activeTab === "home" ? "user-tab active" : "user-tab"}>
          <HomeTab
            member={member}
            openTicket={userOpenTicket}
            verificationFlags={verificationFlags}
            categories={categories}
            initialData={initialData}
            onUseCategory={handleUseCategory}
            onGoToTab={goToTab}
            isCreating={isCreating}
            recentActivity={userRecentActivity}
          />
        </section>

        <section className={activeTab === "tickets" ? "user-tab active" : "user-tab"}>
          <TicketsTab
            recentTickets={userTickets}
            recentActivity={userRecentActivity}
            initialData={initialData}
            isPolling={isPolling}
            onRefreshAllTickets={refreshTicketsNow}
            onRequestReopen={handleRequestReopen}
            onNotice={showTempNotice}
          />
        </section>

        <section className={activeTab === "account" ? "user-tab active" : "user-tab"}>
          <AccountTab
            viewer={viewer}
            member={member}
            verificationFlags={verificationFlags}
            initialData={initialData}
            recentActivity={userRecentActivity}
          />
        </section>
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={USER_TABS}
      />

      <style jsx>{`
        .desktop-tab-bar {
          display: none;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .user-tab {
          display: none;
        }

        .user-tab.active {
          display: block;
        }

        .user-dashboard-grid {
          display: grid;
          gap: 16px;
        }

        .member-section {
          border-radius: 24px;
        }

        .member-section.tone-account {
          box-shadow: var(--shadow-strong), var(--glow-green);
        }

        .member-section.tone-ticket,
        .member-section.tone-history {
          box-shadow: var(--shadow), var(--glow-purple);
        }

        .member-section.tone-categories {
          box-shadow: var(--shadow-strong), var(--glow-green);
        }

        .ticket-row-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.06), transparent 36%),
            rgba(255,255,255,0.025);
          border-radius: 22px;
          padding: 14px;
        }

        .ticket-row-card.emphasis,
        .category-card.emphasis {
          border-color: rgba(99, 213, 255, 0.2);
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.10), transparent 36%),
            rgba(99,213,255,0.06);
        }

        .activity-card {
          background:
            radial-gradient(circle at top right, rgba(178,109,255,0.07), transparent 36%),
            rgba(255,255,255,0.025);
        }

        .profile-name {
          font-size: 20px;
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          line-height: 1.05;
          overflow-wrap: anywhere;
          letter-spacing: -0.03em;
        }

        .space {
          display: grid;
          gap: 12px;
        }

        .roles {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ticket-info-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.72;
          margin-bottom: 6px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 10px;
        }

        .summary-tile {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 13px;
          min-width: 0;
          background: rgba(255,255,255,0.03);
        }

        .summary-tile.neon-green {
          box-shadow: inset 0 0 0 1px rgba(93,255,141,0.06), 0 0 16px rgba(93,255,141,0.06);
        }

        .summary-tile.neon-blue {
          box-shadow: inset 0 0 0 1px rgba(99,213,255,0.06), 0 0 16px rgba(99,213,255,0.05);
        }

        .summary-tile.neon-purple {
          box-shadow: inset 0 0 0 1px rgba(178,109,255,0.06), 0 0 16px rgba(178,109,255,0.05);
        }

        .summary-value {
          font-size: 22px;
          font-weight: 900;
          line-height: 1.02;
          color: var(--text-strong, #f8fafc);
          margin-top: 6px;
          overflow-wrap: anywhere;
          letter-spacing: -0.03em;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 10px;
        }

        .mini-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 16px;
          padding: 12px;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .status-panel {
          border-radius: 22px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
        }

        .status-panel.low {
          border-color: rgba(93,255,141,0.18);
          background: rgba(93,255,141,0.08);
          box-shadow: 0 0 18px rgba(93,255,141,0.08);
        }

        .status-panel.medium {
          border-color: rgba(255,211,107,0.18);
          background: rgba(255,211,107,0.08);
          box-shadow: 0 0 18px rgba(255,211,107,0.06);
        }

        .status-panel.danger {
          border-color: rgba(255,111,142,0.20);
          background: rgba(255,111,142,0.08);
          box-shadow: 0 0 18px rgba(255,111,142,0.06);
        }

        .status-title {
          font-size: 20px;
          font-weight: 900;
          margin-bottom: 8px;
          color: var(--text-strong, #f8fafc);
          letter-spacing: -0.03em;
        }

        .account-header {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .account-avatar {
          width: 64px;
          height: 64px;
          min-width: 64px;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 0 18px rgba(99, 213, 255, 0.12);
          display: grid;
          place-items: center;
        }

        .account-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .account-avatar-fallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #68f5bf 0%, #63d5ff 100%);
          color: #09111f;
          font-weight: 900;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .account-header-copy {
          min-width: 0;
          flex: 1;
        }

        @media (min-width: 768px) {
          .info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .desktop-tab-bar {
            display: flex;
          }

          .summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .user-dashboard-grid {
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }

          .user-dashboard-grid :global(.card:first-child) {
            grid-column: span 2;
          }
        }
      `}</style>

      <style jsx global>{`
        .ticket-card-shell {
          overflow: hidden;
          transition:
            border-color 0.16s ease,
            background 0.16s ease,
            box-shadow 0.16s ease;
        }

        .ticket-card-shell:hover {
          border-color: rgba(99, 213, 255, 0.18);
          background: rgba(99, 213, 255, 0.04);
        }

        .ticket-card-shell.expanded {
          border-color: rgba(99, 213, 255, 0.22);
          background: rgba(99, 213, 255, 0.06);
          box-shadow: 0 0 0 1px rgba(99, 213, 255, 0.08) inset;
        }

        .ticket-card-button {
          width: 100%;
          display: block;
          text-align: left;
          cursor: pointer;
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          color: inherit !important;
          font: inherit !important;
          line-height: inherit !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
          text-decoration: none !important;
          min-height: 0;
          max-width: 100%;
          transition:
            transform 0.16s ease,
            opacity 0.16s ease;
        }

        .ticket-card-button,
        .ticket-card-button * {
          -webkit-tap-highlight-color: transparent;
        }

        .ticket-card-button:hover {
          opacity: 0.98;
        }

        .ticket-card-button:active {
          transform: scale(0.995);
        }

        .ticket-card-button:focus,
        .ticket-card-button:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        .ticket-card-button::-moz-focus-inner {
          border: 0;
          padding: 0;
        }

        .action-grid {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-grid a.button,
        .action-grid button.button {
          text-decoration: none;
        }
      `}</style>
    </>
  );
}
