"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import TicketMessageList from "@/components/TicketMessageList";
import TicketReplyBox from "@/components/TicketReplyBox";
import TicketControls from "@/components/dashboard/TicketControls";
import TicketVerificationActions from "@/components/TicketVerificationActions";

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function badgeClass(value) {
  const v = normalizeText(value);

  if (v === "open") return "badge open";
  if (v === "claimed") return "badge claimed";
  if (v === "closed") return "badge closed";
  if (v === "deleted") return "badge closed";

  if (v === "low") return "badge low";
  if (v === "medium") return "badge medium";
  if (v === "high") return "badge danger";
  if (v === "urgent") return "badge danger";

  if (v === "verified") return "badge claimed";
  if (v === "pending") return "badge open";
  if (v === "vc in progress") return "badge open";
  if (v === "needs review") return "badge danger";
  if (v === "denied") return "badge danger";
  if (v === "staff") return "badge claimed";

  if (v === "high risk") return "badge danger";
  if (v === "medium risk") return "badge medium";
  if (v === "low risk") return "badge low";

  return "badge";
}

function getCurrentStaffId(data) {
  return (
    String(data?.currentStaffId || "").trim() ||
    String(data?.viewer?.id || "").trim() ||
    String(data?.viewer?.user_id || "").trim() ||
    String(data?.session?.user?.id || "").trim() ||
    String(data?.session?.discordUser?.id || "").trim() ||
    ""
  );
}

function getOwnerName(ticket, member) {
  return (
    String(ticket?.owner_display_name || "").trim() ||
    String(member?.display_name || "").trim() ||
    String(member?.nickname || "").trim() ||
    String(member?.username || "").trim() ||
    String(ticket?.username || "").trim() ||
    String(ticket?.user_id || "").trim() ||
    "Unknown User"
  );
}

function getOwnerAvatar(ticket, member) {
  return (
    String(ticket?.owner_avatar_url || "").trim() ||
    String(member?.avatar_url || "").trim() ||
    ""
  );
}

function getOwnerInitials(ticket, member) {
  const source = getOwnerName(ticket, member);
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function getVerificationLabel(ticket, workspace) {
  return (
    String(ticket?.owner_verification_label || "").trim() ||
    String(workspace?.verificationLabel || "").trim() ||
    "Unknown"
  );
}

function getRiskLabel(ticket, workspace) {
  const raw =
    String(ticket?.risk_level || "").trim() ||
    String(workspace?.riskLevel || "").trim() ||
    "unknown";

  if (raw.toLowerCase() === "high") return "High Risk";
  if (raw.toLowerCase() === "medium") return "Medium Risk";
  if (raw.toLowerCase() === "low") return "Low Risk";
  return "Unknown";
}

function getClaimedLabel(ticket) {
  return (
    String(ticket?.claimed_by_name || "").trim() ||
    String(ticket?.assigned_to_name || "").trim() ||
    String(ticket?.claimed_by || "").trim() ||
    String(ticket?.assigned_to || "").trim() ||
    "Unclaimed"
  );
}

function getEntryLabel(ticket, member, latestJoin) {
  return (
    String(ticket?.owner_entry_method || "").trim() ||
    String(member?.entry_method || "").trim() ||
    String(member?.verification_source || "").trim() ||
    String(latestJoin?.entry_method || "").trim() ||
    String(latestJoin?.verification_source || "").trim() ||
    "Unknown"
  );
}

function getSlaLabel(ticket) {
  if (ticket?.overdue) {
    const minutes = Number(ticket?.minutes_overdue || 0);
    if (minutes > 0) return `${minutes}m overdue`;
    return "Overdue";
  }

  const left = Number(ticket?.minutes_until_deadline);
  if (Number.isFinite(left) && left > 0) {
    return `${left}m left`;
  }

  const status = String(ticket?.sla_status || "").trim();
  if (!status) return "No SLA";
  if (status === "counting_down") return "Countdown";
  if (status === "closed") return "Closed";
  if (status === "no_deadline") return "No SLA";
  return status;
}

function MetaCard({ label, value, full = false }) {
  return (
    <div className={`ticket-meta-card ${full ? "full" : ""}`}>
      <span className="ticket-meta-label">{label}</span>
      <span className="ticket-meta-value">{value}</span>
    </div>
  );
}

function SectionCard({ title, subtitle = "", children, right = null }) {
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>{title}</h2>
          {subtitle ? (
            <div className="muted" style={{ overflowWrap: "anywhere" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function TimelineItem({ item }) {
  return (
    <div className="timeline-item">
      <div className="timeline-dot" />
      <div className="timeline-body">
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div className="timeline-title">{safeText(item?.title)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {formatDateTime(item?.created_at)}
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {safeText(item?.source, "system")}
          {item?.actor_name ? ` • ${item.actor_name}` : ""}
        </div>

        {item?.description ? (
          <div className="timeline-description">{item.description}</div>
        ) : null}
      </div>
    </div>
  );
}

function IdentityBubble({ ticket, member }) {
  const avatar = getOwnerAvatar(ticket, member);
  const initials = getOwnerInitials(ticket, member);

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={getOwnerName(ticket, member)}
        className="ticket-owner-avatar"
      />
    );
  }

  return <div className="ticket-owner-avatar fallback">{initials}</div>;
}

export default function TicketDetailClient({ initialData, ticketId }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteMessage, setNoteMessage] = useState("");

  async function refresh({ silent = false } = {}) {
    if (!silent) setIsRefreshing(true);
    setError("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to refresh ticket.");
      }

      setData(json);
    } catch (err) {
      setError(err.message || "Failed to refresh ticket.");
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }

  async function saveInternalNote() {
    const content = String(note || "").trim();
    if (!content) return;

    setSavingNote(true);
    setNoteError("");
    setNoteMessage("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ content }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save internal note.");
      }

      setNote("");
      setNoteMessage("Internal note saved.");
      await refresh({ silent: true });
    } catch (err) {
      setNoteError(err?.message || "Failed to save internal note.");
    } finally {
      setSavingNote(false);
    }
  }

  useEffect(() => {
    refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    let supabase;
    let channel;

    async function handleRealtimeChange() {
      await refresh({ silent: true });
    }

    try {
      supabase = getBrowserSupabase();

      channel = supabase
        .channel(`ticket-${ticketId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ticket_notes", filter: `ticket_id=eq.${ticketId}` },
          handleRealtimeChange
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            refresh({ silent: true });
          }
        });
    } catch (err) {
      setError(err.message || "Realtime initialization failed.");
      return;
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const ticket = data?.ticket || {};
  const member = data?.member || {};
  const latestJoin = data?.latestJoin || {};
  const category = data?.category || {};
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const notes = Array.isArray(data?.notes) ? data.notes : [];
  const warns = Array.isArray(data?.warns) ? data.warns : [];
  const memberEvents = Array.isArray(data?.memberEvents) ? data.memberEvents : [];
  const verificationFlags = Array.isArray(data?.verificationFlags) ? data.verificationFlags : [];
  const verificationTokens = Array.isArray(data?.verificationTokens) ? data.verificationTokens : [];
  const vcSessions = Array.isArray(data?.vcSessions) ? data.vcSessions : [];
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const workspace = data?.workspace || {};
  const counts = data?.counts || {};

  const status = String(ticket.status || "open").toLowerCase();
  const priority = String(ticket.priority || "medium").toLowerCase();
  const currentStaffId = useMemo(() => getCurrentStaffId(data), [data]);

  const ownerName = getOwnerName(ticket, member);
  const verificationLabel = getVerificationLabel(ticket, workspace);
  const riskLabel = getRiskLabel(ticket, workspace);
  const recommendedActions = Array.isArray(ticket?.recommended_actions)
    ? ticket.recommended_actions
    : Array.isArray(workspace?.recommendedActions)
      ? workspace.recommendedActions
      : [];

  return (
    <>
      {error ? (
        <div className="error-banner" style={{ marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      <div className="card ticket-hero-card" style={{ marginBottom: 18 }}>
        <div className="ticket-hero-top">
          <div className="ticket-hero-owner">
            <IdentityBubble ticket={ticket} member={member} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Ticket Detail
              </div>

              <h1 className="ticket-hero-title">
                {ticket.title || "Ticket"}
              </h1>

              <div className="muted ticket-hero-subtitle">
                <span>{ownerName}</span>
                <span>•</span>
                <span>{safeText(category?.name || ticket?.matched_category_name || ticket?.category, "uncategorized")}</span>
                <span>•</span>
                <span>{safeText(ticket?.channel_id || ticket?.discord_thread_id, "Not linked")}</span>
              </div>
            </div>
          </div>

          <div className="ticket-hero-badges">
            <span className={badgeClass(status)}>{status}</span>
            <span className={badgeClass(priority)}>{priority}</span>
            <span className={badgeClass(verificationLabel)}>{verificationLabel}</span>
            <span className={badgeClass(riskLabel.toLowerCase())}>{riskLabel}</span>
            {ticket?.overdue ? <span className="badge danger">Overdue</span> : null}
          </div>
        </div>

        <div className="ticket-hero-toolbar">
          <div className="muted" style={{ minWidth: 0, flex: 1 }}>
            This view is built for fast staff decisions: member context, verification history,
            SLA pressure, note continuity, and a full ticket reply flow in one place.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              className="button ghost"
              href="/"
              style={{ width: "auto", minWidth: 170 }}
            >
              Back to Dashboard
            </Link>

            <button
              className="button ghost"
              type="button"
              onClick={() => refresh()}
              disabled={isRefreshing}
              style={{ width: "auto", minWidth: 110 }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <a
              className="button primary"
              href={`/api/tickets/${ticket.id || ticketId}/transcript`}
              target="_blank"
              rel="noreferrer"
              style={{ width: "auto", minWidth: 170 }}
            >
              Export Transcript
            </a>
          </div>
        </div>
      </div>

      <div className="ticket-shell">
        <div className="space">
          <SectionCard
            title="Workspace Summary"
            subtitle="The pieces that matter most before staff takes action."
            right={
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className={badgeClass(getVerificationLabel(ticket, workspace))}>
                  {getVerificationLabel(ticket, workspace)}
                </span>
                <span className={badgeClass(getRiskLabel(ticket, workspace).toLowerCase())}>
                  {getRiskLabel(ticket, workspace)}
                </span>
              </div>
            }
          >
            <div className="ticket-info-grid">
              <MetaCard label="SLA" value={getSlaLabel(ticket)} />
              <MetaCard label="Notes" value={String(Number(counts?.notes || notes.length || 0))} />
              <MetaCard label="Messages" value={String(Number(counts?.messages || messages.length || 0))} />
              <MetaCard label="Flags" value={String(Number(counts?.flags || 0))} />
              <MetaCard label="Warns" value={String(Number(counts?.warns || warns.length || 0))} />
              <MetaCard label="VC Sessions" value={String(Number(counts?.vcSessions || vcSessions.length || 0))} />
              <MetaCard label="Entry Method" value={getEntryLabel(ticket, member, latestJoin)} />
              <MetaCard label="Claimed By" value={getClaimedLabel(ticket)} />
              <MetaCard
                label="Latest Activity"
                value={
                  ticket?.latest_activity_at
                    ? `${safeText(ticket?.latest_activity_title || ticket?.latest_activity_type, "Activity")} • ${formatDateTime(ticket.latest_activity_at)}`
                    : "No recent activity"
                }
                full
              />
            </div>

            <div className="ticket-detail-section">
              <div className="ticket-detail-section-title">Recommended Actions</div>
              {!recommendedActions.length ? (
                <div className="muted">No suggested actions right now.</div>
              ) : (
                <div className="recommended-action-list">
                  {recommendedActions.map((action) => (
                    <div key={action} className="recommended-action-chip">
                      {action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Member Context"
            subtitle="How this person entered, what state they are in, and who is attached to their path."
          >
            <div className="ticket-info-grid">
              <MetaCard label="Display Name" value={ownerName} />
              <MetaCard label="Username" value={safeText(member?.username || ticket?.username)} />
              <MetaCard label="User ID" value={safeText(member?.user_id || ticket?.user_id)} />
              <MetaCard label="Role State" value={safeText(member?.role_state)} />
              <MetaCard label="Invited By" value={safeText(ticket?.owner_invited_by_name)} />
              <MetaCard label="Invite Code" value={safeText(ticket?.owner_invite_code)} />
              <MetaCard label="Vouched By" value={safeText(ticket?.owner_vouched_by_name)} />
              <MetaCard label="Approved By" value={safeText(ticket?.owner_approved_by_name)} />
              <MetaCard
                label="Role State Reason"
                value={safeText(member?.role_state_reason)}
                full
              />
              <MetaCard
                label="Entry Reason"
                value={safeText(member?.entry_reason || ticket?.owner_entry_reason)}
                full
              />
              <MetaCard
                label="Approval Reason"
                value={safeText(member?.approval_reason || ticket?.owner_approval_reason)}
                full
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Verification Context"
            subtitle="Manual review pressure, token status, and VC state all in one place."
          >
            <div className="ticket-info-grid">
              <MetaCard label="Verification Label" value={verificationLabel} />
              <MetaCard label="Latest Token Status" value={safeText(ticket?.owner_latest_token_status)} />
              <MetaCard label="Latest Token Decision" value={safeText(ticket?.owner_latest_token_decision)} />
              <MetaCard label="Latest VC Status" value={safeText(ticket?.owner_latest_vc_status)} />
              <MetaCard label="Flag Count" value={String(Number(ticket?.owner_flag_count || 0))} />
              <MetaCard label="Max Flag Score" value={String(Number(ticket?.owner_max_flag_score || 0))} />
            </div>

            {verificationFlags.length ? (
              <div className="ticket-detail-section">
                <div className="ticket-detail-section-title">Latest Verification Flags</div>
                <div className="space">
                  {verificationFlags.slice(0, 5).map((row) => (
                    <div key={row.id} className="message staff">
                      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800 }}>
                          Score {Number(row?.score || 0)} {row?.flagged ? "• Flagged" : ""}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {formatDateTime(row?.created_at)}
                        </div>
                      </div>
                      <div style={{ marginTop: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {Array.isArray(row?.reasons) && row.reasons.length
                          ? row.reasons.join(" • ")
                          : "No reasons recorded."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {verificationTokens.length ? (
              <div className="ticket-detail-section">
                <div className="ticket-detail-section-title">Recent Verification Tokens</div>
                <div className="space">
                  {verificationTokens.slice(0, 5).map((row) => (
                    <div key={row.token || row.created_at} className="message">
                      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800 }}>
                          {safeText(row?.status)} • {safeText(row?.decision)}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {formatDateTime(
                            row?.updated_at ||
                              row?.decided_at ||
                              row?.submitted_at ||
                              row?.created_at
                          )}
                        </div>
                      </div>
                      <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                        {row?.role_sync_reason || row?.ai_status || "No extra token notes."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {vcSessions.length ? (
              <div className="ticket-detail-section">
                <div className="ticket-detail-section-title">Recent VC Sessions</div>
                <div className="space">
                  {vcSessions.slice(0, 5).map((row) => (
                    <div key={row.token || row.created_at} className="message">
                      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800 }}>{safeText(row?.status)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {formatDateTime(
                            row?.completed_at ||
                              row?.started_at ||
                              row?.accepted_at ||
                              row?.canceled_at ||
                              row?.created_at
                          )}
                        </div>
                      </div>
                      <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                        Access Minutes: {Number(row?.access_minutes || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Ticket Snapshot"
            subtitle={`Ticket ID: ${ticket.id || ticketId}`}
            right={
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className={`badge ${status}`}>{status}</span>
                <span className={`badge ${priority}`}>{priority}</span>
              </div>
            }
          >
            <div className="ticket-info-grid">
              <MetaCard label="User" value={safeText(ticket.username || ticket.user_id)} />
              <MetaCard label="Category" value={safeText(category?.name || ticket.category)} />
              <MetaCard label="Claimed By" value={safeText(ticket.claimed_by_name || ticket.claimed_by)} />
              <MetaCard label="Assigned To" value={safeText(ticket.assigned_to_name || ticket.assigned_to)} />
              <MetaCard label="Closed By" value={safeText(ticket.closed_by_name || ticket.closed_by)} />
              <MetaCard label="Discord Channel" value={safeText(ticket.channel_id || ticket.discord_thread_id, "Not linked")} />
              <MetaCard label="Suggestion" value={safeText(ticket.mod_suggestion)} />
              <MetaCard label="Closed Reason" value={safeText(ticket.closed_reason)} />
              <MetaCard
                label="Category Description"
                value={safeText(category?.description)}
                full
              />
              <MetaCard
                label="Initial Message"
                value={safeText(ticket.initial_message)}
                full
              />
            </div>
          </SectionCard>

          <TicketControls
            ticket={ticket}
            currentStaffId={currentStaffId || null}
            onChanged={refresh}
          />

          <TicketVerificationActions
            ticket={ticket}
            currentStaffId={currentStaffId || null}
            onChanged={refresh}
          />

          <SectionCard
            title="Internal Notes"
            subtitle="Staff-only notes for continuity and decision memory."
          >
            {noteError ? (
              <div className="error-banner" style={{ marginBottom: 12 }}>
                {noteError}
              </div>
            ) : null}

            {noteMessage ? (
              <div className="info-banner" style={{ marginBottom: 12 }}>
                {noteMessage}
              </div>
            ) : null}

            <div className="space" style={{ marginBottom: 14 }}>
              <textarea
                className="textarea"
                rows="4"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add internal note..."
              />

              <button
                className="button ghost"
                disabled={savingNote || !note.trim()}
                onClick={saveInternalNote}
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>

            <div className="space">
              {!notes.length ? (
                <div className="empty-state">No internal notes yet.</div>
              ) : null}

              {notes.map((noteRow) => (
                <div key={noteRow.id} className="message staff">
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                      {noteRow.staff_name || noteRow.staff_id}
                    </div>

                    <div className="muted" style={{ fontSize: 12 }}>
                      Internal
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {noteRow.content}
                  </div>

                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    {formatDateTime(noteRow.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Timeline"
            subtitle="A stitched view of ticket, verification, note, and member activity."
          >
            {!timeline.length ? (
              <div className="empty-state">No timeline activity yet.</div>
            ) : (
              <div className="timeline-list">
                {timeline.map((item) => (
                  <TimelineItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space">
          <TicketMessageList messages={messages} />
          <TicketReplyBox ticketId={ticketId} onPosted={refresh} />
        </div>
      </div>

      <style jsx>{`
        .ticket-hero-card {
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.08), transparent 28%),
            radial-gradient(circle at bottom left, rgba(99,213,255,0.06), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .ticket-hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .ticket-hero-owner {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }

        .ticket-owner-avatar {
          width: 62px;
          height: 62px;
          border-radius: 999px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .ticket-owner-avatar.fallback {
          display: grid;
          place-items: center;
          font-weight: 900;
          color: white;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%),
            linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98));
        }

        .ticket-hero-title {
          margin: 0;
          font-size: clamp(30px, 5vw, 46px);
          line-height: 0.96;
          letter-spacing: -0.05em;
          overflow-wrap: anywhere;
        }

        .ticket-hero-subtitle {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          overflow-wrap: anywhere;
        }

        .ticket-hero-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        .ticket-hero-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .ticket-meta-card {
          display: grid;
          gap: 4px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
          min-width: 0;
        }

        .ticket-meta-card.full {
          grid-column: 1 / -1;
        }

        .ticket-meta-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .ticket-meta-value {
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          color: var(--text, #dbe4ee);
        }

        .ticket-detail-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .ticket-detail-section-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
          margin-bottom: 10px;
        }

        .recommended-action-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .recommended-action-chip {
          border-radius: 999px;
          padding: 7px 10px;
          border: 1px solid rgba(99,213,255,0.14);
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.10), transparent 42%),
            rgba(99,213,255,0.05);
          font-size: 12px;
          line-height: 1.2;
          color: var(--text, #dbe4ee);
        }

        .timeline-list {
          display: grid;
          gap: 12px;
        }

        .timeline-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .timeline-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-top: 8px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #63d5ff, #5dff8d);
          box-shadow: 0 0 0 4px rgba(99,213,255,0.10);
        }

        .timeline-body {
          flex: 1;
          min-width: 0;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .timeline-title {
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .timeline-description {
          margin-top: 8px;
          color: var(--text, #dbe4ee);
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.4;
        }
      `}</style>
    </>
  );
}
