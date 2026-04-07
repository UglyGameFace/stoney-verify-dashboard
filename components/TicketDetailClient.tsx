"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import TicketMessageList from "@/components/TicketMessageList";
import TicketReplyBox from "@/components/TicketReplyBox";
import TicketControls from "@/components/dashboard/TicketControls";
import TicketVerificationActions from "@/components/TicketVerificationActions";
import TicketTimelinePanel from "@/components/TicketTimelinePanel";
import TicketNotesPanel from "@/components/TicketNotesPanel";

type Dict = Record<string, any>;

type TicketApiResponse = {
  ok?: boolean;
  error?: string;
  ticket?: Dict | null;
  category?: Dict | null;
  member?: Dict | null;
  joins?: Dict[];
  latestJoin?: Dict | null;
  memberEvents?: Dict[];
  verificationFlags?: Dict[];
  verificationTokens?: Dict[];
  vcSessions?: Dict[];
  warns?: Dict[];
  activity?: Dict[];
  timeline?: Dict[];
  messages?: Dict[];
  notes?: Dict[];
  workspace?: Dict | null;
  counts?: Dict | null;
  viewer?: Dict | null;
  currentStaffId?: string | null;
};

type TicketDetailClientProps = {
  initialData: TicketApiResponse;
  ticketId: string;
};

type MetaCardProps = {
  label: string;
  value: ReactNode;
  full?: boolean;
};

type SectionCardProps = {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
};

type IdentityBubbleProps = {
  ticket: Dict;
  member: Dict;
};

type WorkspacePillProps = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
};

type QuickJumpItem = {
  href: string;
  label: string;
};

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    return new Date(String(value)).toLocaleString();
  } catch {
    return "—";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function badgeClass(value: unknown): string {
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

function getCurrentStaffId(data: TicketApiResponse | null | undefined): string {
  return (
    String(data?.currentStaffId || "").trim() ||
    String(data?.viewer?.id || "").trim() ||
    String((data?.viewer as Dict | undefined)?.user_id || "").trim() ||
    String((data as Dict | undefined)?.session?.user?.id || "").trim() ||
    String((data as Dict | undefined)?.session?.discordUser?.id || "").trim() ||
    ""
  );
}

function getOwnerName(ticket: Dict, member: Dict): string {
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

function getOwnerAvatar(ticket: Dict, member: Dict): string {
  return (
    String(ticket?.owner_avatar_url || "").trim() ||
    String(member?.avatar_url || "").trim() ||
    ""
  );
}

function getOwnerInitials(ticket: Dict, member: Dict): string {
  const source = getOwnerName(ticket, member);
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function getVerificationLabel(ticket: Dict, workspace: Dict): string {
  return (
    String(ticket?.owner_verification_label || "").trim() ||
    String(workspace?.verificationLabel || "").trim() ||
    "Unknown"
  );
}

function getRiskLabel(ticket: Dict, workspace: Dict): string {
  const raw =
    String(ticket?.risk_level || "").trim() ||
    String(workspace?.riskLevel || "").trim() ||
    "unknown";

  if (raw.toLowerCase() === "high") return "High Risk";
  if (raw.toLowerCase() === "medium") return "Medium Risk";
  if (raw.toLowerCase() === "low") return "Low Risk";
  return "Unknown";
}

function getClaimedLabel(ticket: Dict): string {
  return (
    String(ticket?.claimed_by_name || "").trim() ||
    String(ticket?.assigned_to_name || "").trim() ||
    String(ticket?.claimed_by || "").trim() ||
    String(ticket?.assigned_to || "").trim() ||
    "Unclaimed"
  );
}

function getEntryLabel(ticket: Dict, member: Dict, latestJoin: Dict): string {
  return (
    String(ticket?.owner_entry_method || "").trim() ||
    String(member?.entry_method || "").trim() ||
    String(member?.verification_source || "").trim() ||
    String(latestJoin?.entry_method || "").trim() ||
    String(latestJoin?.verification_source || "").trim() ||
    "Unknown"
  );
}

function getSlaLabel(ticket: Dict): string {
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

function transcriptExportUrl(ticketId: string, format?: "html" | "txt" | "json") {
  const encoded = encodeURIComponent(ticketId);
  if (!format || format === "html") return `/api/tickets/${encoded}/transcript`;
  return `/api/tickets/${encoded}/transcript?format=${format}`;
}

function WorkspacePill({ label, tone = "neutral" }: WorkspacePillProps) {
  const toneClass =
    tone === "good"
      ? "good"
      : tone === "warn"
        ? "warn"
        : tone === "danger"
          ? "danger"
          : tone === "info"
            ? "info"
            : "neutral";

  return <span className={`workspace-pill ${toneClass}`}>{label}</span>;
}

function MetaCard({ label, value, full = false }: MetaCardProps) {
  return (
    <div className={`ticket-meta-card ${full ? "full" : ""}`}>
      <span className="ticket-meta-label">{label}</span>
      <span className="ticket-meta-value">{value}</span>
    </div>
  );
}

function SectionCard({
  id,
  title,
  subtitle = "",
  children,
  right = null,
}: SectionCardProps) {
  return (
    <div className="card scroll-section" id={id}>
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

function IdentityBubble({ ticket, member }: IdentityBubbleProps) {
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

export default function TicketDetailClient({
  initialData,
  ticketId,
}: TicketDetailClientProps) {
  const [data, setData] = useState<TicketApiResponse>(initialData);
  const [error, setError] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  async function refresh({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setIsRefreshing(true);
    setError("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const json = (await res.json()) as TicketApiResponse;

      if (!res.ok) {
        throw new Error(json.error || "Failed to refresh ticket.");
      }

      setData(json);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to refresh ticket."));
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    let supabase: any;
    let channel: any;

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
          {
            event: "*",
            schema: "public",
            table: "ticket_messages",
            filter: `ticket_id=eq.${ticketId}`,
          },
          handleRealtimeChange
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ticket_notes",
            filter: `ticket_id=eq.${ticketId}`,
          },
          handleRealtimeChange
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            void refresh({ silent: true });
          }
        });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Realtime initialization failed."));
      return;
    }

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const ticket = (data?.ticket || {}) as Dict;
  const member = (data?.member || {}) as Dict;
  const latestJoin = (data?.latestJoin || {}) as Dict;
  const category = (data?.category || {}) as Dict;
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const notes = Array.isArray(data?.notes) ? data.notes : [];
  const warns = Array.isArray(data?.warns) ? data.warns : [];
  const verificationFlags = Array.isArray(data?.verificationFlags)
    ? data.verificationFlags
    : [];
  const verificationTokens = Array.isArray(data?.verificationTokens)
    ? data.verificationTokens
    : [];
  const vcSessions = Array.isArray(data?.vcSessions) ? data.vcSessions : [];
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const workspace = (data?.workspace || {}) as Dict;
  const counts = (data?.counts || {}) as Dict;

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

  const transcriptUrl =
    String(ticket?.transcript_url || "").trim() ||
    transcriptExportUrl(String(ticket.id || ticketId), "html");

  const quickJumps: QuickJumpItem[] = [
    { href: "#workspace-summary", label: "Summary" },
    { href: "#member-context", label: "Member" },
    { href: "#verification-context", label: "Verification" },
    { href: "#ticket-snapshot", label: "Snapshot" },
    { href: "#notes", label: "Notes" },
    { href: "#timeline", label: "Timeline" },
    { href: "#conversation", label: "Conversation" },
  ];

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

              <h1 className="ticket-hero-title">{ticket.title || "Ticket"}</h1>

              <div className="muted ticket-hero-subtitle">
                <span>{ownerName}</span>
                <span>•</span>
                <span>
                  {safeText(
                    category?.name || ticket?.matched_category_name || ticket?.category,
                    "uncategorized"
                  )}
                </span>
                <span>•</span>
                <span>
                  {safeText(
                    ticket?.channel_id || ticket?.discord_thread_id,
                    "Not linked"
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="ticket-hero-badges">
            <span className={badgeClass(status)}>{status}</span>
            <span className={badgeClass(priority)}>{priority}</span>
            <span className={badgeClass(verificationLabel)}>
              {verificationLabel}
            </span>
            <span className={badgeClass(riskLabel.toLowerCase())}>
              {riskLabel}
            </span>
            {ticket?.overdue ? <span className="badge danger">Overdue</span> : null}
            {ticket?.category_override ? (
              <span className="badge medium">Manual Category</span>
            ) : null}
          </div>
        </div>

        <div className="ticket-hero-toolbar">
          <div className="muted" style={{ minWidth: 0, flex: 1 }}>
            This view is built for fast staff decisions: member context,
            verification history, SLA pressure, note continuity, category control,
            and the full reply flow in one place.
          </div>

          <div
            className="row"
            style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}
          >
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
              onClick={() => void refresh()}
              disabled={isRefreshing}
              style={{ width: "auto", minWidth: 110 }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <a
              className="button primary"
              href={transcriptExportUrl(String(ticket.id || ticketId), "html")}
              target="_blank"
              rel="noreferrer"
              style={{ width: "auto", minWidth: 170 }}
            >
              Export Transcript
            </a>
          </div>
        </div>

        <div className="ticket-workspace-pills">
          <WorkspacePill
            label={`Status: ${safeText(ticket?.status, "unknown")}`}
            tone={
              status === "deleted"
                ? "danger"
                : status === "closed"
                  ? "warn"
                  : status === "claimed"
                    ? "good"
                    : "info"
            }
          />
          <WorkspacePill
            label={`SLA: ${getSlaLabel(ticket)}`}
            tone={ticket?.overdue ? "danger" : "info"}
          />
          <WorkspacePill
            label={`Messages: ${Number(counts?.messages || messages.length || 0)}`}
            tone="neutral"
          />
          <WorkspacePill
            label={`Notes: ${Number(counts?.notes || notes.length || 0)}`}
            tone="neutral"
          />
          <WorkspacePill
            label={`Flags: ${Number(counts?.flags || 0)}`}
            tone={Number(counts?.flags || 0) > 0 ? "warn" : "good"}
          />
          <WorkspacePill
            label={`Warns: ${Number(counts?.warns || warns.length || 0)}`}
            tone={Number(counts?.warns || warns.length || 0) > 0 ? "warn" : "good"}
          />
          <WorkspacePill
            label={`VC: ${Number(counts?.vcSessions || vcSessions.length || 0)}`}
            tone="info"
          />
        </div>

        <div className="ticket-hero-link-row">
          <a
            className="button ghost"
            href={transcriptExportUrl(String(ticket.id || ticketId), "html")}
            target="_blank"
            rel="noreferrer"
            style={{ width: "auto" }}
          >
            HTML
          </a>
          <a
            className="button ghost"
            href={transcriptExportUrl(String(ticket.id || ticketId), "txt")}
            target="_blank"
            rel="noreferrer"
            style={{ width: "auto" }}
          >
            TXT
          </a>
          <a
            className="button ghost"
            href={transcriptExportUrl(String(ticket.id || ticketId), "json")}
            target="_blank"
            rel="noreferrer"
            style={{ width: "auto" }}
          >
            JSON
          </a>
          {ticket?.transcript_url ? (
            <a
              className="button ghost"
              href={transcriptUrl}
              target="_blank"
              rel="noreferrer"
              style={{ width: "auto" }}
            >
              Stored Transcript
            </a>
          ) : null}
        </div>
      </div>

      <div className="ticket-jump-strip">
        {quickJumps.map((item) => (
          <a key={item.href} href={item.href} className="ticket-jump-chip">
            {item.label}
          </a>
        ))}
      </div>

      <div className="ticket-shell">
        <div className="space">
          <SectionCard
            id="workspace-summary"
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
              <MetaCard
                label="Notes"
                value={String(Number(counts?.notes || notes.length || 0))}
              />
              <MetaCard
                label="Messages"
                value={String(Number(counts?.messages || messages.length || 0))}
              />
              <MetaCard
                label="Flags"
                value={String(Number(counts?.flags || 0))}
              />
              <MetaCard
                label="Warns"
                value={String(Number(counts?.warns || warns.length || 0))}
              />
              <MetaCard
                label="VC Sessions"
                value={String(Number(counts?.vcSessions || vcSessions.length || 0))}
              />
              <MetaCard
                label="Entry Method"
                value={getEntryLabel(ticket, member, latestJoin)}
              />
              <MetaCard label="Claimed By" value={getClaimedLabel(ticket)} />
              <MetaCard
                label="Latest Activity"
                value={
                  ticket?.latest_activity_at
                    ? `${safeText(
                        ticket?.latest_activity_title || ticket?.latest_activity_type,
                        "Activity"
                      )} • ${formatDateTime(ticket.latest_activity_at)}`
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
                  {recommendedActions.map((action: string) => (
                    <div key={action} className="recommended-action-chip">
                      {action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="member-context"
            title="Member Context"
            subtitle="How this person entered, what state they are in, and who is attached to their path."
          >
            <div className="ticket-info-grid">
              <MetaCard label="Display Name" value={ownerName} />
              <MetaCard
                label="Username"
                value={safeText(member?.username || ticket?.username)}
              />
              <MetaCard
                label="User ID"
                value={safeText(member?.user_id || ticket?.user_id)}
              />
              <MetaCard label="Role State" value={safeText(member?.role_state)} />
              <MetaCard
                label="Invited By"
                value={safeText(ticket?.owner_invited_by_name)}
              />
              <MetaCard
                label="Invite Code"
                value={safeText(ticket?.owner_invite_code)}
              />
              <MetaCard
                label="Vouched By"
                value={safeText(ticket?.owner_vouched_by_name)}
              />
              <MetaCard
                label="Approved By"
                value={safeText(ticket?.owner_approved_by_name)}
              />
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
                value={safeText(
                  member?.approval_reason || ticket?.owner_approval_reason
                )}
                full
              />
            </div>
          </SectionCard>

          <SectionCard
            id="verification-context"
            title="Verification Context"
            subtitle="Manual review pressure, token status, and VC state all in one place."
          >
            <div className="ticket-info-grid">
              <MetaCard label="Verification Label" value={verificationLabel} />
              <MetaCard
                label="Latest Token Status"
                value={safeText(ticket?.owner_latest_token_status)}
              />
              <MetaCard
                label="Latest Token Decision"
                value={safeText(ticket?.owner_latest_token_decision)}
              />
              <MetaCard
                label="Latest VC Status"
                value={safeText(ticket?.owner_latest_vc_status)}
              />
              <MetaCard
                label="Flag Count"
                value={String(Number(ticket?.owner_flag_count || 0))}
              />
              <MetaCard
                label="Max Flag Score"
                value={String(Number(ticket?.owner_max_flag_score || 0))}
              />
            </div>

            {verificationFlags.length ? (
              <div className="ticket-detail-section">
                <div className="ticket-detail-section-title">
                  Latest Verification Flags
                </div>
                <div className="space">
                  {verificationFlags.slice(0, 5).map((row: Dict) => (
                    <div key={row.id} className="message staff">
                      <div
                        className="row"
                        style={{
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          Score {Number(row?.score || 0)} {row?.flagged ? "• Flagged" : ""}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {formatDateTime(row?.created_at)}
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
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
                <div className="ticket-detail-section-title">
                  Recent Verification Tokens
                </div>
                <div className="space">
                  {verificationTokens.slice(0, 5).map((row: Dict) => (
                    <div
                      key={row.token || row.created_at}
                      className="message"
                    >
                      <div
                        className="row"
                        style={{
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
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
                        {row?.role_sync_reason ||
                          row?.ai_status ||
                          "No extra token notes."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {vcSessions.length ? (
              <div className="ticket-detail-section">
                <div className="ticket-detail-section-title">
                  Recent VC Sessions
                </div>
                <div className="space">
                  {vcSessions.slice(0, 5).map((row: Dict) => (
                    <div key={row.token || row.created_at} className="message">
                      <div
                        className="row"
                        style={{
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>
                          {safeText(row?.status)}
                        </div>
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
            id="ticket-snapshot"
            title="Ticket Snapshot"
            subtitle={`Ticket ID: ${ticket.id || ticketId}`}
            right={
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className={badgeClass(status)}>{status}</span>
                <span className={badgeClass(priority)}>{priority}</span>
              </div>
            }
          >
            <div className="ticket-info-grid">
              <MetaCard label="User" value={safeText(ticket.username || ticket.user_id)} />
              <MetaCard label="Category" value={safeText(category?.name || ticket.category)} />
              <MetaCard
                label="Claimed By"
                value={safeText(ticket.claimed_by_name || ticket.claimed_by)}
              />
              <MetaCard
                label="Assigned To"
                value={safeText(ticket.assigned_to_name || ticket.assigned_to)}
              />
              <MetaCard
                label="Closed By"
                value={safeText(ticket.closed_by_name || ticket.closed_by)}
              />
              <MetaCard
                label="Discord Channel"
                value={safeText(
                  ticket.channel_id || ticket.discord_thread_id,
                  "Not linked"
                )}
              />
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

          <div id="notes">
            <TicketNotesPanel
              ticketId={ticketId}
              notes={notes}
              onSaved={refresh}
            />
          </div>

          <div id="timeline">
            <TicketTimelinePanel
              items={timeline}
              title="Timeline"
              subtitle="A stitched view of ticket, verification, note, and member activity."
            />
          </div>
        </div>

        <div className="space" id="conversation">
          <SectionCard
            title="Conversation"
            subtitle="Live ticket messages and staff replies."
            right={
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <WorkspacePill
                  label={`${Number(counts?.messages || messages.length || 0)} messages`}
                  tone="info"
                />
                <WorkspacePill
                  label={`${Number(counts?.notes || notes.length || 0)} notes`}
                  tone="neutral"
                />
              </div>
            }
          >
            <TicketMessageList messages={messages} />
          </SectionCard>

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

        .ticket-workspace-pills {
          margin-top: 14px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .workspace-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .workspace-pill.good {
          border-color: rgba(93,255,141,0.24);
          background: rgba(93,255,141,0.08);
        }

        .workspace-pill.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .workspace-pill.danger {
          border-color: rgba(248,113,113,0.22);
          background: rgba(248,113,113,0.08);
        }

        .workspace-pill.info {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .ticket-hero-link-row {
          margin-top: 14px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .ticket-jump-strip {
          position: sticky;
          top: 10px;
          z-index: 8;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 18px;
          padding: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          background: rgba(9, 16, 24, 0.92);
          backdrop-filter: blur(10px);
        }

        .ticket-jump-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 8px 12px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          white-space: nowrap;
        }

        .ticket-jump-chip:hover {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
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

        @media (max-width: 900px) {
          .ticket-jump-strip {
            top: 6px;
          }
        }

        @media (max-width: 640px) {
          .ticket-hero-toolbar,
          .ticket-hero-link-row {
            display: grid;
            grid-template-columns: 1fr;
          }

          .ticket-hero-link-row :global(.button),
          .ticket-hero-toolbar :global(.button),
          .ticket-hero-link-row a {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </>
  );
}
