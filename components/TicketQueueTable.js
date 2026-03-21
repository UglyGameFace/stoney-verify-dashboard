"use client";

import Link from "next/link";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import TicketControls from "./dashboard/TicketControls";
import CreateTicketButton from "./dashboard/CreateTicketButton";

function badgeClass(value) {
  const v = String(value || "").toLowerCase();

  if (v === "open") return "badge open";
  if (v === "closed") return "badge closed";
  if (v === "deleted") return "badge closed";
  if (v === "claimed") return "badge claimed";

  if (v === "low") return "badge low";
  if (v === "medium") return "badge medium";
  if (v === "high") return "badge danger";
  if (v === "urgent") return "badge danger";

  if (v === "verification") return "badge claimed";
  if (v === "appeal") return "badge medium";
  if (v === "report") return "badge danger";
  if (v === "partnership") return "badge low";
  if (v === "question") return "badge";
  if (v === "custom") return "badge";

  return "badge";
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getChannelId(ticket) {
  return String(ticket?.channel_id || ticket?.discord_thread_id || "").trim();
}

function getTicketUserLabel(ticket) {
  return (
    String(ticket?.username || "").trim() ||
    String(ticket?.user_id || "").trim() ||
    "Unknown User"
  );
}

function getTicketTitle(ticket) {
  return (
    String(ticket?.title || "").trim() ||
    String(ticket?.channel_name || "").trim() ||
    "Untitled Ticket"
  );
}

function getStatus(ticket) {
  return String(ticket?.status || "unknown").toLowerCase();
}

function isGhost(ticket) {
  return ticket?.is_ghost === true;
}

function hasMissingChannel(ticket) {
  return !getChannelId(ticket);
}

function getDisplayedCategoryName(ticket) {
  return (
    String(ticket?.matched_category_name || "").trim() ||
    String(ticket?.category || "").trim() ||
    "Uncategorized"
  );
}

function getDisplayedCategorySlug(ticket) {
  return (
    String(ticket?.matched_category_slug || "").trim() ||
    String(ticket?.category || "").trim() ||
    ""
  );
}

function getDisplayedIntakeType(ticket) {
  return String(ticket?.matched_intake_type || "").trim() || "";
}

function getCategoryReason(ticket) {
  return String(ticket?.matched_category_reason || "").trim() || "";
}

function getCategoryScore(ticket) {
  const score = Number(ticket?.matched_category_score || 0);
  return Number.isFinite(score) ? score : 0;
}

function hasMatchedCategory(ticket) {
  return Boolean(
    String(ticket?.matched_category_name || "").trim() ||
      String(ticket?.matched_category_slug || "").trim()
  );
}

function countByStatus(tickets, status) {
  return tickets.filter(
    (ticket) => String(ticket?.status || "").toLowerCase() === status
  ).length;
}

function countByPriority(tickets, priority) {
  return tickets.filter(
    (ticket) => String(ticket?.priority || "").toLowerCase() === priority
  ).length;
}

function countMatchedCategories(tickets) {
  return tickets.filter((ticket) => hasMatchedCategory(ticket)).length;
}

function countVerificationLike(tickets) {
  return tickets.filter((ticket) => {
    const intake = getDisplayedIntakeType(ticket).toLowerCase();
    const category = getDisplayedCategoryName(ticket).toLowerCase();
    return intake === "verification" || category.includes("verification");
  }).length;
}

function getSummaryStats(tickets) {
  return {
    total: tickets.length,
    open: countByStatus(tickets, "open"),
    claimed: countByStatus(tickets, "claimed"),
    urgent: countByPriority(tickets, "urgent"),
    high: countByPriority(tickets, "high"),
    missingChannel: tickets.filter((ticket) => hasMissingChannel(ticket)).length,
    ghosts: tickets.filter((ticket) => isGhost(ticket)).length,
    matched: countMatchedCategories(tickets),
    verificationLike: countVerificationLike(tickets),
  };
}

function summaryChip(label, value, tone = "default") {
  return (
    <div className={`queue-summary-chip ${tone}`}>
      <span className="queue-summary-chip-label">{label}</span>
      <span className="queue-summary-chip-value">{value}</span>
    </div>
  );
}

function metaBlock(label, value, full = false) {
  return (
    <div className={`ticket-mobile-meta-item ${full ? "full" : ""}`}>
      <span className="ticket-mobile-meta-label">{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function desktopMiniField(label, value) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function CategoryDisplay({ ticket, compact = false }) {
  const categoryName = getDisplayedCategoryName(ticket);
  const categorySlug = getDisplayedCategorySlug(ticket);
  const intakeType = getDisplayedIntakeType(ticket);
  const reason = getCategoryReason(ticket);
  const score = getCategoryScore(ticket);
  const matched = hasMatchedCategory(ticket);

  if (compact) {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span className={matched ? "badge claimed" : "badge"}>
            {categoryName}
          </span>
          {intakeType ? (
            <span className={badgeClass(intakeType)}>{intakeType}</span>
          ) : null}
        </div>

        {reason ? (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
            {reason} {score > 0 ? `• score ${score}` : ""}
          </div>
        ) : null}

        {categorySlug && categorySlug !== categoryName ? (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
            {categorySlug}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span className={matched ? "badge claimed" : "badge"}>
          {categoryName}
        </span>
        {intakeType ? (
          <span className={badgeClass(intakeType)}>{intakeType}</span>
        ) : null}
      </div>

      {reason ? (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          Match: {reason}
          {score > 0 ? ` • score ${score}` : ""}
        </div>
      ) : null}

      {categorySlug && categorySlug !== categoryName ? (
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
          {categorySlug}
        </div>
      ) : null}
    </div>
  );
}

function QuickModActions({ ticket, currentStaffId, onRefresh }) {
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState("10");

  async function queueAction(action, payload = {}) {
    setBusy(action);
    try {
      const res = await fetch("/api/dashboard/mod-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          action,
          payload: {
            ...payload,
            staff_id: currentStaffId,
            reason: String(reason || "").trim(),
          },
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to queue mod action.");
      }

      await onRefresh?.();
    } catch (err) {
      alert(err?.message || "Failed to queue mod action.");
    } finally {
      setBusy("");
    }
  }

  const userId = String(ticket?.user_id || "").trim();
  if (!userId || !currentStaffId) return null;

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        <input
          className="input"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <input
          className="input"
          placeholder="Timeout minutes"
          value={timeoutMinutes}
          onChange={(e) => setTimeoutMinutes(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() =>
            queueAction("timeout_member", {
              user_id: userId,
              minutes: Number(timeoutMinutes || 10),
            })
          }
        >
          {busy === "timeout_member" ? "Working..." : "Timeout"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() => queueAction("remove_timeout", { user_id: userId })}
        >
          {busy === "remove_timeout" ? "Working..." : "Remove Timeout"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() => queueAction("mute_member", { user_id: userId })}
        >
          {busy === "mute_member" ? "Working..." : "Mute VC"}
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() => queueAction("disconnect_member", { user_id: userId })}
        >
          {busy === "disconnect_member" ? "Working..." : "Disconnect VC"}
        </button>
      </div>
    </div>
  );
}

export default function TicketQueueTable({
  tickets = [],
  currentStaffId = null,
  onRefresh = async () => {},
  createTicketUserId = null,
  createTicketTargetName = "",
}) {
  const stats = getSummaryStats(tickets);

  return (
    <div className="card" id="tickets">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Active Ticket Queue</h2>
          <div className="muted" style={{ marginTop: 6 }}>
            Live active tickets only — open and claimed work ready for staff action
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div className="muted" style={{ fontSize: 14 }}>
            {tickets.length} active ticket{tickets.length === 1 ? "" : "s"}
          </div>

          {createTicketUserId ? (
            <CreateTicketButton
              userId={String(createTicketUserId)}
              currentStaffId={currentStaffId}
              onCreated={onRefresh}
              title={
                createTicketTargetName
                  ? `Create Ticket for ${createTicketTargetName}`
                  : "Create Ticket"
              }
            />
          ) : null}
        </div>
      </div>

      <div className="queue-summary-grid" style={{ marginBottom: 14 }}>
        {summaryChip("Total", stats.total)}
        {summaryChip("Open", stats.open, "open")}
        {summaryChip("Claimed", stats.claimed, "claimed")}
        {summaryChip("Urgent", stats.urgent, "danger")}
        {summaryChip("High", stats.high, "warn")}
        {summaryChip("Matched", stats.matched, stats.matched ? "claimed" : "default")}
        {summaryChip(
          "Verification",
          stats.verificationLike,
          stats.verificationLike ? "open" : "default"
        )}
        {summaryChip(
          "Missing Channel",
          stats.missingChannel,
          stats.missingChannel ? "danger" : "default"
        )}
        {summaryChip("Ghost", stats.ghosts, stats.ghosts ? "warn" : "default")}
      </div>

      {!tickets.length ? (
        <div className="empty-state">
          No active tickets match the current filters.
        </div>
      ) : null}

      {!!tickets.length ? (
        <>
          <div className="ticket-mobile-list" style={{ display: "grid", gap: 12 }}>
            {tickets.map((ticket) => {
              const status = getStatus(ticket);
              const channelId = getChannelId(ticket);
              const missingChannel = hasMissingChannel(ticket);
              const ghost = isGhost(ticket);

              return (
                <div
                  key={ticket.id}
                  className="ticket-mobile-card"
                  style={{
                    border: missingChannel
                      ? "1px solid rgba(248,113,113,0.28)"
                      : undefined,
                    boxShadow: missingChannel
                      ? "0 0 0 1px rgba(248,113,113,0.08)"
                      : undefined,
                  }}
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                      marginBottom: 10,
                      flexWrap: "nowrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <span className={badgeClass(status)}>
                          {safeText(ticket.status)}
                        </span>
                        <span className={badgeClass(ticket.priority)}>
                          {safeText(ticket.priority)}
                        </span>
                        {ghost ? <span className="badge">Ghost</span> : null}
                        {missingChannel ? (
                          <span className="badge danger">Missing Channel</span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          overflowWrap: "anywhere",
                          lineHeight: 1.15,
                        }}
                      >
                        {getTicketUserLabel(ticket)}
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          overflowWrap: "anywhere",
                          lineHeight: 1.35,
                        }}
                      >
                        {getTicketTitle(ticket)}
                      </div>
                    </div>

                    <div
                      className="muted"
                      style={{
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        textAlign: "right",
                      }}
                    >
                      {timeAgo(ticket.updated_at || ticket.created_at)}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <CategoryDisplay ticket={ticket} compact />
                  </div>

                  <div className="ticket-mobile-meta">
                    {metaBlock("Category", getDisplayedCategoryName(ticket))}
                    {metaBlock("Intake Type", getDisplayedIntakeType(ticket) || "—")}
                    {metaBlock("Claimed By", safeText(ticket.claimed_by))}
                    {metaBlock("Priority", safeText(ticket.priority))}
                    {metaBlock("Status", safeText(ticket.status))}
                    {metaBlock("Channel", channelId || "Missing", true)}
                    {metaBlock("User ID", safeText(ticket.user_id), true)}
                    {metaBlock("Ghost", ghost ? "yes" : "no")}
                    {metaBlock("Updated", timeAgo(ticket.updated_at || ticket.created_at))}
                    {metaBlock("Match Reason", getCategoryReason(ticket) || "—", true)}
                    {metaBlock("Suggestion", ticket.mod_suggestion || "—", true)}

                    {!!ticket.closed_reason ? (
                      metaBlock("Closed Reason", ticket.closed_reason, true)
                    ) : null}
                  </div>

                  <div
                    className="ticket-mobile-actions"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                      Open Ticket View
                    </Link>
                  </div>

                  <QuickModActions
                    ticket={ticket}
                    currentStaffId={currentStaffId}
                    onRefresh={onRefresh}
                  />

                  <TicketControls
                    ticket={ticket}
                    currentStaffId={currentStaffId}
                    onChanged={onRefresh}
                  />
                </div>
              );
            })}
          </div>

          <div className="ticket-desktop-table">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Category Intelligence</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Claimed By</th>
                    <th>Channel</th>
                    <th>Updated</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {tickets.map((ticket) => {
                    const channelId = getChannelId(ticket);
                    const status = getStatus(ticket);
                    const missingChannel = hasMissingChannel(ticket);
                    const ghost = isGhost(ticket);

                    return (
                      <tr
                        key={ticket.id}
                        style={
                          missingChannel
                            ? {
                                background: "rgba(248,113,113,0.04)",
                              }
                            : undefined
                        }
                      >
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginBottom: 6,
                              alignItems: "center",
                            }}
                          >
                            <span className={badgeClass(status)}>
                              {safeText(ticket.status)}
                            </span>
                            <span className={badgeClass(ticket.priority)}>
                              {safeText(ticket.priority)}
                            </span>
                            {ghost ? <span className="badge">Ghost</span> : null}
                            {missingChannel ? (
                              <span className="badge danger">Missing Channel</span>
                            ) : null}
                          </div>

                          <div style={{ fontWeight: 800 }}>
                            {getTicketUserLabel(ticket)}
                          </div>

                          <div
                            className="muted"
                            style={{
                              fontSize: 13,
                              marginTop: 4,
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                              lineHeight: 1.35,
                            }}
                          >
                            {getTicketTitle(ticket)}
                          </div>
                        </td>

                        <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                          <CategoryDisplay ticket={ticket} />
                        </td>

                        <td>
                          <span className={badgeClass(status)}>
                            {safeText(ticket.status)}
                          </span>
                        </td>

                        <td>
                          <span className={badgeClass(ticket.priority)}>
                            {safeText(ticket.priority)}
                          </span>
                        </td>

                        <td style={{ whiteSpace: "normal" }}>
                          {safeText(ticket.claimed_by)}
                        </td>

                        <td>
                          <div
                            style={{
                              fontSize: 13,
                              overflowWrap: "anywhere",
                              whiteSpace: "normal",
                              color: missingChannel ? "#fca5a5" : undefined,
                              fontWeight: missingChannel ? 700 : undefined,
                            }}
                          >
                            {channelId || "Missing"}
                          </div>
                        </td>

                        <td>{timeAgo(ticket.updated_at || ticket.created_at)}</td>

                        <td>
                          <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              {tickets.map((ticket) => {
                const channelId = getChannelId(ticket);
                const missingChannel = hasMissingChannel(ticket);
                const ghost = isGhost(ticket);

                return (
                  <div
                    key={`${ticket.id}-controls`}
                    className="card"
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      border: missingChannel
                        ? "1px solid rgba(248,113,113,0.24)"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: missingChannel
                        ? "rgba(248,113,113,0.04)"
                        : undefined,
                    }}
                  >
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <span className={badgeClass(ticket.status)}>
                            {safeText(ticket.status)}
                          </span>
                          <span className={badgeClass(ticket.priority)}>
                            {safeText(ticket.priority)}
                          </span>
                          {ghost ? <span className="badge">Ghost</span> : null}
                          {missingChannel ? (
                            <span className="badge danger">Missing Channel</span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 16,
                            overflowWrap: "anywhere",
                            lineHeight: 1.15,
                          }}
                        >
                          {getTicketUserLabel(ticket)}
                        </div>

                        <div
                          className="muted"
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            overflowWrap: "anywhere",
                            lineHeight: 1.35,
                          }}
                        >
                          {getTicketTitle(ticket)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <Link className="button ghost" href={`/tickets/${ticket.id}`}>
                          Open Ticket View
                        </Link>
                      </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <CategoryDisplay ticket={ticket} />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        marginBottom: 14,
                      }}
                    >
                      {desktopMiniField("Category", getDisplayedCategoryName(ticket))}
                      {desktopMiniField(
                        "Intake Type",
                        getDisplayedIntakeType(ticket) || "—"
                      )}
                      {desktopMiniField("Claimed By", safeText(ticket.claimed_by))}
                      {desktopMiniField("Channel ID", channelId || "Missing")}
                      {desktopMiniField("User ID", safeText(ticket.user_id))}
                      {desktopMiniField(
                        "Updated",
                        timeAgo(ticket.updated_at || ticket.created_at)
                      )}
                      {desktopMiniField("Ghost", ghost ? "yes" : "no")}
                      {desktopMiniField(
                        "Match Reason",
                        getCategoryReason(ticket) || "—"
                      )}
                    </div>

                    {!!ticket.mod_suggestion ? (
                      <div style={{ marginBottom: 14 }}>
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginBottom: 4 }}
                        >
                          Suggestion
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>
                          {ticket.mod_suggestion}
                        </div>
                      </div>
                    ) : null}

                    {!!ticket.closed_reason ? (
                      <div style={{ marginBottom: 14 }}>
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginBottom: 4 }}
                        >
                          Closed Reason
                        </div>
                        <div style={{ overflowWrap: "anywhere" }}>
                          {ticket.closed_reason}
                        </div>
                      </div>
                    ) : null}

                    <QuickModActions
                      ticket={ticket}
                      currentStaffId={currentStaffId}
                      onRefresh={onRefresh}
                    />

                    <TicketControls
                      ticket={ticket}
                      currentStaffId={currentStaffId}
                      onChanged={onRefresh}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <style jsx>{`
        .queue-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .queue-summary-chip {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.025);
          border-radius: 16px;
          padding: 12px;
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .queue-summary-chip.open {
          border-color: rgba(96, 165, 250, 0.2);
          background: rgba(96, 165, 250, 0.08);
        }

        .queue-summary-chip.claimed {
          border-color: rgba(74, 222, 128, 0.2);
          background: rgba(74, 222, 128, 0.08);
        }

        .queue-summary-chip.warn {
          border-color: rgba(251, 191, 36, 0.2);
          background: rgba(251, 191, 36, 0.08);
        }

        .queue-summary-chip.danger {
          border-color: rgba(248, 113, 113, 0.24);
          background: rgba(248, 113, 113, 0.08);
        }

        .queue-summary-chip-label {
          font-size: 12px;
          color: var(--muted);
        }

        .queue-summary-chip-value {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-strong);
          line-height: 1;
          overflow-wrap: anywhere;
        }

        @media (min-width: 768px) {
          .queue-summary-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (min-width: 1200px) {
          .queue-summary-grid {
            grid-template-columns: repeat(9, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
