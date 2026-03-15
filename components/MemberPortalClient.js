"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDateTime(value) {
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
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return "—";

    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

function statusTone(status) {
  const value = String(status || "").toLowerCase();

  if (value === "open") {
    return {
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.28)",
      text: "#86efac",
    };
  }

  if (value === "claimed") {
    return {
      bg: "rgba(59,130,246,0.12)",
      border: "rgba(59,130,246,0.28)",
      text: "#93c5fd",
    };
  }

  if (value === "closed") {
    return {
      bg: "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.28)",
      text: "#fde68a",
    };
  }

  if (value === "deleted") {
    return {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.28)",
      text: "#fca5a5",
    };
  }

  return {
    bg: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.12)",
    text: "#e5e7eb",
  };
}

function priorityTone(priority) {
  const value = String(priority || "").toLowerCase();

  if (value === "urgent") {
    return {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.28)",
      text: "#fca5a5",
    };
  }

  if (value === "high") {
    return {
      bg: "rgba(249,115,22,0.12)",
      border: "rgba(249,115,22,0.28)",
      text: "#fdba74",
    };
  }

  if (value === "medium") {
    return {
      bg: "rgba(234,179,8,0.12)",
      border: "rgba(234,179,8,0.28)",
      text: "#fde68a",
    };
  }

  return {
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.28)",
    text: "#86efac",
  };
}

export default function MemberPortalClient({
  user,
  initialTickets,
}) {
  const router = useRouter();

  const [tickets, setTickets] = useState(safeArray(initialTickets));
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const stats = useMemo(() => {
    const all = safeArray(tickets);

    return {
      total: all.length,
      open: all.filter((t) => String(t?.status).toLowerCase() === "open").length,
      claimed: all.filter((t) => String(t?.status).toLowerCase() === "claimed").length,
      closed: all.filter((t) => String(t?.status).toLowerCase() === "closed").length,
    };
  }, [tickets]);

  async function createTicket() {
    setIsCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const res = await fetch("/api/portal/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "support",
          priority: "medium",
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to create ticket");
      }

      if (json?.alreadyExists && json?.ticket?.id) {
        window.location.href = `/portal/tickets/${json.ticket.id}`;
        return;
      }

      setCreateSuccess(
        "Ticket request sent. Your portal will refresh shortly."
      );

      setTimeout(() => {
        router.refresh();
      }, 1400);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create ticket"
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openTicket(ticketId) {
    window.location.href = `/portal/tickets/${ticketId}`;
  }

  return (
    <div className="portal-container">
      <header className="portal-hero">
        <div className="hero-copy">
          <div className="hero-kicker">Member Portal</div>
          <h1 className="hero-title">Support Center</h1>
          <p className="hero-subtitle">
            Logged in as <strong>{safeText(user?.username, "Member")}</strong>
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="primary-button"
            onClick={createTicket}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create Ticket"}
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Tickets</div>
          <div className="stat-value">{stats.total}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Open</div>
          <div className="stat-value">{stats.open}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Claimed</div>
          <div className="stat-value">{stats.claimed}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Closed</div>
          <div className="stat-value">{stats.closed}</div>
        </div>
      </section>

      {createError ? (
        <div className="banner error">{createError}</div>
      ) : null}

      {createSuccess ? (
        <div className="banner success">{createSuccess}</div>
      ) : null}

      <section className="portal-section">
        <div className="section-header">
          <div>
            <div className="section-title">My Tickets</div>
            <div className="section-subtitle">
              Your current and past support conversations
            </div>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-state">
            You don't have any tickets yet.
          </div>
        ) : (
          <div className="ticket-grid">
            {tickets.map((ticket) => {
              const statusStyles = statusTone(ticket?.status);
              const priorityStyles = priorityTone(ticket?.priority);

              return (
                <div
                  key={ticket.id}
                  className="ticket-card"
                >
                  <div className="ticket-top">
                    <div>
                      <div className="ticket-title">
                        {safeText(ticket?.title, "Support Ticket")}
                      </div>
                      <div className="ticket-subtitle">
                        {safeText(ticket?.category, "support")} • {timeAgo(ticket?.created_at)}
                      </div>
                    </div>

                    <div className="ticket-pills">
                      <span
                        className="pill"
                        style={{
                          background: statusStyles.bg,
                          borderColor: statusStyles.border,
                          color: statusStyles.text,
                        }}
                      >
                        {safeText(ticket?.status, "unknown")}
                      </span>

                      <span
                        className="pill"
                        style={{
                          background: priorityStyles.bg,
                          borderColor: priorityStyles.border,
                          color: priorityStyles.text,
                        }}
                      >
                        {safeText(ticket?.priority, "medium")}
                      </span>
                    </div>
                  </div>

                  <div className="ticket-meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">Created</span>
                      <span className="meta-value">
                        {formatDateTime(ticket?.created_at)}
                      </span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-label">Updated</span>
                      <span className="meta-value">
                        {formatDateTime(ticket?.updated_at)}
                      </span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-label">Channel</span>
                      <span className="meta-value">
                        {safeText(ticket?.channel_id || ticket?.discord_thread_id, "Pending")}
                      </span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-label">Transcript</span>
                      <span className="meta-value">
                        {ticket?.transcript_url ? "Available" : "Not available"}
                      </span>
                    </div>
                  </div>

                  <div className="ticket-actions">
                    <button
                      className="ghost-button"
                      onClick={() => openTicket(ticket.id)}
                    >
                      Open Ticket
                    </button>

                    {ticket?.transcript_url ? (
                      <a
                        href={ticket.transcript_url}
                        target="_blank"
                        rel="noreferrer"
                        className="link-button"
                      >
                        Transcript
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        .portal-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 22px 16px 96px;
          color: #fff;
        }

        .portal-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          border-radius: 22px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.18);
        }

        .hero-kicker {
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          font-weight: 800;
          margin-bottom: 8px;
        }

        .hero-title {
          margin: 0;
          font-size: clamp(30px, 4vw, 44px);
          line-height: 1.02;
        }

        .hero-subtitle {
          margin-top: 8px;
          color: rgba(255,255,255,0.72);
        }

        .hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .primary-button,
        .ghost-button,
        .link-button {
          min-height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          font-weight: 800;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .primary-button {
          border: 1px solid rgba(147,197,253,0.24);
          background: linear-gradient(180deg,#2563eb,#1d4ed8);
          color: #fff;
          cursor: pointer;
        }

        .ghost-button {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          color: #fff;
          cursor: pointer;
        }

        .link-button {
          border: 1px solid rgba(147,197,253,0.18);
          background: rgba(147,197,253,0.08);
          color: #93c5fd;
        }

        .stats-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 18px;
        }

        .stat-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          border-radius: 18px;
          padding: 16px;
        }

        .stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 900;
          line-height: 1;
        }

        .banner {
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 16px;
          font-weight: 700;
        }

        .banner.error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
        }

        .banner.success {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.25);
          color: #86efac;
        }

        .portal-section {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.18);
        }

        .section-header {
          margin-bottom: 14px;
        }

        .section-title {
          font-size: 22px;
          font-weight: 900;
        }

        .section-subtitle {
          margin-top: 6px;
          color: rgba(255,255,255,0.62);
          font-size: 14px;
        }

        .empty-state {
          border: 1px dashed rgba(255,255,255,0.14);
          border-radius: 16px;
          padding: 20px;
          color: rgba(255,255,255,0.68);
          background: rgba(255,255,255,0.02);
        }

        .ticket-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: 1fr;
        }

        .ticket-card {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          border-radius: 18px;
          padding: 16px;
        }

        .ticket-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .ticket-title {
          font-weight: 900;
          font-size: 18px;
          line-height: 1.15;
        }

        .ticket-subtitle {
          margin-top: 6px;
          color: rgba(255,255,255,0.62);
          font-size: 13px;
        }

        .ticket-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pill {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 800;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .ticket-meta-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 14px;
        }

        .meta-item {
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.025);
          border-radius: 12px;
          padding: 10px 12px;
        }

        .meta-label {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .meta-value {
          display: block;
          font-size: 13px;
          color: #fff;
          word-break: break-word;
        }

        .ticket-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        @media (min-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .ticket-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1280px) {
          .ticket-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .portal-hero,
          .portal-section,
          .stat-card,
          .ticket-card {
            border-radius: 18px;
          }

          .ticket-meta-grid {
            grid-template-columns: 1fr;
          }

          .primary-button,
          .ghost-button,
          .link-button {
            width: 100%;
          }

          .ticket-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
