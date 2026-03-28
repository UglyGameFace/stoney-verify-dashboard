"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function safeArray<T = any>(value: T[] | unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function safeText(value: any, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstNonEmpty(...values: any[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeMaybeArray(value: any) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [text];
    } catch {
      return text.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function getMemberName(member: any) {
  return (
    member?.display_name ||
    member?.nickname ||
    member?.username ||
    member?.user_id ||
    "Unknown Member"
  );
}

function getMemberAvatar(member: any) {
  return String(member?.avatar_url || "").trim() || null;
}

function getRoleNames(member: any) {
  if (Array.isArray(member?.role_names)) {
    return member.role_names.filter(Boolean).map((v: any) => String(v));
  }

  if (Array.isArray(member?.roles)) {
    return member.roles
      .map((role: any) => {
        if (typeof role === "string") return role;
        return role?.name || role?.id || "";
      })
      .filter(Boolean)
      .map((v: any) => String(v));
  }

  return [];
}

function getRoleIds(member: any) {
  if (Array.isArray(member?.role_ids)) {
    return member.role_ids.filter(Boolean).map((v: any) => String(v));
  }

  if (Array.isArray(member?.roles)) {
    return member.roles
      .map((role: any) => {
        if (role && typeof role === "object") return role?.id || "";
        return "";
      })
      .filter(Boolean)
      .map((v: any) => String(v));
  }

  return [];
}

function getRoleCount(member: any) {
  return getRoleNames(member).length;
}

function formatDateTime(value: any) {
  if (!value) return "Unknown";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function formatCompactDateTime(value: any) {
  if (!value) return "Unknown";
  try {
    const date = new Date(value);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return "Unknown";
  }
}

function initialsFromName(name: string) {
  const cleaned = safeText(name, "U");
  const parts = cleaned.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "U";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

function getMemberState(member: any) {
  if (member?.in_guild === false) return "Former";
  if (member?.has_staff_role) return "Staff";
  if (member?.has_verified_role) return "Verified";
  if (member?.has_unverified) return "Pending";
  return safeText(member?.role_state, "Tracked");
}

function getStateTone(member: any) {
  if (member?.in_guild === false) return "closed";
  if (member?.has_staff_role) return "claimed";
  if (member?.has_verified_role) return "low";
  if (member?.has_unverified) return "medium";
  return "open";
}

function getSortTimestamp(member: any) {
  return new Date(
    member?.updated_at || member?.last_seen_at || member?.joined_at || 0
  ).getTime();
}

function memberMatchesQuery(member: any, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    member?.display_name,
    member?.nickname,
    member?.username,
    member?.user_id,
    member?.invited_by,
    member?.invited_by_name,
    member?.approved_by,
    member?.approved_by_name,
    member?.vouched_by,
    member?.vouched_by_name,
    member?.join_method,
    member?.entry_method,
    member?.verification_source,
    member?.invite_code,
    ...(safeArray(member?.role_names)),
    ...(safeArray(member?.previous_usernames)),
    ...(safeArray(member?.previous_display_names)),
    ...(safeArray(member?.previous_nicknames)),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function memberMatchesFilter(member: any, filter: string) {
  if (filter === "all") return true;
  if (filter === "active") return member?.in_guild !== false;
  if (filter === "former") return member?.in_guild === false;
  if (filter === "staff") return !!member?.has_staff_role;
  if (filter === "verified") return !!member?.has_verified_role;
  if (filter === "pending") return !!member?.has_unverified;
  if (filter === "conflict") {
    return String(member?.role_state || "").toLowerCase().includes("conflict");
  }
  return true;
}

function sortMembers(rows: any[], mode: string) {
  const list = [...rows];

  list.sort((a, b) => {
    if (mode === "recent") return getSortTimestamp(b) - getSortTimestamp(a);
    if (mode === "roles") return getRoleCount(b) - getRoleCount(a);
    return getMemberName(a).localeCompare(getMemberName(b));
  });

  return list;
}

function normalizeGuildRoles(rows: any[]) {
  return safeArray(rows)
    .map((role) => ({
      id: String(role?.role_id || role?.id || "").trim(),
      name: String(role?.name || role?.role_name || "").trim(),
      position: Number(role?.position || 0),
      member_count: Number(role?.member_count || 0),
    }))
    .filter((role) => role.id && role.name);
}

function parseDiscordErrorDetails(message: any) {
  const raw = String(message || "");
  const statusMatch = raw.match(/Discord API\s+(\d+)/i);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  let retryAfter = null;
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const payload = JSON.parse(raw.slice(jsonStart));
      if (payload && Number.isFinite(Number(payload.retry_after))) {
        retryAfter = Number(payload.retry_after);
      }
    } catch {
      // ignore
    }
  }

  return {
    status,
    isRateLimited: status === 429 || /rate limit/i.test(raw),
    isMissingMember: status === 404 || /unknown member/i.test(raw),
    retryAfter,
  };
}

function getEntryPathRows(member: any) {
  const rows = [
    {
      label: "How They Entered",
      value: firstNonEmpty(
        member?.join_method,
        member?.entry_method,
        member?.joined_via,
        member?.verification_source,
        member?.entry_source,
        member?.source_type
      ),
    },
    {
      label: "Invited By",
      value: firstNonEmpty(
        member?.invited_by_name,
        member?.invited_by,
        member?.inviter_name,
        member?.inviter_id
      ),
    },
    {
      label: "Invite Code",
      value: firstNonEmpty(member?.invite_code, member?.discord_invite_code),
    },
    {
      label: "Vouched By",
      value: firstNonEmpty(
        member?.vouched_by_name,
        member?.vouched_by,
        member?.voucher_name,
        member?.voucher_id
      ),
    },
    {
      label: "Approved By",
      value: firstNonEmpty(
        member?.approved_by_name,
        member?.approved_by,
        member?.verified_by_name,
        member?.verified_by,
        member?.staff_actor_name,
        member?.staff_actor_id
      ),
    },
    {
      label: "Ticket Link",
      value: firstNonEmpty(
        member?.verification_ticket_id,
        member?.ticket_id,
        member?.source_ticket_id,
        member?.ticket_channel_id,
        member?.channel_id
      ),
    },
    {
      label: "Join Note",
      value: firstNonEmpty(
        member?.entry_reason,
        member?.join_note,
        member?.verification_note,
        member?.approval_reason
      ),
    },
  ];

  return rows.filter((row) => row.value);
}

function getTimelineRows(member: any) {
  return [
    { label: "Joined", value: formatDateTime(member?.joined_at) },
    {
      label: "Synced",
      value: formatDateTime(member?.synced_at || member?.updated_at),
    },
    {
      label: "Last Seen",
      value: formatDateTime(member?.last_seen_at || member?.updated_at),
    },
    { label: "Left At", value: formatDateTime(member?.left_at) },
    { label: "Rejoined At", value: formatDateTime(member?.rejoined_at) },
  ];
}

function getHistoryRows(member: any) {
  const previousUsernames = normalizeMaybeArray(member?.previous_usernames);
  const previousDisplayNames = normalizeMaybeArray(
    member?.previous_display_names
  );
  const previousNicknames = normalizeMaybeArray(member?.previous_nicknames);

  return [
    {
      label: "Previous Usernames",
      value: previousUsernames.length ? previousUsernames.join(", ") : "None",
    },
    {
      label: "Previous Display Names",
      value: previousDisplayNames.length
        ? previousDisplayNames.join(", ")
        : "None",
    },
    {
      label: "Previous Nicknames",
      value: previousNicknames.length ? previousNicknames.join(", ") : "None",
    },
  ];
}

function getActivityRows(member: any) {
  const raw =
    normalizeMaybeArray(member?.activity_log).length
      ? normalizeMaybeArray(member?.activity_log)
      : normalizeMaybeArray(member?.action_history).length
        ? normalizeMaybeArray(member?.action_history)
        : normalizeMaybeArray(member?.mod_history);

  return raw.slice(0, 25).map((item: any, index: number) => {
    if (typeof item === "string") {
      return { id: `activity-${index}`, title: item, meta: "" };
    }

    const title = firstNonEmpty(
      item?.action,
      item?.event_type,
      item?.title,
      item?.label,
      "Activity"
    );

    const actor = firstNonEmpty(
      item?.actor_name,
      item?.staff_name,
      item?.moderator_name,
      item?.actor_id,
      item?.staff_id
    );

    const when = firstNonEmpty(item?.created_at, item?.timestamp, item?.at);

    const reason = firstNonEmpty(item?.reason, item?.note, item?.description);

    const metaParts = [
      actor ? `By: ${actor}` : "",
      when ? formatDateTime(when) : "",
      reason ? reason : "",
    ].filter(Boolean);

    return {
      id: item?.id || `activity-${index}`,
      title,
      meta: metaParts.join(" • "),
    };
  });
}

function DetailSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="profile-block">
      <button
        type="button"
        className="profile-block-toggle"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div style={{ minWidth: 0 }}>
          <div className="profile-block-title">{title}</div>
          {subtitle ? (
            <div className="profile-block-subtitle">{subtitle}</div>
          ) : null}
        </div>
        <span className="badge">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="profile-block-body">{children}</div> : null}
    </div>
  );
}

function KeyValueGrid({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="member-detail-grid">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className={`member-detail-item ${String(row.value).length > 80 ? "full" : ""}`}
        >
          <span className="ticket-info-label">{row.label}</span>
          <span>{safeText(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MemberCard({
  member,
  onSelect,
}: {
  member: any;
  onSelect: (member: any) => void;
}) {
  const name = getMemberName(member);
  const avatar = getMemberAvatar(member);
  const state = getMemberState(member);
  const tone = getStateTone(member);

  const entryPreview = firstNonEmpty(
    member?.join_method,
    member?.entry_method,
    member?.joined_via,
    member?.verification_source,
    member?.invited_by_name,
    member?.vouched_by_name,
    member?.approved_by_name
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      className="member-card-button member-card"
      style={{
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        boxShadow: "none",
        outline: "none",
      }}
    >
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "nowrap",
        }}
      >
        <div
          className="row"
          style={{
            minWidth: 0,
            flex: 1,
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="avatar">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                width="38"
                height="38"
                loading="lazy"
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              initialsFromName(name)
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 900,
                overflowWrap: "anywhere",
                lineHeight: 1.08,
                color: "var(--text-strong, #f8fafc)",
                letterSpacing: "-0.02em",
              }}
            >
              {name}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                overflowWrap: "anywhere",
                color: "var(--text-muted, rgba(255,255,255,0.72))",
              }}
            >
              {safeText(member?.user_id, "No member ID")}
            </div>
          </div>
        </div>

        <span className={`badge ${tone}`}>{state}</span>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div className="member-detail-item">
          <span className="ticket-info-label">Top Role</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {safeText(member?.top_role || member?.highest_role_name, "None")}
          </span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Roles</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {getRoleCount(member)}
          </span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Joined</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {formatCompactDateTime(member?.joined_at)}
          </span>
        </div>

        <div className="member-detail-item">
          <span className="ticket-info-label">Updated</span>
          <span style={{ color: "var(--text-strong, #f8fafc)" }}>
            {formatCompactDateTime(
              member?.updated_at || member?.last_seen_at || member?.synced_at
            )}
          </span>
        </div>
      </div>

      {entryPreview ? (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--text-muted, rgba(255,255,255,0.72))",
          }}
        >
          Entry path: {entryPreview}
        </div>
      ) : null}

      {member?.role_state_reason ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--text-muted, rgba(255,255,255,0.72))",
          }}
        >
          {member.role_state_reason}
        </div>
      ) : null}
    </button>
  );
}

function MemberDrawerInner({
  member,
  onClose,
}: {
  member: any;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modReason, setModReason] = useState("Dashboard moderation action");
  const [timeoutMinutes, setTimeoutMinutes] = useState("10");
  const [rateLimitNotice, setRateLimitNotice] = useState("");
  const [memberMissingOnDiscord, setMemberMissingOnDiscord] = useState(false);
  const [guildRoles, setGuildRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedVoiceChannelId, setSelectedVoiceChannelId] = useState("");
  const [voiceChannels, setVoiceChannels] = useState<any[]>([]);
  const [liveMember, setLiveMember] = useState(member || null);
  const [supportDataLoaded, setSupportDataLoaded] = useState(false);
  const memberKey = String(member?.user_id || "");

  useEffect(() => {
    setBusy(false);
    setMessage("");
    setError("");
    setRateLimitNotice("");
    setMemberMissingOnDiscord(false);
    setSelectedRoleId("");
    setSelectedVoiceChannelId("");
    setLiveMember(member || null);
  }, [memberKey, member]);

  const sourceMember = liveMember || member;
  const name = getMemberName(sourceMember);
  const avatar = getMemberAvatar(sourceMember);
  const roleNames = getRoleNames(sourceMember);
  const roleIds = getRoleIds(sourceMember);
  const memberId = String(sourceMember?.user_id || "").trim();
  const entryPathRows = getEntryPathRows(sourceMember);
  const timelineRows = getTimelineRows(sourceMember);
  const historyRows = getHistoryRows(sourceMember);
  const activityRows = getActivityRows(sourceMember);

  const assignableRoles = useMemo(() => {
    const assignedIdSet = new Set(roleIds);
    const assignedNameSet = new Set(roleNames.map((name) => name.toLowerCase()));

    return normalizeGuildRoles(guildRoles)
      .filter((role) => role.name !== "@everyone")
      .filter(
        (role) =>
          !assignedIdSet.has(role.id) &&
          !assignedNameSet.has(role.name.toLowerCase())
      )
      .sort((a, b) => b.position - a.position);
  }, [guildRoles, roleIds, roleNames]);

  const selectedRole = useMemo(
    () => assignableRoles.find((role) => role.id === selectedRoleId) || null,
    [assignableRoles, selectedRoleId]
  );

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/dashboard/live", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || cancelled) return;

        setGuildRoles(normalizeGuildRoles(json?.roles || []));
        setVoiceChannels(safeArray(json?.voiceChannels || []));
        setSupportDataLoaded(true);
      } catch {
        if (!cancelled) {
          setSupportDataLoaded(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [memberKey]);

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
      setError("");
    } catch {
      setError("Copy failed on this device.");
      setMessage("");
    }
  }

  async function refreshMemberDetails() {
    if (!memberId) return;

    try {
      const res = await fetch(
        `/api/discord/member-details?user_id=${encodeURIComponent(memberId)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json?.error || `Failed to load member details (${res.status}).`
        );
      }

      if (json?.member) {
        setLiveMember(json.member);
        setMemberMissingOnDiscord(Boolean(json.member?.discord_unavailable));
        setRateLimitNotice("");
        setError("");
      }
    } catch (err: any) {
      const details = parseDiscordErrorDetails(err?.message);
      if (details.isMissingMember) {
        setMemberMissingOnDiscord(true);
      } else if (details.isRateLimited) {
        const waitText = details.retryAfter
          ? ` Retry after about ${details.retryAfter.toFixed(1)}s.`
          : "";
        setRateLimitNotice(
          `Discord rate limited the live refresh. Showing the last good member data instead.${waitText}`
        );
      } else {
        setError(err?.message || "Failed to refresh live member data.");
      }
    }
  }

  async function runModAction(action: string, extra: Record<string, any> = {}) {
    if (!memberId) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        action,
        user_id: memberId,
        username: name,
        reason: modReason.trim() || "Dashboard moderation action",
        minutes: Number(timeoutMinutes || 10),
        ...extra,
      };

      const res = await fetch("/api/discord/mod-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || `${action} failed`);
      }

      if (json?.member) {
        setLiveMember(json.member);
        setMemberMissingOnDiscord(Boolean(json.member?.discord_unavailable));
        setRateLimitNotice(json?.refresh_warning || "");
      } else {
        await refreshMemberDetails();
      }

      if (action === "timeout") {
        setMessage(
          `Timed out ${name} for ${json.timeout_minutes || payload.minutes} minute(s).`
        );
      } else if (action === "remove_timeout") {
        setMessage(`Removed timeout from ${name}.`);
      } else if (action === "warn") {
        setMessage(`Warn recorded for ${name}.`);
      } else if (action === "kick") {
        setMessage(`${name} was kicked.`);
      } else if (action === "ban") {
        setMessage(`${name} was banned.`);
      } else if (action === "add_role") {
        setSelectedRoleId("");
        setMessage(`Added ${selectedRole?.name || "role"} to ${name}.`);
      } else if (action === "remove_role") {
        setMessage(`Removed ${extra.role_name || "role"} from ${name}.`);
      } else if (action === "mute") {
        setMessage(`Server-muted ${name}.`);
      } else if (action === "unmute") {
        setMessage(`Removed server mute from ${name}.`);
      } else if (action === "deafen") {
        setMessage(`Server-deafened ${name}.`);
      } else if (action === "undeafen") {
        setMessage(`Removed server deafen from ${name}.`);
      } else if (action === "disconnect_voice") {
        setMessage(`Disconnected ${name} from voice.`);
      } else if (action === "move_voice") {
        setMessage(`Moved ${name} to the selected voice channel.`);
      } else {
        setMessage(`${action} completed for ${name}.`);
      }
    } catch (err: any) {
      const details = parseDiscordErrorDetails(err?.message);
      if (details.isRateLimited) {
        const waitText = details.retryAfter
          ? ` Retry after about ${details.retryAfter.toFixed(1)}s.`
          : "";
        setRateLimitNotice(
          `Discord rate limited this action refresh.${waitText}`
        );
      }
      setError(err?.message || "Moderation action failed.");
    } finally {
      setBusy(false);
    }
  }

  const inVoice = Boolean(
    sourceMember?.voice_channel_id || sourceMember?.voice_state?.channel_id
  );
  const activeVoiceChannelId = String(
    sourceMember?.voice_channel_id ||
      sourceMember?.voice_state?.channel_id ||
      ""
  ).trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="member-modal-backdrop"
    >
      <div onClick={(e) => e.stopPropagation()} className="member-drawer">
        <div className="member-drawer-handle" />

        <div
          className="row member-drawer-header"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            className="row"
            style={{ alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}
          >
            <div
              className="avatar member-drawer-avatar"
              style={{ fontSize: 16 }}
            >
              {avatar ? (
                <img
                  key={avatar}
                  src={avatar}
                  alt={name}
                  width="52"
                  height="52"
                  loading="eager"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initialsFromName(name)
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 24,
                  lineHeight: 1.05,
                  overflowWrap: "anywhere",
                  letterSpacing: "-0.04em",
                }}
              >
                {name}
              </div>
              <div
                className="muted"
                style={{ marginTop: 4, fontSize: 13, overflowWrap: "anywhere" }}
              >
                {safeText(sourceMember?.user_id, "No member ID")}
              </div>

              <div className="member-drawer-badges">
                <span className={`badge ${getStateTone(sourceMember)}`}>
                  {getMemberState(sourceMember)}
                </span>
                <span
                  className={`badge ${
                    sourceMember?.in_guild === false ? "closed" : "low"
                  }`}
                >
                  {sourceMember?.in_guild === false ? "Former" : "In Server"}
                </span>
                <span
                  className={`badge ${
                    sourceMember?.has_verified_role ? "low" : "medium"
                  }`}
                >
                  {sourceMember?.has_verified_role
                    ? "Verified"
                    : "Not Verified"}
                </span>
                {inVoice ? <span className="badge open">In Voice</span> : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="button ghost"
            style={{ width: "auto", minWidth: 108 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {memberMissingOnDiscord ? (
          <div className="warning-banner" style={{ marginBottom: 12 }}>
            Discord no longer reports this member. Showing the latest stored
            record.
          </div>
        ) : null}

        {rateLimitNotice ? (
          <div className="warning-banner" style={{ marginBottom: 12 }}>
            {rateLimitNotice}
          </div>
        ) : null}

        {error ? (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="info-banner" style={{ marginBottom: 12 }}>
            {message}
          </div>
        ) : null}

        <DetailSection
          title="Core Profile"
          subtitle="Current member identity and role state"
          defaultOpen
        >
          <KeyValueGrid
            rows={[
              {
                label: "Display Name",
                value: safeText(sourceMember?.display_name, "Unknown"),
              },
              {
                label: "Username",
                value: safeText(sourceMember?.username, "Unknown"),
              },
              {
                label: "Nickname",
                value: safeText(sourceMember?.nickname, "None"),
              },
              {
                label: "Top Role",
                value: safeText(
                  sourceMember?.top_role || sourceMember?.highest_role_name,
                  "None"
                ),
              },
              {
                label: "Role State",
                value: safeText(sourceMember?.role_state, "unknown"),
              },
              {
                label: "Reason",
                value: safeText(
                  sourceMember?.role_state_reason,
                  "No extra notes."
                ),
              },
            ]}
          />
        </DetailSection>

        <DetailSection
          title="How They Got In"
          subtitle="Invite, vouch, approval, and ticket-entry clues from the stored record"
          defaultOpen
        >
          {entryPathRows.length ? (
            <KeyValueGrid rows={entryPathRows} />
          ) : (
            <div className="empty-state">
              No entry-path fields are currently stored for this member. The
              dashboard can only show this after your bot/database writes
              inviter, vouch, approval, or verification-source fields onto the
              member record.
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Identity History"
          subtitle="Useful when members change names or come back later."
          defaultOpen={false}
        >
          <KeyValueGrid rows={getHistoryRows(sourceMember)} />
        </DetailSection>

        <DetailSection
          title="Timestamps"
          subtitle="Tracked join, sync, departure, and rejoin timing."
          defaultOpen={false}
        >
          <KeyValueGrid rows={timelineRows} />
        </DetailSection>

        <DetailSection
          title="Roles"
          subtitle="Current tracked roles plus add/remove controls."
          defaultOpen={false}
        >
          {!supportDataLoaded ? (
            <div className="muted" style={{ marginBottom: 12 }}>
              Loading server role data…
            </div>
          ) : null}

          <div className="roles" style={{ marginBottom: 12 }}>
            {roleNames.length ? (
              roleNames.map((roleName, index) => {
                const roleId = roleIds[index] || "";
                return (
                  <button
                    key={`${roleId || roleName}-${index}`}
                    type="button"
                    className="badge"
                    disabled={busy || sourceMember?.in_guild === false}
                    onClick={() =>
                      runModAction("remove_role", {
                        role_id: roleId,
                        role_name: roleName,
                      })
                    }
                    style={{
                      cursor:
                        roleId && !busy && sourceMember?.in_guild !== false
                          ? "pointer"
                          : "default",
                    }}
                    title={roleId ? `Remove ${roleName}` : roleName}
                  >
                    {roleName}
                    {roleId ? " ×" : ""}
                  </button>
                );
              })
            ) : (
              <span className="muted">No tracked roles found.</span>
            )}
          </div>

          <div
            className="row"
            style={{ alignItems: "stretch", gap: 10, marginTop: 10 }}
          >
            <select
              className="input"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={
                busy ||
                !assignableRoles.length ||
                sourceMember?.in_guild === false
              }
              style={{ flex: 1 }}
            >
              <option value="">
                {sourceMember?.in_guild === false
                  ? "Former members cannot receive roles"
                  : assignableRoles.length
                    ? "Add a server role..."
                    : "No assignable roles available"}
              </option>

              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            <button
              className="button"
              disabled={
                busy ||
                !selectedRoleId ||
                !selectedRole ||
                sourceMember?.in_guild === false
              }
              style={{ width: "auto", minWidth: 130 }}
              onClick={() =>
                runModAction("add_role", {
                  role_id: selectedRoleId,
                  role_name: selectedRole?.name || "",
                })
              }
            >
              Add Role
            </button>
          </div>
        </DetailSection>

        <DetailSection
          title="Moderation"
          subtitle="Timeouts, warnings, bans, and fast staff actions."
          defaultOpen={false}
        >
          <textarea
            className="textarea"
            rows={3}
            value={modReason}
            onChange={(e) => setModReason(e.target.value)}
            placeholder="Moderation reason..."
          />

          <div
            className="row"
            style={{
              alignItems: "stretch",
              gap: 10,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              className="input"
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(e.target.value)}
              placeholder="Timeout minutes"
              inputMode="numeric"
            />

            <button
              className="button"
              disabled={busy || !memberId}
              style={{ width: "auto", minWidth: 130 }}
              onClick={() => runModAction("timeout")}
            >
              Timeout
            </button>

            <button
              className="button ghost"
              disabled={busy || !memberId}
              style={{ width: "auto", minWidth: 150 }}
              onClick={() => runModAction("remove_timeout")}
            >
              Remove Timeout
            </button>
          </div>

          <div className="member-action-grid" style={{ marginTop: 10 }}>
            <button
              className="button ghost"
              disabled={busy || !memberId}
              onClick={() => runModAction("warn")}
            >
              Warn
            </button>

            <button
              className="button danger"
              disabled={busy || !memberId}
              onClick={() => runModAction("kick")}
            >
              Kick
            </button>

            <button
              className="button danger"
              disabled={busy || !memberId}
              onClick={() => runModAction("ban")}
            >
              Ban
            </button>

            <button
              className="button ghost"
              disabled={busy || !memberId}
              onClick={() => refreshMemberDetails()}
            >
              Refresh Member
            </button>
          </div>
        </DetailSection>

        <DetailSection
          title="Voice Controls"
          subtitle="Voice moderation and channel movement."
          defaultOpen={false}
        >
          {!supportDataLoaded ? (
            <div className="muted" style={{ marginBottom: 12 }}>
              Loading voice channel data…
            </div>
          ) : null}

          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            {inVoice ? (
              <span className="badge open">
                Current VC: {safeText(activeVoiceChannelId, "Unknown")}
              </span>
            ) : (
              <span className="badge closed">Not in voice</span>
            )}
          </div>

          <div className="member-action-grid" style={{ marginBottom: 10 }}>
            <button
              className="button ghost"
              disabled={busy || !memberId}
              onClick={() => runModAction("mute")}
            >
              Server Mute
            </button>

            <button
              className="button ghost"
              disabled={busy || !memberId}
              onClick={() => runModAction("unmute")}
            >
              Remove Mute
            </button>

            <button
              className="button ghost"
              disabled={busy || !memberId}
              onClick={() => runModAction("deafen")}
            >
              Server Deafen
            </button>

            <button
              className="button ghost"
              disabled={busy || !memberId}
              onClick={() => runModAction("undeafen")}
            >
              Remove Deafen
            </button>

            <button
              className="button danger"
              disabled={busy || !memberId}
              onClick={() => runModAction("disconnect_voice")}
            >
              Disconnect Voice
            </button>
          </div>

          <div
            className="row"
            style={{
              alignItems: "stretch",
              gap: 10,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <select
              className="input"
              value={selectedVoiceChannelId}
              onChange={(e) => setSelectedVoiceChannelId(e.target.value)}
              disabled={busy || !safeArray(voiceChannels).length}
              style={{ flex: 1 }}
            >
              <option value="">Move to a voice channel...</option>
              {safeArray(voiceChannels).map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {safeText(channel.name, channel.id)}
                </option>
              ))}
            </select>

            <button
              className="button"
              disabled={busy || !selectedVoiceChannelId}
              style={{ width: "auto", minWidth: 130 }}
              onClick={() =>
                runModAction("move_voice", {
                  target_channel_id: selectedVoiceChannelId,
                })
              }
            >
              Move Voice
            </button>
          </div>
        </DetailSection>

        <DetailSection
          title="Activity Trail"
          subtitle="Stored per-member action history when available."
          defaultOpen={false}
        >
          {activityRows.length ? (
            <div className="space">
              {activityRows.map((row) => (
                <div key={row.id} className="member-history-row">
                  <div className="member-history-title">{row.title}</div>
                  {row.meta ? (
                    <div className="member-history-meta">{row.meta}</div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No per-member activity trail is stored on this record yet.
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Copy / Export"
          subtitle="Quick copy actions for staff context."
          defaultOpen={false}
        >
          <div className="member-action-grid">
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => copyText(memberId, "User ID copied.")}
            >
              Copy User ID
            </button>

            <button
              className="button ghost"
              disabled={busy}
              onClick={() => copyText(`<@${memberId}>`, "Mention copied.")}
            >
              Copy Mention
            </button>

            <button
              className="button ghost"
              disabled={busy}
              onClick={() =>
                copyText(
                  [
                    `Member: ${name}`,
                    `User ID: ${memberId}`,
                    `State: ${safeText(sourceMember?.role_state)}`,
                    `Top Role: ${safeText(
                      sourceMember?.top_role || sourceMember?.highest_role_name,
                      "None"
                    )}`,
                    `Roles: ${roleNames.join(", ") || "None"}`,
                    `Entry Path: ${entryPathRows.map((r) => `${r.label}: ${r.value}`).join(" | ") || "Unknown"}`,
                  ].join("\n"),
                  "Staff summary copied."
                )
              }
            >
              Copy Summary
            </button>
          </div>
        </DetailSection>
      </div>
    </div>
  );
}

function MemberDrawer({
  member,
  onClose,
}: {
  member: any;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!member || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <MemberDrawerInner key={String(member?.user_id || "member-drawer")} member={member} onClose={onClose} />,
    document.body
  );
}

export default function MemberSnapshot({ members = [] }: { members?: any[] }) {
  const safeMembers = safeArray(members);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("active");
  const [sortMode, setSortMode] = useState("recent");
  const [selected, setSelected] = useState<any | null>(null);
  const [showFormer, setShowFormer] = useState(false);

  const summary = useMemo(() => {
    const total = safeMembers.length;
    const active = safeMembers.filter((m) => m?.in_guild !== false).length;
    const former = safeMembers.filter((m) => m?.in_guild === false).length;
    const staff = safeMembers.filter((m) => !!m?.has_staff_role).length;
    const verified = safeMembers.filter((m) => !!m?.has_verified_role).length;
    const pending = safeMembers.filter((m) => !!m?.has_unverified).length;
    const conflict = safeMembers.filter((m) =>
      String(m?.role_state || "").toLowerCase().includes("conflict")
    ).length;

    return { total, active, former, staff, verified, pending, conflict };
  }, [safeMembers]);

  const filteredMembers = useMemo(() => {
    let rows = safeMembers.filter(
      (member) =>
        memberMatchesQuery(member, query) &&
        memberMatchesFilter(member, stateFilter)
    );

    return sortMembers(rows, sortMode);
  }, [safeMembers, query, stateFilter, sortMode]);

  const activeRows = useMemo(
    () =>
      filteredMembers
        .filter((member) => member?.in_guild !== false)
        .slice(0, 48),
    [filteredMembers]
  );

  const formerRows = useMemo(
    () => filteredMembers.filter((member) => member?.in_guild === false),
    [filteredMembers]
  );

  const visibleFormerRows = useMemo(
    () => (showFormer ? formerRows.slice(0, 48) : formerRows.slice(0, 8)),
    [formerRows, showFormer]
  );

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div className="member-detail-item">
          <span className="ticket-info-label">Total</span>
          <span>{summary.total}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Active</span>
          <span>{summary.active}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Former</span>
          <span>{summary.former}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Staff</span>
          <span>{summary.staff}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Verified</span>
          <span>{summary.verified}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Pending</span>
          <span>{summary.pending}</span>
        </div>
        <div className="member-detail-item">
          <span className="ticket-info-label">Conflict</span>
          <span>{summary.conflict}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <input
          className="input"
          placeholder="Search members"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          className="input"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="active">Active members</option>
          <option value="all">All members</option>
          <option value="former">Former only</option>
          <option value="staff">Staff only</option>
          <option value="verified">Verified only</option>
          <option value="pending">Pending only</option>
          <option value="conflict">Conflict only</option>
        </select>

        <select
          className="input"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
        >
          <option value="recent">Recently updated</option>
          <option value="name">Name</option>
          <option value="roles">Role count</option>
        </select>
      </div>

      {!filteredMembers.length ? (
        <div className="empty-state">
          No member records matched your current filters.
        </div>
      ) : (
        <>
          {activeRows.length ? (
            <div style={{ marginBottom: 16 }}>
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{ fontWeight: 900, color: "var(--text-strong, #f8fafc)" }}
                >
                  Active Members
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Showing {activeRows.length} active record
                  {activeRows.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="space">
                {activeRows.map((member, index) => (
                  <MemberCard
                    key={`${member?.user_id || "active"}-${index}`}
                    member={member}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {formerRows.length ? (
            <div>
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 900, color: "var(--text-strong, #f8fafc)" }}
                  >
                    Former Members
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    Archived separately so they do not take over the live roster
                  </div>
                </div>

                <button
                  type="button"
                  className="button ghost"
                  style={{ width: "auto", minWidth: 130 }}
                  onClick={() => setShowFormer((prev) => !prev)}
                >
                  {showFormer ? "Show Fewer" : `Show More (${formerRows.length})`}
                </button>
              </div>

              <div className="space">
                {visibleFormerRows.map((member, index) => (
                  <MemberCard
                    key={`${member?.user_id || "former"}-${index}`}
                    member={member}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <MemberDrawer member={selected} onClose={() => setSelected(null)} />

      <style jsx>{`
        .member-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(2, 6, 23, 0.94);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .member-drawer {
          width: 100%;
          max-width: 980px;
          max-height: calc(100dvh - 24px);
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          color: var(--text-strong, #f8fafc);
          padding: 16px;
          background: rgba(8, 14, 26, 0.98);
          contain: layout paint;
        }

        .member-drawer-handle {
          width: 54px;
          height: 6px;
          border-radius: 999px;
          margin: 0 auto 14px;
          background: rgba(255, 255, 255, 0.18);
        }

        .member-drawer-header {
          position: static;
          z-index: 1;
          background: transparent;
          padding-top: 0;
          padding-bottom: 0;
        }

        .member-drawer-avatar {
          width: 52px;
          height: 52px;
          min-width: 52px;
          min-height: 52px;
          overflow: hidden;
        }

        .member-drawer-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .profile-block {
          margin-bottom: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.025);
          overflow: hidden;
        }

        .profile-block-toggle {
          width: 100%;
          text-align: left;
          border: 0;
          background: transparent;
          color: inherit;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
        }

        .profile-block-title {
          font-weight: 900;
          font-size: 19px;
          line-height: 1.1;
          color: var(--text-strong, #f8fafc);
        }

        .profile-block-subtitle {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-muted, rgba(255, 255, 255, 0.72));
          line-height: 1.45;
        }

        .profile-block-body {
          padding: 0 14px 14px;
        }

        .member-action-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }

        .member-history-row {
          padding: 12px 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.022);
        }

        .member-history-title {
          font-weight: 800;
          color: var(--text-strong, #f8fafc);
        }

        .member-history-meta {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.45;
          color: var(--text-muted, rgba(255, 255, 255, 0.72));
          overflow-wrap: anywhere;
        }

        @media (max-width: 640px) {
          .member-modal-backdrop {
            padding: 8px;
            align-items: flex-start;
          }

          .member-drawer {
            max-height: calc(100dvh - 16px);
            border-radius: 18px;
            padding: 12px;
          }

          .member-drawer-header {
            top: 0;
          }

          .profile-block-title {
            font-size: 17px;
          }

          .member-action-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
