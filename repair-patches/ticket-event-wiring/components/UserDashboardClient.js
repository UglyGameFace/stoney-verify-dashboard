"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import MobileBottomNav from "@/components/MobileBottomNav";

const USER_TABS = ["home", "tickets", "account"];

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

function Section({ title, subtitle, children, actions = null, tone = "default" }) {
  return (
    <div className={`card member-section tone-${tone}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle ? <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{subtitle}</div> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ label, tone = "default" }) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

function ActivityFeed({ recentActivity }) {
  const rows = safeArray(recentActivity);

  if (!rows.length) {
    return <div className="empty-state">No recent ticket or member activity was found yet.</div>;
  }

  return (
    <div className="space">
      {rows.map((row) => (
        <div key={`${row.source}-${row.id}`} className="ticket-row-card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="profile-name" style={{ fontSize: 16 }}>{safeText(row?.title, "Activity")}</div>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.55 }}>
                {safeText(row?.description, "No extra description.")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge label={safeText(row?.event_family, "ticket")} />
              <StatusBadge label={safeText(row?.event_type, "update")} tone="low" />
            </div>
          </div>

          <div className="info-grid" style={{ marginTop: 12 }}>
            <div className="mini-card">
              <div className="ticket-info-label">When</div>
              <div>{formatTime(row?.created_at)}</div>
            </div>
            <div className="mini-card">
              <div className="ticket-info-label">Actor</div>
              <div>{safeText(row?.actor_name || row?.actor_user_id)}</div>
            </div>
            <div className="mini-card">
              <div className="ticket-info-label">Ticket</div>
              <div>{safeText(row?.ticket_id || row?.channel_name || row?.channel_id)}</div>
            </div>
            <div className="mini-card">
              <div className="ticket-info-label">Source</div>
              <div>{safeText(row?.source)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryList({ title, values, emptyText }) {
  const rows = safeArray(values).filter(Boolean);
  return (
    <div className="mini-card">
      <div className="ticket-info-label">{title}</div>
      {rows.length ? (
        <div className="roles" style={{ marginTop: 8 }}>
          {rows.map((value) => (
            <span key={`${title}-${value}`} className="badge">{String(value)}</span>
          ))}
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8 }}>{emptyText}</div>
      )}
    </div>
  );
}

function AccountHistory({ member }) {
  return (
    <div className="info-grid" style={{ marginTop: 14 }}>
      <HistoryList title="Previous Usernames" values={member?.previous_usernames} emptyText="No prior usernames saved yet." />
      <HistoryList title="Previous Display Names" values={member?.previous_display_names} emptyText="No prior display names saved yet." />
      <HistoryList title="Previous Nicknames" values={member?.previous_nicknames} emptyText="No prior nicknames saved yet." />
      <div className="mini-card">
        <div className="ticket-info-label">Entry Trail</div>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <div><strong>Entry Method:</strong> {safeText(member?.entry_method)}</div>
          <div><strong>Verification Source:</strong> {safeText(member?.verification_source)}</div>
          <div><strong>Invited By:</strong> {safeText(member?.invited_by_name)}</div>
          <div><strong>Vouched By:</strong> {safeText(member?.vouched_by_name)}</div>
          <div><strong>Approved By:</strong> {safeText(member?.approved_by_name)}</div>
        </div>
      </div>
    </div>
  );
}

export default function UserDashboardClient({ initialData }) {
  const [activeTab, setActiveTab] = useState("home");

  const member = initialData?.member || null;
  const recentTickets = safeArray(initialData?.recentTickets);
  const recentActivity = safeArray(initialData?.recentActivity);

  return (
    <>
      <Topbar />
      <main style={{ paddingBottom: 96 }}>
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
          <div className="user-dashboard-grid">
            <Section title="Recent Activity" subtitle="Ticket actions, moderation touches, and member-linked events" tone="ticket">
              <ActivityFeed recentActivity={recentActivity} />
            </Section>

            <Section title="Recent Tickets" subtitle={`${recentTickets.length} ticket${recentTickets.length === 1 ? "" : "s"} visible in your dashboard`} tone="history">
              {!recentTickets.length ? (
                <div className="empty-state">No recent tickets found.</div>
              ) : (
                <div className="space">
                  {recentTickets.slice(0, 6).map((ticket) => (
                    <div key={ticket.id} className="ticket-row-card">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="profile-name" style={{ fontSize: 16 }}>{safeText(ticket?.title, "Ticket")}</div>
                          <div className="muted" style={{ marginTop: 6 }}>
                            {safeText(ticket?.matched_category_name || ticket?.category)} • updated {timeAgo(ticket?.updated_at || ticket?.created_at)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <StatusBadge label={safeText(ticket?.status)} />
                          <StatusBadge label={safeText(ticket?.priority)} tone="low" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </section>

        <section className={activeTab === "account" ? "user-tab active" : "user-tab"}>
          <div className="user-dashboard-grid">
            <Section title="Member History" subtitle="The identity trail your bot and dashboard should share" tone="account">
              <AccountHistory member={member} />
            </Section>
          </div>
        </section>
      </main>

      <MobileBottomNav activeTab={activeTab} onChange={setActiveTab} tabs={USER_TABS} />

      <style jsx>{`
        .desktop-tab-bar { display: none; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .user-tab { display: none; }
        .user-tab.active { display: block; }
        .user-dashboard-grid { display: grid; gap: 16px; }
        .member-section { border-radius: 24px; }
        .member-section.tone-account { box-shadow: var(--shadow-strong), var(--glow-green); }
        .member-section.tone-ticket, .member-section.tone-history { box-shadow: var(--shadow), var(--glow-purple); }
        .ticket-row-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: radial-gradient(circle at top right, rgba(93,255,141,0.06), transparent 36%), rgba(255,255,255,0.025);
          border-radius: 22px;
          padding: 14px;
        }
        .profile-name {
          font-size: 20px;
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          line-height: 1.05;
          overflow-wrap: anywhere;
          letter-spacing: -0.03em;
        }
        .info-grid { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 10px; }
        .mini-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          border-radius: 16px;
          padding: 12px;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        @media (min-width: 768px) {
          .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 1024px) {
          .desktop-tab-bar { display: flex; }
          .user-dashboard-grid { grid-template-columns: 1fr 1fr; align-items: start; }
        }
      `}</style>
    </>
  );
}
