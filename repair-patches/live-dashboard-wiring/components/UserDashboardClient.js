"use client";

import { useMemo, useState } from "react";
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

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
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

function Section({ title, subtitle, children }) {
  return (
    <div className="card member-section">
      <div className="row section-head">
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle ? <div className="muted section-subtitle">{subtitle}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ label, tone = "default" }) {
  return <span className={`badge ${tone}`}>{label}</span>;
}

function eventTitle(row) {
  return row?.title || row?.event_title || row?.event_type || "Ticket activity";
}

function eventReason(row) {
  return row?.reason || row?.description || row?.summary || "";
}

function RecentActivityPanel({ recentActivity }) {
  const ordered = useMemo(() => {
    return [...safeArray(recentActivity)].sort((a, b) => {
      const left = new Date(a?.created_at || a?.timestamp || 0).getTime();
      const right = new Date(b?.created_at || b?.timestamp || 0).getTime();
      return right - left;
    });
  }, [recentActivity]);

  return (
    <Section
      title="Recent Activity"
      subtitle="Live member and ticket events wired into the dashboard"
    >
      <div className="space">
        {ordered.length ? (
          ordered.map((row) => (
            <div
              key={row?.id || `${row?.event_type}-${row?.created_at}`}
              className="ticket-row-card emphasis"
            >
              <div className="row activity-head">
                <div className="profile-name activity-title">{eventTitle(row)}</div>
                <div className="muted activity-time">
                  {formatTime(row?.created_at || row?.timestamp)}
                </div>
              </div>
              {eventReason(row) ? (
                <div className="muted activity-reason">{eventReason(row)}</div>
              ) : null}
              <div className="row activity-meta">
                <StatusBadge label={safeText(row?.actor_name || row?.actor_id || "System")} />
                {row?.ticket_id ? <StatusBadge label={`Ticket ${row.ticket_id}`} tone="low" /> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No recent dashboard activity found yet.</div>
        )}
      </div>
    </Section>
  );
}

function TicketList({ tickets }) {
  const rows = safeArray(tickets);
  return (
    <div className="space">
      {rows.length ? (
        rows.map((ticket) => (
          <div key={ticket?.id || ticket?.channel_id} className="ticket-row-card">
            <div className="row activity-head">
              <div className="profile-name activity-title">
                {safeText(ticket?.title, "Ticket")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge label={safeText(ticket?.status, "open")} />
                <StatusBadge label={safeText(ticket?.priority, "medium")} tone="low" />
              </div>
            </div>
            <div className="muted activity-reason">
              {safeText(ticket?.matched_category_name || ticket?.category, "Support")} • {safeText(ticket?.channel_name || ticket?.channel_id)}
            </div>
            <div className="muted activity-time">Updated {timeAgo(ticket?.updated_at || ticket?.created_at)}</div>
          </div>
        ))
      ) : (
        <div className="empty-state">No tickets found.</div>
      )}
    </div>
  );
}

function AccountPanel({ viewer, member }) {
  return (
    <Section title="Account" subtitle="Identity and access snapshot">
      <div className="info-grid">
        <div className="mini-card">
          <div className="ticket-info-label">Display Name</div>
          <div>{safeText(member?.display_name || viewer?.global_name || viewer?.username, "Member")}</div>
        </div>
        <div className="mini-card">
          <div className="ticket-info-label">Username</div>
          <div>{safeText(member?.username || viewer?.username, "Unknown")}</div>
        </div>
        <div className="mini-card">
          <div className="ticket-info-label">Discord ID</div>
          <div>{safeText(viewer?.discord_id)}</div>
        </div>
        <div className="mini-card">
          <div className="ticket-info-label">Joined</div>
          <div>{formatTime(member?.joined_at)}</div>
        </div>
      </div>
    </Section>
  );
}

function HomeTab({ initialData, recentActivity }) {
  const member = initialData?.member || null;
  const viewer = initialData?.viewer || {};
  const openTicket = initialData?.openTicket || null;
  return (
    <div className="user-dashboard-grid">
      <Section title="Overview" subtitle="Your current dashboard state">
        <div className="info-grid">
          <div className="mini-card">
            <div className="ticket-info-label">Verification</div>
            <div>{member?.has_verified_role ? "Verified" : member?.has_unverified ? "Pending Verification" : "Unknown"}</div>
          </div>
          <div className="mini-card">
            <div className="ticket-info-label">Open Ticket</div>
            <div>{openTicket ? "Yes" : "No"}</div>
          </div>
          <div className="mini-card">
            <div className="ticket-info-label">Viewer</div>
            <div>{safeText(viewer?.username, "Member")}</div>
          </div>
          <div className="mini-card">
            <div className="ticket-info-label">Latest Activity</div>
            <div>{recentActivity?.[0] ? timeAgo(recentActivity[0]?.created_at || recentActivity[0]?.timestamp) : "—"}</div>
          </div>
        </div>
      </Section>

      <RecentActivityPanel recentActivity={recentActivity} />
    </div>
  );
}

function TicketsTab({ recentTickets, recentActivity }) {
  const activeTickets = safeArray(recentTickets).filter((ticket) =>
    ["open", "claimed"].includes(normalizeStatus(ticket?.status))
  );
  const closedTickets = safeArray(recentTickets).filter((ticket) =>
    ["closed", "deleted"].includes(normalizeStatus(ticket?.status))
  );

  return (
    <div className="user-dashboard-grid">
      <Section title="Active Tickets" subtitle={`${activeTickets.length} active`}>
        <TicketList tickets={activeTickets} />
      </Section>
      <Section title="Recent Ticket History" subtitle={`${closedTickets.length} recent closed or deleted`}>
        <TicketList tickets={closedTickets} />
      </Section>
      <RecentActivityPanel recentActivity={recentActivity} />
    </div>
  );
}

export default function UserDashboardClient({ initialData }) {
  const [activeTab, setActiveTab] = useState("home");
  const recentTickets = safeArray(initialData?.recentTickets);
  const recentActivity = safeArray(initialData?.recentActivity);
  const viewer = initialData?.viewer || {};
  const member = initialData?.member || null;

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
          <HomeTab initialData={initialData} recentActivity={recentActivity} />
        </section>

        <section className={activeTab === "tickets" ? "user-tab active" : "user-tab"}>
          <TicketsTab recentTickets={recentTickets} recentActivity={recentActivity} />
        </section>

        <section className={activeTab === "account" ? "user-tab active" : "user-tab"}>
          <div className="user-dashboard-grid">
            <AccountPanel viewer={viewer} member={member} />
            <RecentActivityPanel recentActivity={recentActivity} />
          </div>
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

        .member-section {
          border-radius: 24px;
          box-shadow: var(--shadow), var(--glow-purple);
        }

        .section-head {
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .section-subtitle {
          margin-top: 6px;
          font-size: 13px;
        }

        .ticket-row-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: radial-gradient(circle at top right, rgba(93,255,141,0.06), transparent 36%), rgba(255,255,255,0.025);
          border-radius: 22px;
          padding: 14px;
        }

        .ticket-row-card.emphasis {
          border-color: rgba(99, 213, 255, 0.2);
          background: radial-gradient(circle at top right, rgba(99,213,255,0.10), transparent 36%), rgba(99,213,255,0.06);
        }

        .profile-name {
          font-size: 20px;
          font-weight: 900;
          color: var(--text-strong, #f8fafc);
          line-height: 1.05;
          overflow-wrap: anywhere;
          letter-spacing: -0.03em;
        }

        .activity-head {
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }

        .activity-title {
          font-size: 16px;
        }

        .activity-time {
          font-size: 12px;
        }

        .activity-reason {
          margin-top: 8px;
          line-height: 1.55;
        }

        .activity-meta {
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
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

        @media (min-width: 768px) {
          .info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
        }
      `}</style>
    </>
  );
}
