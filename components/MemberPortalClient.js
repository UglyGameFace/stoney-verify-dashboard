"use client";

import { useState } from "react";

export default function MemberPortalClient({
  user,
  initialTickets
}) {
  const [tickets] = useState(initialTickets);

  return (
    <div className="portal-container">

      <header className="portal-header">
        <div>
          <h1>Support Center</h1>
          <p className="muted">
            Logged in as {user?.username}
          </p>
        </div>

        <button
          className="button"
          onClick={() => createTicket()}
        >
          Create Ticket
        </button>
      </header>

      <section className="ticket-grid">
        {tickets.length === 0 ? (
          <div className="empty-state">
            You don't have any tickets yet.
          </div>
        ) : (
          tickets.map(ticket => (
            <div
              key={ticket.id}
              className="ticket-card"
            >
              <div className="ticket-title">
                {ticket.title || "Support Ticket"}
              </div>

              <div className="ticket-meta">
                Category: {ticket.category}
              </div>

              <div className="ticket-meta">
                Status: {ticket.status}
              </div>

              <div className="ticket-meta">
                Created: {new Date(ticket.created_at).toLocaleString()}
              </div>

              <button
                className="button ghost"
                onClick={() =>
                  window.location.href =
                    `/portal/tickets/${ticket.id}`
                }
              >
                Open Ticket
              </button>
            </div>
          ))
        )}
      </section>

      <style jsx>{`
        .portal-container {
          max-width: 1100px;
          margin: auto;
          padding: 20px;
        }

        .portal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }

        .ticket-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fit,minmax(240px,1fr));
        }

        .ticket-card {
          background: #121212;
          border: 1px solid #2a2a2a;
          padding: 16px;
          border-radius: 10px;
        }

        .ticket-title {
          font-weight: 700;
          margin-bottom: 6px;
        }

        .ticket-meta {
          font-size: 13px;
          opacity: .8;
          margin-bottom: 4px;
        }

        .button {
          margin-top: 10px;
        }

        .empty-state {
          opacity: .7;
        }

        @media (max-width:600px) {

          .portal-header {
            flex-direction: column;
            align-items: flex-start;
          }

        }
      `}</style>
    </div>
  );
}

async function createTicket() {
  await fetch("/api/tickets/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "support"
    })
  });

  location.reload();
}
