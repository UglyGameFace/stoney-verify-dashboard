"use client";

import { useMemo, useState, type ReactNode } from "react";

type Dict = Record<string, any>;

type TicketMemberContextPanelProps = {
  ticket: Dict;
  member: Dict;
  latestJoin?: Dict | null;
  joins?: Dict[];
  warns?: Dict[];
  memberEvents?: Dict[];
};

type DetailCardProps = {
  label: string;
  value: ReactNode;
  full?: boolean;
};

type Tone =
  | "neutral"
  | "good"
  | "warn"
  | "danger"
  | "info";

function safeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  } catch {
    return "—";
  }
}

function uniqueStrings(values: unknown): string[] {
  const items = safeArray(values)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  return [...new Set(items)];
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

function getRoleStateTone(roleState: string): Tone {
  const value = normalizeText(roleState);

  if (
    value === "verified_ok" ||
    value === "staff_ok" ||
    value === "bot_ok"
  ) {
    return "good";
  }

  if (
    value === "verified_conflict" ||
    value === "staff_conflict" ||
    value === "missing_verified_role" ||
    value === "missing_unverified" ||
    value === "left_guild"
  ) {
    return "danger";
  }

  if (
    value === "unverified_only" ||
    value === "booster_only" ||
    value === "unknown"
  ) {
    return "warn";
  }

  return "neutral";
}

function getEntryMethod(ticket: Dict, member: Dict, latestJoin: Dict): string {
  return (
    String(ticket?.owner_entry_method || "").trim() ||
    String(member?.entry_method || "").trim() ||
    String(latestJoin?.entry_method || "").trim() ||
    String(ticket?.owner_verification_source || "").trim() ||
    String(member?.verification_source || "").trim() ||
    String(latestJoin?.verification_source || "").trim() ||
    "Unknown"
  );
}

function getCurrentRolePills(ticket: Dict, member: Dict): Array<{
  label: string;
  tone: Tone;
}> {
  const items: Array<{ label: string; tone: Tone }> = [];

  if (normalizeBoolean(ticket?.owner_has_unverified) || normalizeBoolean(member?.has_unverified)) {
    items.push({ label: "Unverified", tone: "warn" });
  }

  if (
    normalizeBoolean(ticket?.owner_has_verified_role) ||
    normalizeBoolean(member?.has_verified_role)
  ) {
    items.push({ label: "Verified Role", tone: "good" });
  }

  if (
    normalizeBoolean(ticket?.owner_has_staff_role) ||
    normalizeBoolean(member?.has_staff_role)
  ) {
    items.push({ label: "Staff Role", tone: "info" });
  }

  if (normalizeBoolean(member?.has_secondary_verified_role)) {
    items.push({ label: "Secondary Verified", tone: "info" });
  }

  if (normalizeBoolean(member?.has_cosmetic_only)) {
    items.push({ label: "Cosmetic Only", tone: "neutral" });
  }

  if (!items.length) {
    items.push({ label: "No Role Markers", tone: "neutral" });
  }

  return items;
}

function DetailCard({ label, value, full = false }: DetailCardProps) {
  return (
    <div className={`member-context-detail-card ${full ? "full" : ""}`}>
      <div className="member-context-detail-label">{label}</div>
      <div className="member-context-detail-value">{value}</div>
    </div>
  );
}

function ContextPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return <span className={`member-context-pill ${tone}`}>{label}</span>;
}

export default function TicketMemberContextPanel({
  ticket,
  member,
  latestJoin = null,
  joins = [],
  warns = [],
  memberEvents = [],
}: TicketMemberContextPanelProps) {
  const [copied, setCopied] = useState(false);

  const ownerName = getOwnerName(ticket, member);
  const ownerAvatar = getOwnerAvatar(ticket, member);
  const ownerInitials = getOwnerInitials(ticket, member);

  const userId = safeText(member?.user_id || ticket?.user_id, "");
  const roleState = safeText(member?.role_state || ticket?.owner_role_state, "unknown");
  const roleStateReason = safeText(
    member?.role_state_reason || ticket?.owner_role_state_reason,
    "No role-state explanation."
  );

  const entryMethod = getEntryMethod(ticket, member, latestJoin || {});
  const invitedBy = safeText(
    ticket?.owner_invited_by_name || member?.invited_by_name || latestJoin?.invited_by_name,
    "—"
  );
  const vouchedBy = safeText(
    ticket?.owner_vouched_by_name || member?.vouched_by_name || latestJoin?.vouched_by_name,
    "—"
  );
  const approvedBy = safeText(
    ticket?.owner_approved_by_name || member?.approved_by_name || latestJoin?.approved_by_name,
    "—"
  );
  const inviteCode = safeText(
    ticket?.owner_invite_code || member?.invite_code || latestJoin?.invite_code,
    "—"
  );

  const previousUsernames = uniqueStrings(member?.previous_usernames);
  const previousDisplayNames = uniqueStrings(member?.previous_display_names);
  const previousNicknames = uniqueStrings(member?.previous_nicknames);
  const roleNames = uniqueStrings(member?.role_names);

  const rolePills = useMemo(
    () => getCurrentRolePills(ticket, member),
    [ticket, member]
  );

  const recentJoins = safeArray<Dict>(joins).slice(0, 5);
  const recentEvents = safeArray<Dict>(memberEvents).slice(0, 6);
  const recentWarns = safeArray<Dict>(warns).slice(0, 5);

  const timesJoined = normalizeNumber(member?.times_joined, recentJoins.length ? recentJoins.length : 1);
  const timesLeft = normalizeNumber(member?.times_left, 0);

  async function copyUserId() {
    if (!userId || !navigator?.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card member-context-panel-card">
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
          <div
            className="muted"
            style={{
              marginBottom: 8,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Member Context
          </div>

          <h2 style={{ margin: 0 }}>Member Context</h2>
          <div className="muted" style={{ marginTop: 6, overflowWrap: "anywhere" }}>
            Identity, entry path, role state, prior names, join history, and
            staff-relevant member memory in one place.
          </div>
        </div>

        <div className="member-context-pill-row">
          <ContextPill
            label={`Role State: ${roleState}`}
            tone={getRoleStateTone(roleState)}
          />
          <ContextPill
            label={`Warns: ${recentWarns.length}`}
            tone={recentWarns.length > 0 ? "warn" : "good"}
          />
          <ContextPill
            label={`Joined: ${timesJoined}`}
            tone="info"
          />
          <ContextPill
            label={`Left: ${timesLeft}`}
            tone={timesLeft > 0 ? "warn" : "neutral"}
          />
        </div>
      </div>

      <div className="member-context-header">
        <div className="member-context-identity">
          {ownerAvatar ? (
            <img
              src={ownerAvatar}
              alt={ownerName}
              className="member-context-avatar"
            />
          ) : (
            <div className="member-context-avatar fallback">{ownerInitials}</div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="member-context-name-row">
              <div className="member-context-name">{ownerName}</div>
              {userId ? (
                <button
                  type="button"
                  className="member-context-copy-button"
                  onClick={() => void copyUserId()}
                >
                  {copied ? "Copied" : "Copy ID"}
                </button>
              ) : null}
            </div>

            <div className="member-context-subline">
              <span>{safeText(member?.username || ticket?.username, "Unknown Username")}</span>
              {userId ? (
                <>
                  <span>•</span>
                  <span>{userId}</span>
                </>
              ) : null}
            </div>

            <div className="member-context-role-pills">
              {rolePills.map((item) => (
                <ContextPill
                  key={item.label}
                  label={item.label}
                  tone={item.tone}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="member-context-detail-grid">
        <DetailCard label="Entry Method" value={entryMethod} />
        <DetailCard label="Invited By" value={invitedBy} />
        <DetailCard label="Vouched By" value={vouchedBy} />
        <DetailCard label="Approved By" value={approvedBy} />
        <DetailCard label="Invite Code" value={inviteCode} />
        <DetailCard
          label="In Guild"
          value={normalizeBoolean(member?.in_guild) ? "Yes" : "No"}
        />
        <DetailCard
          label="First Seen"
          value={formatDateTime(member?.first_seen_at)}
        />
        <DetailCard
          label="Last Seen"
          value={formatDateTime(member?.last_seen_at)}
        />
        <DetailCard
          label="Joined At"
          value={formatDateTime(member?.joined_at || latestJoin?.joined_at)}
        />
        <DetailCard
          label="Left At"
          value={formatDateTime(member?.left_at)}
        />
        <DetailCard
          label="Rejoined At"
          value={formatDateTime(member?.rejoined_at)}
        />
        <DetailCard
          label="Verification Ticket"
          value={safeText(member?.verification_ticket_id || ticket?.verification_ticket_id)}
        />
        <DetailCard
          label="Source Ticket"
          value={safeText(member?.source_ticket_id || ticket?.source_ticket_id)}
        />
        <DetailCard
          label="Top Role"
          value={safeText(member?.top_role || member?.highest_role_name)}
        />
        <DetailCard
          label="Bot Account"
          value={normalizeBoolean(member?.is_bot) ? "Yes" : "No"}
        />
        <DetailCard
          label="Role State Reason"
          value={roleStateReason}
          full
        />
        <DetailCard
          label="Entry Reason"
          value={safeText(member?.entry_reason || ticket?.owner_entry_reason)}
          full
        />
        <DetailCard
          label="Approval Reason"
          value={safeText(member?.approval_reason || ticket?.owner_approval_reason)}
          full
        />
      </div>

      {(roleNames.length > 0 ||
        previousUsernames.length > 0 ||
        previousDisplayNames.length > 0 ||
        previousNicknames.length > 0) ? (
        <div className="member-context-section">
          <div className="member-context-section-title">Identity & Role Memory</div>

          <div className="member-context-memory-grid">
            <DetailCard
              label="Current Roles"
              value={
                roleNames.length ? roleNames.join(" • ") : "No tracked roles"
              }
              full
            />
            <DetailCard
              label="Previous Usernames"
              value={
                previousUsernames.length
                  ? previousUsernames.join(" • ")
                  : "None recorded"
              }
              full
            />
            <DetailCard
              label="Previous Display Names"
              value={
                previousDisplayNames.length
                  ? previousDisplayNames.join(" • ")
                  : "None recorded"
              }
              full
            />
            <DetailCard
              label="Previous Nicknames"
              value={
                previousNicknames.length
                  ? previousNicknames.join(" • ")
                  : "None recorded"
              }
              full
            />
          </div>
        </div>
      ) : null}

      <div className="member-context-two-col">
        <div className="member-context-column-card">
          <div className="member-context-section-title">Recent Join History</div>

          {!recentJoins.length ? (
            <div className="empty-state">No join history recorded.</div>
          ) : (
            <div className="member-context-list">
              {recentJoins.map((row, index) => (
                <div
                  key={String(row?.id || `${row?.joined_at || "join"}-${index}`)}
                  className="member-context-list-item"
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="member-context-list-title">
                      {safeText(row?.entry_method || row?.verification_source, "Join Event")}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {formatDateTime(row?.joined_at)}
                    </div>
                  </div>

                  <div className="member-context-list-meta">
                    <span>Invite: {safeText(row?.invite_code)}</span>
                    <span>•</span>
                    <span>Invited By: {safeText(row?.invited_by_name)}</span>
                  </div>

                  {row?.join_note ? (
                    <div className="member-context-list-body">{row.join_note}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="member-context-column-card">
          <div className="member-context-section-title">Recent Member Events</div>

          {!recentEvents.length ? (
            <div className="empty-state">No member events recorded.</div>
          ) : (
            <div className="member-context-list">
              {recentEvents.map((row, index) => (
                <div
                  key={String(row?.id || `${row?.created_at || "event"}-${index}`)}
                  className="member-context-list-item"
                >
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="member-context-list-title">
                      {safeText(row?.title || row?.event_type, "Member Event")}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {formatDateTime(row?.created_at)}
                    </div>
                  </div>

                  <div className="member-context-list-meta">
                    <span>Actor: {safeText(row?.actor_name || row?.actor_id, "System")}</span>
                  </div>

                  {row?.reason ? (
                    <div className="member-context-list-body">{row.reason}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="member-context-section">
        <div className="member-context-section-title">Recent Warns</div>

        {!recentWarns.length ? (
          <div className="empty-state">No warns recorded.</div>
        ) : (
          <div className="member-context-list">
            {recentWarns.map((row, index) => (
              <div
                key={String(row?.id || `${row?.created_at || "warn"}-${index}`)}
                className="member-context-list-item warn"
              >
                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div className="member-context-list-title">Warning</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {formatDateTime(row?.created_at)}
                  </div>
                </div>

                <div className="member-context-list-body">
                  {safeText(row?.reason, "No reason recorded.")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .member-context-panel-card {
          background:
            radial-gradient(circle at top right, rgba(99,213,255,0.06), transparent 28%),
            radial-gradient(circle at bottom left, rgba(93,255,141,0.05), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            linear-gradient(180deg, rgba(14, 25, 35, 0.98), rgba(7, 13, 21, 0.98));
        }

        .member-context-pill-row,
        .member-context-role-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .member-context-pill {
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

        .member-context-pill.good {
          border-color: rgba(93,255,141,0.24);
          background: rgba(93,255,141,0.08);
        }

        .member-context-pill.warn {
          border-color: rgba(251,191,36,0.22);
          background: rgba(251,191,36,0.08);
        }

        .member-context-pill.danger {
          border-color: rgba(248,113,113,0.22);
          background: rgba(248,113,113,0.08);
        }

        .member-context-pill.info {
          border-color: rgba(99,213,255,0.22);
          background: rgba(99,213,255,0.08);
        }

        .member-context-header {
          margin-bottom: 14px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .member-context-identity {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          min-width: 0;
        }

        .member-context-avatar {
          width: 62px;
          height: 62px;
          border-radius: 999px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .member-context-avatar.fallback {
          display: grid;
          place-items: center;
          font-weight: 900;
          color: white;
          background:
            radial-gradient(circle at top right, rgba(93,255,141,0.18), transparent 45%),
            linear-gradient(180deg, rgba(46,77,102,0.98), rgba(20,35,50,0.98));
        }

        .member-context-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .member-context-name {
          font-size: 22px;
          font-weight: 900;
          line-height: 1.1;
          color: var(--text-strong, #f8fafc);
          overflow-wrap: anywhere;
        }

        .member-context-copy-button {
          appearance: none;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text, #dbe4ee);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .member-context-subline {
          margin-top: 6px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--muted, #9fb0c3);
          font-size: 13px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .member-context-role-pills {
          margin-top: 10px;
        }

        .member-context-detail-grid,
        .member-context-memory-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .member-context-detail-card {
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

        .member-context-detail-card.full {
          grid-column: 1 / -1;
        }

        .member-context-detail-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted, #9fb0c3);
        }

        .member-context-detail-value {
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          color: var(--text, #dbe4ee);
          line-height: 1.45;
        }

        .member-context-section {
          margin-top: 16px;
        }

        .member-context-section-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted, #9fb0c3);
          margin-bottom: 10px;
        }

        .member-context-two-col {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .member-context-column-card {
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .member-context-list {
          display: grid;
          gap: 10px;
        }

        .member-context-list-item {
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
        }

        .member-context-list-item.warn {
          border-color: rgba(251,191,36,0.18);
          background:
            radial-gradient(circle at top right, rgba(251,191,36,0.08), transparent 42%),
            rgba(255,255,255,0.02);
        }

        .member-context-list-title {
          font-weight: 800;
          color: var(--text-strong, #f8fafc);
          overflow-wrap: anywhere;
        }

        .member-context-list-meta {
          margin-top: 4px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--muted, #9fb0c3);
          font-size: 12px;
          line-height: 1.4;
        }

        .member-context-list-body {
          margin-top: 8px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.5;
          color: var(--text, #dbe4ee);
        }

        @media (max-width: 1024px) {
          .member-context-detail-grid,
          .member-context-memory-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .member-context-detail-grid,
          .member-context-memory-grid,
          .member-context-two-col {
            grid-template-columns: 1fr;
          }

          .member-context-identity {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
