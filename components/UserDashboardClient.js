"use client";

import { useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import MobileBottomNav from "@/components/MobileBottomNav";

const USER_TABS = ["home", "tickets", "help"];

const FALLBACK_CATEGORIES = [
  {
    id: "fallback-verification",
    name: "Verification",
    slug: "verification",
    description:
      "Help with pending verification, missing verified role, or verification review.",
    intake_type: "verification",
    button_label: "Open Verification Ticket",
    is_default: true,
  },
  {
    id: "fallback-appeal",
    name: "Appeal",
    slug: "appeal",
    description:
      "Appeal a moderation action or request review of a previous decision.",
    intake_type: "appeal",
    button_label: "Open Appeal Ticket",
    is_default: false,
  },
  {
    id: "fallback-report",
    name: "Report / Incident",
    slug: "report",
    description:
      "Report a member, suspicious activity, scam, abuse, or other incident.",
    intake_type: "report",
    button_label: "Open Report Ticket",
    is_default: false,
  },
  {
    id: "fallback-question",
    name: "Question",
    slug: "question",
    description:
      "General support questions, access issues, or guidance on what to do next.",
    intake_type: "question",
    button_label: "Open Question Ticket",
    is_default: false,
  },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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

function getVerificationState(member, flags = []) {
  if (!member) return { label: "Not Synced Yet", tone: "warn" };
  if (member?.has_staff_role) return { label: "Staff", tone: "ok" };
  if (member?.has_verified_role) return { label: "Verified", tone: "ok" };
  if (member?.has_unverified) {
    return { label: "Pending Verification", tone: "warn" };
  }
  if (safeArray(flags).some((f) => Boolean(f?.flagged))) {
    return { label: "Needs Review", tone: "danger" };
  }
  return { label: safeText(member?.role_state, "Unknown"), tone: "warn" };
}

function getRoleSummary(member) {
  if (!member) return [];
  const names = Array.isArray(member?.role_names) ? member.role_names : [];
  return names.filter(Boolean).slice(0, 10);
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function getVisibleCategories(categories) {
  const rows = safeArray(categories).filter((item) => item && item.name);
  return rows.length ? rows : FALLBACK_CATEGORIES;
}

function getActionPlan({ member, openTicket, verificationFlags, vcVerifySession }) {
  const hasFlags = safeArray(verificationFlags).some((f) => Boolean(f?.flagged));
  const vcStatus = String(vcVerifySession?.status || "").toUpperCase();

  if (openTicket) {
    return {
      title: "Continue in your open ticket",
      body: "You already have an active ticket. Keep using that same ticket so your issue stays in one place and staff can help faster.",
      tone: "ok",
      primaryLabel: "Go To My Tickets",
      primaryTargetTab: "tickets",
      secondaryLabel: "See Support Categories",
      secondaryTargetTab: "help",
      suggestedCategorySlug: null,
      bullets: [
        "Avoid opening duplicate tickets for the same issue.",
        "Reply in your current ticket if you have updates.",
        "Open the ticket card for quick actions and details.",
      ],
    };
  }

  if (vcVerifySession && vcStatus === "PENDING") {
    return {
      title: "Finish your VC verify flow",
      body: "You already have a pending VC verify session. Finish that process first before starting anything new.",
      tone: "warn",
      primaryLabel: "View Account Status",
      primaryTargetTab: "home",
      secondaryLabel: "See Support Categories",
      secondaryTargetTab: "help",
      suggestedCategorySlug: "verification",
      bullets: [
        "Complete the active VC verification steps first.",
        "If the flow is stuck, open a verification support ticket.",
        "Do not start multiple verification flows at once.",
      ],
    };
  }

  if (member?.has_unverified) {
    return {
      title: "Open a verification ticket",
      body: "Your account still appears unverified. The right next move is a verification ticket so staff can review and update your access.",
      tone: "warn",
      primaryLabel: "Open Verification Options",
      primaryTargetTab: "help",
      secondaryLabel: "View My Tickets",
      secondaryTargetTab: "tickets",
      suggestedCategorySlug: "verification",
      bullets: [
        "Use the verification-related category.",
        "Explain what access or role you expected.",
        "If you already opened one, wait in that ticket instead of duplicating it.",
      ],
    };
  }

  if (hasFlags) {
    return {
      title: "Request manual review",
      body: "Your account has recent verification flags or conflicting state. Open a support ticket so staff can manually review it.",
      tone: "danger",
      primaryLabel: "Open Review Options",
      primaryTargetTab: "help",
      secondaryLabel: "View Account Status",
      secondaryTargetTab: "home",
      suggestedCategorySlug: "verification",
      bullets: [
        "Mention any missing role or blocked access.",
        "Choose the category closest to the issue.",
        "Keep all updates inside one ticket once opened.",
      ],
    };
  }

  if (member?.has_verified_role) {
    return {
      title: "You are verified",
      body: "Your verified role is present. If something still looks wrong, use a support ticket under the category that best matches your issue.",
      tone: "ok",
      primaryLabel: "See Support Categories",
      primaryTargetTab: "help",
      secondaryLabel: "View My Tickets",
      secondaryTargetTab: "tickets",
      suggestedCategorySlug: null,
      bullets: [
        "Use support only if something is missing or broken.",
        "Pick the category closest to your issue.",
        "Your past tickets remain visible in the Tickets tab.",
      ],
    };
  }

  return {
    title: "Open support if needed",
    body: "If your access looks wrong or you need help, open a support ticket and choose the category that best matches your issue.",
    tone: "warn",
    primaryLabel: "See Support Categories",
    primaryTargetTab: "help",
    secondaryLabel: "View My Tickets",
    secondaryTargetTab: "tickets",
    suggestedCategorySlug: null,
    bullets: [
      "Choose the closest help category.",
      "Explain what role or access you expected.",
      "Keep your issue in one ticket thread.",
    ],
  };
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

function StatusBadge({ label, tone = "default" }) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

function Section({ title, subtitle, children, actions = null }) {
  return (
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

function SummaryTiles({ member, openTicket, verificationFlags }) {
  const roles = getRoleSummary(member);
  const flagCount = safeArray(verificationFlags).length;

  return (
    <div className="summary-grid">
      <div className="summary-tile">
        <div className="ticket-info-label">Verification</div>
        <div className="summary-value">
          {member?.has_verified_role
            ? "Verified"
            : member?.has_unverified
              ? "Pending"
              : "Unknown"}
        </div>
      </div>

      <div className="summary-tile">
        <div className="ticket-info-label">Open Ticket</div>
        <div className="summary-value">{openTicket ? "Yes" : "No"}</div>
      </div>

      <div className="summary-tile">
        <div className="ticket-info-label">Tracked Roles</div>
        <div className="summary-value">{roles.length}</div>
      </div>

      <div className="summary-tile">
        <div className="ticket-info-label">Recent Flags</div>
        <div className="summary-value">{flagCount}</div>
      </div>
    </div>
  );
}

function ActionCenter({
  plan,
  onGoPrimary,
  onGoSecondary,
  canRequestVerification,
  onRequestVerification,
  isCreating,
}) {
  return (
    <div className={`status-panel ${plan.tone}`}>
      <div className="status-title">{plan.title}</div>
      <div className="muted" style={{ lineHeight: 1.55 }}>
        {plan.body}
      </div>

      {safeArray(plan.bullets).length ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {plan.bullets.map((bullet) => (
            <div key={bullet} className="muted" style={{ lineHeight: 1.45 }}>
              • {bullet}
            </div>
          ))}
        </div>
      ) : null}

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
          className="button"
          style={{ width: "auto", minWidth: 150 }}
          onClick={onGoPrimary}
          disabled={isCreating}
        >
          {plan.primaryLabel}
        </button>

        {plan.secondaryLabel ? (
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 150 }}
            onClick={onGoSecondary}
            disabled={isCreating}
          >
            {plan.secondaryLabel}
          </button>
        ) : null}

        {canRequestVerification ? (
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 190 }}
            onClick={onRequestVerification}
            disabled={isCreating}
          >
            {isCreating ? "Submitting..." : "Request Verification Ticket"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TicketActions({
  ticket,
  initialData,
  onRefreshStatus,
  onOpenCategories,
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
            style={{ width: "auto", minWidth: 150, textAlign: "center" }}
          >
            Open In Discord
          </a>
        ) : null}

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 150 }}
          onClick={() =>
            copyText(
              safeText(ticket?.channel_id, ""),
              "Channel ID copied."
            )
          }
        >
          Copy Channel ID
        </button>

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 150 }}
          onClick={() =>
            copyText(buildTicketSummary(ticket), "Ticket summary copied.")
          }
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

        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 150 }}
          onClick={onOpenCategories}
        >
          Open Categories
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

      <div className="mini-card">
        <div className="ticket-info-label">Ticket Details</div>
        <div className="info-grid" style={{ marginTop: 10 }}>
          <div className="mini-card">
            <div className="ticket-info-label">Created</div>
            <div>{formatTime(ticket?.created_at)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Updated</div>
            <div>{formatTime(ticket?.updated_at)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Claimed By</div>
            <div>{safeText(ticket?.claimed_by)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Closed Reason</div>
            <div>{safeText(ticket?.closed_reason)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Channel ID</div>
            <div>{safeText(ticket?.channel_id)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Channel Name</div>
            <div>{safeText(ticket?.channel_name)}</div>
          </div>
        </div>
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
  onOpenCategories,
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
            <div className="profile-name" style={{ fontSize: 16 }}>
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
          <div className="muted" style={{ fontWeight: 700 }}>
            {expanded ? "Hide Actions" : "Open Actions"}
          </div>
        </div>
      </button>

      {expanded ? (
        <TicketActions
          ticket={ticket}
          initialData={initialData}
          onRefreshStatus={onRefreshStatus}
          onOpenCategories={onOpenCategories}
          onRequestReopen={onRequestReopen}
          onNotice={onNotice}
        />
      ) : null}
    </div>
  );
}

function HomeTab({
  viewer,
  member,
  openTicket,
  verificationFlags,
  vcVerifySession,
  onGoToTab,
  onRequestVerification,
  isCreating,
}) {
  const verification = getVerificationState(member, verificationFlags);
  const roles = getRoleSummary(member);
  const actionPlan = getActionPlan({
    member,
    openTicket,
    verificationFlags,
    vcVerifySession,
  });

  const canRequestVerification =
    !openTicket &&
    (member?.has_unverified ||
      safeArray(verificationFlags).some((f) => Boolean(f?.flagged)));

  return (
    <div className="user-dashboard-grid">
      <Section title="My Account" subtitle="Your server profile and current access state">
        <div className="hero-card">
          <div style={{ minWidth: 0 }}>
            <div className="profile-name">
              {safeText(member?.display_name || viewer?.username, "Member")}
            </div>
            <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Discord ID: {safeText(viewer?.discord_id)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label={verification.label} tone={verification.tone} />
            {member?.in_guild === false ? (
              <StatusBadge label="Not In Server" tone="danger" />
            ) : null}
          </div>
        </div>

        <SummaryTiles
          member={member}
          openTicket={openTicket}
          verificationFlags={verificationFlags}
        />

        <div className="info-grid" style={{ marginTop: 14 }}>
          <div className="mini-card">
            <div className="ticket-info-label">Display Name</div>
            <div>{safeText(member?.display_name || viewer?.username)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Username</div>
            <div>{safeText(member?.username || viewer?.username)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Role State</div>
            <div>{safeText(member?.role_state)}</div>
          </div>

          <div className="mini-card">
            <div className="ticket-info-label">Joined</div>
            <div>{formatTime(member?.joined_at)}</div>
          </div>
        </div>

        {roles.length ? (
          <div style={{ marginTop: 14 }}>
            <div className="ticket-info-label" style={{ marginBottom: 8 }}>
              My Roles
            </div>
            <div className="roles">
              {roles.map((role) => (
                <span key={role} className="badge">
                  {role}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Action Center" subtitle="Only the next step you actually need">
        <ActionCenter
          plan={actionPlan}
          canRequestVerification={canRequestVerification}
          onRequestVerification={onRequestVerification}
          onGoPrimary={() => onGoToTab(actionPlan.primaryTargetTab)}
          onGoSecondary={() =>
            actionPlan.secondaryTargetTab
              ? onGoToTab(actionPlan.secondaryTargetTab)
              : null
          }
          isCreating={isCreating}
        />

        {vcVerifySession ? (
          <div className="mini-card" style={{ marginTop: 14 }}>
            <div className="ticket-info-label">VC Verify Session</div>
            <div style={{ marginTop: 8 }}>
              Status: {safeText(vcVerifySession?.status)}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Created: {formatTime(vcVerifySession?.created_at)}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="My Current Ticket" subtitle="Your most recent active support ticket">
        {openTicket ? (
          <div className="space">
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
                    {safeText(openTicket?.title, "Open Ticket")}
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Updated {timeAgo(openTicket?.updated_at || openTicket?.created_at)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge label={safeText(openTicket?.status)} tone="warn" />
                  <StatusBadge label={safeText(openTicket?.priority)} />
                </div>
              </div>

              <div className="info-grid" style={{ marginTop: 12 }}>
                <div className="mini-card">
                  <div className="ticket-info-label">Category</div>
                  <div>{safeText(openTicket?.matched_category_name || openTicket?.category)}</div>
                </div>

                <div className="mini-card">
                  <div className="ticket-info-label">Channel</div>
                  <div>{safeText(openTicket?.channel_name || openTicket?.channel_id)}</div>
                </div>

                <div className="mini-card">
                  <div className="ticket-info-label">Claimed By</div>
                  <div>{safeText(openTicket?.claimed_by)}</div>
                </div>

                <div className="mini-card">
                  <div className="ticket-info-label">Created</div>
                  <div>{formatTime(openTicket?.created_at)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            You do not currently have an open ticket.
          </div>
        )}
      </Section>
    </div>
  );
}

function TicketsTab({
  recentTickets,
  showDeletedHistory,
  onToggleDeletedHistory,
  isPolling,
  initialData,
  onRefreshAllTickets,
  onOpenCategories,
  onRequestReopen,
  onNotice,
}) {
  const [expandedTicketId, setExpandedTicketId] = useState(null);

  const activeTickets = safeArray(recentTickets).filter((ticket) =>
    ["open", "claimed"].includes(normalizeStatus(ticket?.status))
  );

  const closedTickets = safeArray(recentTickets).filter((ticket) =>
    normalizeStatus(ticket?.status) === "closed"
  );

  const deletedTickets = safeArray(recentTickets).filter((ticket) =>
    normalizeStatus(ticket?.status) === "deleted"
  );

  function toggleTicket(id) {
    setExpandedTicketId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="user-dashboard-grid">
      <Section
        title="Active Tickets"
        subtitle={`${activeTickets.length} active ticket${activeTickets.length === 1 ? "" : "s"}`}
        actions={isPolling ? <span className="badge warn">Waiting for bot…</span> : null}
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
                onOpenCategories={onOpenCategories}
                onRequestReopen={() => onRequestReopen(ticket)}
                onNotice={onNotice}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Closed Ticket History"
        subtitle={`${closedTickets.length} closed ticket${closedTickets.length === 1 ? "" : "s"}`}
      >
        {!closedTickets.length ? (
          <div className="empty-state">No closed ticket history found.</div>
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
                onOpenCategories={onOpenCategories}
                onRequestReopen={() => onRequestReopen(ticket)}
                onNotice={onNotice}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Deleted / Archived Ticket History"
        subtitle={`${deletedTickets.length} deleted ticket${deletedTickets.length === 1 ? "" : "s"}`}
        actions={
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 150 }}
            onClick={onToggleDeletedHistory}
          >
            {showDeletedHistory ? "Hide Deleted" : "Show Deleted"}
          </button>
        }
      >
        {!showDeletedHistory ? (
          <div className="empty-state">
            Deleted ticket rows are hidden by default so your history stays cleaner.
          </div>
        ) : !deletedTickets.length ? (
          <div className="empty-state">No deleted ticket history found.</div>
        ) : (
          <div className="space">
            {deletedTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                expanded={expandedTicketId === ticket.id}
                onToggle={() => toggleTicket(ticket.id)}
                initialData={initialData}
                onRefreshStatus={onRefreshAllTickets}
                onOpenCategories={onOpenCategories}
                onRequestReopen={() => onRequestReopen(ticket)}
                onNotice={onNotice}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function CategoryCard({ category, highlighted, onUseThisCategory, isCreating }) {
  return (
    <div className={`ticket-row-card ${highlighted ? "emphasis" : ""}`}>
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
          <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
            {safeText(category?.description, "No description provided.")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label={safeText(category?.intake_type, "general")} />
          {category?.is_default ? <StatusBadge label="Default" tone="ok" /> : null}
          {highlighted ? <StatusBadge label="Recommended" tone="warn" /> : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button
          type="button"
          className="button ghost"
          style={{ width: "auto", minWidth: 180 }}
          onClick={() => onUseThisCategory(category)}
          disabled={isCreating}
        >
          {isCreating
            ? "Submitting..."
            : safeText(category?.button_label, "Use This Category")}
        </button>
      </div>
    </div>
  );
}

function HelpTab({
  categories,
  openTicket,
  onGoToTab,
  recommendedCategorySlug,
  onUseCategory,
  isCreating,
}) {
  const rows = getVisibleCategories(categories);

  return (
    <div className="user-dashboard-grid">
      <Section title="Support Categories" subtitle="Pick the category that best matches your issue">
        <div className="space">
          {rows.map((category) => {
            const highlighted =
              recommendedCategorySlug &&
              String(category?.slug || "").trim().toLowerCase() ===
                String(recommendedCategorySlug || "").trim().toLowerCase();

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

      <Section title="Best Next Step" subtitle="What you should do right now">
        <div className="status-panel ok">
          <div className="status-title">
            {openTicket ? "Use your current ticket" : "Submit a support request"}
          </div>
          <div className="muted" style={{ lineHeight: 1.55 }}>
            {openTicket
              ? "You already have an active ticket. Continue there so staff can help you faster and keep everything in one place."
              : "Use one of the categories above to queue a support request. Your Discord ticket should appear shortly after the bot processes it."}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 150 }}
              onClick={() => onGoToTab("tickets")}
              disabled={isCreating}
            >
              View My Tickets
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 150 }}
              onClick={() => onGoToTab("home")}
              disabled={isCreating}
            >
              View Account Status
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function UserDashboardClient({ initialData }) {
  const [activeTab, setActiveTab] = useState("home");
  const [showDeletedHistory, setShowDeletedHistory] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("info");
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [userTickets, setUserTickets] = useState(
    safeArray(initialData?.recentTickets)
  );
  const [userOpenTicket, setUserOpenTicket] = useState(
    initialData?.openTicket || null
  );

  const viewer = initialData?.viewer || {};
  const member = initialData?.member || null;
  const categories = safeArray(initialData?.categories);
  const verificationFlags = safeArray(initialData?.verificationFlags);
  const vcVerifySession = initialData?.vcVerifySession || null;

  const verification = useMemo(
    () => getVerificationState(member, verificationFlags),
    [member, verificationFlags]
  );

  const actionPlan = useMemo(
    () =>
      getActionPlan({
        member,
        openTicket: userOpenTicket,
        verificationFlags,
        vcVerifySession,
      }),
    [member, userOpenTicket, verificationFlags, vcVerifySession]
  );

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
      window.clearTimeout(window.__userDashNoticeTimer);
      window.__userDashNoticeTimer = window.setTimeout(() => {
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

      setUserOpenTicket(nextOpenTicket);
      setUserTickets(nextRecentTickets);
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

        if (!res.ok || !data?.ok) {
          continue;
        }

        const nextOpenTicket = data?.openTicket || null;
        const nextRecentTickets = Array.isArray(data?.recentTickets)
          ? data.recentTickets
          : [];

        setUserOpenTicket(nextOpenTicket);
        setUserTickets(nextRecentTickets);

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
            const existingRows = safeArray(prev).filter(
              (row) => row?.id !== existing.id
            );
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
        error instanceof Error
          ? error.message
          : "Failed to submit ticket request.",
        "error"
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleUseCategory(category) {
    queueTicketForCategory(category);
  }

  function handleRequestVerification() {
    const category =
      getVisibleCategories(categories).find(
        (item) =>
          String(item?.slug || "").trim().toLowerCase() === "verification"
      ) || FALLBACK_CATEGORIES[0];

    queueTicketForCategory(
      category,
      "Member requested verification help from the dashboard."
    );
  }

  function handleOpenCategories() {
    goToTab("help");
    showTempNotice("Choose a support category below.", "info");
  }

  function handleRequestReopen(ticket) {
    const reopenCategory =
      getVisibleCategories(categories).find(
        (item) =>
          String(item?.slug || "").trim().toLowerCase() === "appeal"
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
            className={noticeTone === "error" ? "error-banner" : "info-banner"}
            style={{ marginBottom: 16 }}
          >
            {notice}
          </div>
        ) : null}

        <div className="desktop-tab-bar">
          {USER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "button" : "button ghost"}
              style={{ width: "auto", minWidth: 110 }}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <section className={activeTab === "home" ? "user-tab active" : "user-tab"}>
          <HomeTab
            viewer={viewer}
            member={member}
            openTicket={userOpenTicket}
            verificationFlags={verificationFlags}
            vcVerifySession={vcVerifySession}
            onGoToTab={goToTab}
            onRequestVerification={handleRequestVerification}
            isCreating={isCreating}
          />
        </section>

        <section className={activeTab === "tickets" ? "user-tab active" : "user-tab"}>
          <TicketsTab
            recentTickets={userTickets}
            showDeletedHistory={showDeletedHistory}
            onToggleDeletedHistory={() =>
              setShowDeletedHistory((prev) => !prev)
            }
            isPolling={isPolling}
            initialData={initialData}
            onRefreshAllTickets={refreshTicketsNow}
            onOpenCategories={handleOpenCategories}
            onRequestReopen={handleRequestReopen}
            onNotice={showTempNotice}
          />
        </section>

        <section className={activeTab === "help" ? "user-tab active" : "user-tab"}>
          <HelpTab
            categories={categories}
            openTicket={userOpenTicket}
            onGoToTab={goToTab}
            recommendedCategorySlug={actionPlan?.suggestedCategorySlug}
            onUseCategory={handleUseCategory}
            isCreating={isCreating}
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

        .hero-card,
        .ticket-row-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 18px;
          padding: 14px;
        }

        .ticket-card-shell.expanded {
          border-color: rgba(96, 165, 250, 0.22);
          background: rgba(96, 165, 250, 0.05);
        }

        .ticket-card-button {
          width: 100%;
          text-align: left;
          cursor: pointer;
          transition:
            transform 0.16s ease,
            border-color 0.16s ease,
            background 0.16s ease,
            box-shadow 0.16s ease;
        }

        .ticket-card-button:active {
          transform: scale(0.995);
        }

        .action-grid {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ticket-row-card.emphasis {
          border-color: rgba(96, 165, 250, 0.22);
          background: rgba(96, 165, 250, 0.06);
        }

        .profile-name {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-strong, #f8fafc);
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .summary-tile {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
          border-radius: 14px;
          padding: 12px;
          min-width: 0;
        }

        .summary-value {
          font-size: 20px;
          font-weight: 800;
          line-height: 1.05;
          color: var(--text-strong, #f8fafc);
          margin-top: 6px;
          overflow-wrap: anywhere;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(1, minmax(0, 1fr));
          gap: 10px;
        }

        .mini-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 14px;
          padding: 12px;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .status-panel {
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .status-panel.ok {
          border-color: rgba(74, 222, 128, 0.22);
          background: rgba(74, 222, 128, 0.08);
        }

        .status-panel.warn {
          border-color: rgba(251, 191, 36, 0.22);
          background: rgba(251, 191, 36, 0.08);
        }

        .status-panel.danger {
          border-color: rgba(248, 113, 113, 0.22);
          background: rgba(248, 113, 113, 0.08);
        }

        .status-title {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 8px;
          color: var(--text-strong, #f8fafc);
        }

        @media (min-width: 768px) {
          .info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .desktop-tab-bar {
            display: flex;
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
    </>
  );
}
