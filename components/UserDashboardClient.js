"use client";

import { useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import MobileBottomNav from "@/components/MobileBottomNav";

const USER_TABS = ["home", "tickets", "help"];

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
  if (member?.has_unverified) return { label: "Pending Verification", tone: "warn" };
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

function getActionPlan({ member, openTicket, verificationFlags, vcVerifySession }) {
  const hasFlags = safeArray(verificationFlags).some((f) => Boolean(f?.flagged));
  const vcStatus = String(vcVerifySession?.status || "").toUpperCase();

  if (openTicket) {
    return {
      title: "Continue in your open ticket",
      body: "You already have an active ticket. Keep using that same ticket so your case stays in one place and staff can help faster.",
      tone: "ok",
      primaryLabel: "Go to Tickets Tab",
      primaryTargetTab: "tickets",
      secondaryLabel: "View Help Categories",
      secondaryTargetTab: "help",
      bullets: [
        "Avoid opening duplicate tickets for the same issue.",
        "Reply in your current ticket if you have updates.",
        "Staff progress will usually show there first.",
      ],
    };
  }

  if (vcVerifySession && vcStatus === "PENDING") {
    return {
      title: "Finish your VC verify flow",
      body: "You have a pending VC verify session. Follow the Discord instructions tied to that flow to complete access.",
      tone: "warn",
      primaryLabel: "View Account Status",
      primaryTargetTab: "home",
      secondaryLabel: "View Help Categories",
      secondaryTargetTab: "help",
      bullets: [
        "Complete the active VC verification steps first.",
        "If something is stuck, open a support ticket in Discord.",
        "Do not start multiple verification flows at once.",
      ],
    };
  }

  if (member?.has_unverified) {
    return {
      title: "Open a verification support ticket",
      body: "Your account still appears unverified. Open the verification support flow in Discord so staff can review and update your access.",
      tone: "warn",
      primaryLabel: "View Help Categories",
      primaryTargetTab: "help",
      secondaryLabel: "View My Tickets",
      secondaryTargetTab: "tickets",
      bullets: [
        "Use the verification-related support category.",
        "Include clear details about what access you are missing.",
        "If you already opened one, wait for staff in that ticket.",
      ],
    };
  }

  if (hasFlags) {
    return {
      title: "Request manual review",
      body: "Your account has recent verification flags or conflicting state. Open a support ticket so staff can manually review and correct it.",
      tone: "danger",
      primaryLabel: "View Help Categories",
      primaryTargetTab: "help",
      secondaryLabel: "View Account Status",
      secondaryTargetTab: "home",
      bullets: [
        "Choose the category closest to your issue.",
        "Mention any missing roles or blocked access.",
        "Keep all updates inside one ticket once opened.",
      ],
    };
  }

  if (member?.has_verified_role) {
    return {
      title: "You are verified",
      body: "Your verified role is present. If something still looks wrong, open a support ticket under the category that best matches your issue.",
      tone: "ok",
      primaryLabel: "View Help Categories",
      primaryTargetTab: "help",
      secondaryLabel: "View My Tickets",
      secondaryTargetTab: "tickets",
      bullets: [
        "Use support only if something is missing or broken.",
        "Pick the category that best matches your issue.",
        "Your past tickets remain visible in the Tickets tab.",
      ],
    };
  }

  return {
    title: "Open support if needed",
    body: "If your access looks wrong or you need help, open a support ticket in Discord and choose the category that best matches your issue.",
    tone: "warn",
    primaryLabel: "View Help Categories",
    primaryTargetTab: "help",
    secondaryLabel: "View My Tickets",
    secondaryTargetTab: "tickets",
    bullets: [
      "Choose the closest help category.",
      "Explain what role or access you expected.",
      "Keep your issue in one ticket thread.",
    ],
  };
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

function ActionCenter({ plan, onGoPrimary, onGoSecondary }) {
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
        >
          {plan.primaryLabel}
        </button>

        {plan.secondaryLabel ? (
          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 150 }}
            onClick={onGoSecondary}
          >
            {plan.secondaryLabel}
          </button>
        ) : null}
      </div>
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
}) {
  const verification = getVerificationState(member, verificationFlags);
  const roles = getRoleSummary(member);
  const actionPlan = getActionPlan({
    member,
    openTicket,
    verificationFlags,
    vcVerifySession,
  });

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
          onGoPrimary={() => onGoToTab(actionPlan.primaryTargetTab)}
          onGoSecondary={() =>
            actionPlan.secondaryTargetTab
              ? onGoToTab(actionPlan.secondaryTargetTab)
              : null
          }
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

function TicketsTab({ recentTickets }) {
  const rows = safeArray(recentTickets);

  return (
    <Section
      title="My Tickets"
      subtitle={`${rows.length} ticket${rows.length === 1 ? "" : "s"} found for your account`}
    >
      {!rows.length ? (
        <div className="empty-state">No tickets found for your account yet.</div>
      ) : (
        <div className="space">
          {rows.map((ticket) => (
            <div key={ticket.id} className="ticket-row-card">
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

              <div className="info-grid" style={{ marginTop: 12 }}>
                <div className="mini-card">
                  <div className="ticket-info-label">Updated</div>
                  <div>{timeAgo(ticket?.updated_at || ticket?.created_at)}</div>
                </div>

                <div className="mini-card">
                  <div className="ticket-info-label">Created</div>
                  <div>{formatTime(ticket?.created_at)}</div>
                </div>

                <div className="mini-card">
                  <div className="ticket-info-label">Claimed By</div>
                  <div>{safeText(ticket?.claimed_by)}</div>
                </div>

                <div className="mini-card">
                  <div className="ticket-info-label">Closed Reason</div>
                  <div>{safeText(ticket?.closed_reason)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function HelpTab({ categories, openTicket, onGoToTab }) {
  const rows = safeArray(categories);

  return (
    <div className="user-dashboard-grid">
      <Section title="Support Categories" subtitle="What kind of help you can request">
        {!rows.length ? (
          <div className="empty-state">
            No support categories are currently configured.
          </div>
        ) : (
          <div className="space">
            {rows.map((category) => (
              <div key={category.id} className="ticket-row-card">
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
                    {category?.is_default ? (
                      <StatusBadge label="Default" tone="ok" />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Best Next Step" subtitle="What you should do right now">
        <div className="status-panel ok">
          <div className="status-title">
            {openTicket ? "Use your current ticket" : "Open a support ticket in Discord"}
          </div>
          <div className="muted" style={{ lineHeight: 1.55 }}>
            {openTicket
              ? "You already have an active ticket. Continue there so staff can help you faster and keep everything in one place."
              : "Go to the server support channel and use the ticket panel to open the category that best matches your issue."}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 150 }}
              onClick={() => onGoToTab("tickets")}
            >
              View My Tickets
            </button>

            <button
              type="button"
              className="button ghost"
              style={{ width: "auto", minWidth: 150 }}
              onClick={() => onGoToTab("home")}
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

  const viewer = initialData?.viewer || {};
  const member = initialData?.member || null;
  const openTicket = initialData?.openTicket || null;
  const recentTickets = safeArray(initialData?.recentTickets);
  const categories = safeArray(initialData?.categories);
  const verificationFlags = safeArray(initialData?.verificationFlags);
  const vcVerifySession = initialData?.vcVerifySession || null;

  const verification = useMemo(
    () => getVerificationState(member, verificationFlags),
    [member, verificationFlags]
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

  return (
    <>
      <Topbar />

      <main style={{ paddingBottom: 96 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0 }}>My Dashboard</h1>
              <div className="muted" style={{ marginTop: 6 }}>
                Your account status, support progress, and ticket history
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge label={verification.label} tone={verification.tone} />
              {openTicket ? <StatusBadge label="Open Ticket" tone="warn" /> : null}
            </div>
          </div>
        </div>

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
            openTicket={openTicket}
            verificationFlags={verificationFlags}
            vcVerifySession={vcVerifySession}
            onGoToTab={goToTab}
          />
        </section>

        <section className={activeTab === "tickets" ? "user-tab active" : "user-tab"}>
          <TicketsTab recentTickets={recentTickets} />
        </section>

        <section className={activeTab === "help" ? "user-tab active" : "user-tab"}>
          <HelpTab
            categories={categories}
            openTicket={openTicket}
            onGoToTab={goToTab}
          />
        </section>
      </main>

      <MobileBottomNav activeTab={activeTab} onChange={setActiveTab} tabs={USER_TABS} />

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
