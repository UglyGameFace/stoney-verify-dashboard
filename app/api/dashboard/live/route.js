import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { sortTickets, derivePriority } from "@/lib/priority";
import { requireStaffSessionForRoute } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function debugEnabled() {
  return String(process.env.DASHBOARD_DEBUG || "").toLowerCase() === "true";
}

function toJoinedTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function toTime(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value || "").trim();
}

function truncateText(value, max = 240) {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isClosedLikeStatus(status) {
  const value = normalizeStatus(status);
  return value === "closed" || value === "deleted";
}

function isOpenLikeStatus(status) {
  const value = normalizeStatus(status);
  return value === "open" || value === "claimed";
}

function hasUsableChannel(ticket) {
  return Boolean(
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim()
  );
}

function hasTranscriptEvidence(ticket) {
  return Boolean(
    String(ticket?.transcript_url || "").trim() ||
      String(ticket?.transcript_message_id || "").trim() ||
      String(ticket?.transcript_channel_id || "").trim()
  );
}

function newestTicketTimestamp(ticket) {
  return Math.max(
    parseDateMs(ticket?.updated_at),
    parseDateMs(ticket?.created_at),
    parseDateMs(ticket?.closed_at),
    parseDateMs(ticket?.deleted_at)
  );
}

function ageMinutesFromTicket(ticket) {
  const newest = newestTicketTimestamp(ticket);
  if (!newest) return 999999;
  return Math.max(0, (Date.now() - newest) / 60000);
}

function shouldHideStaleClosedTicket(ticket) {
  const status = normalizeStatus(ticket?.status);
  const missingChannel = !hasUsableChannel(ticket);

  if (!missingChannel) return false;
  if (!isClosedLikeStatus(status)) return false;

  return ageMinutesFromTicket(ticket) > 5;
}

function shouldHideStaleOpenTicket(ticket) {
  const status = normalizeStatus(ticket?.status);

  if (!isOpenLikeStatus(status)) return false;

  const missingChannel = !hasUsableChannel(ticket);
  const hasTranscript = hasTranscriptEvidence(ticket);
  const ageMinutes = ageMinutesFromTicket(ticket);

  if (missingChannel && ageMinutes > 5) {
    return true;
  }

  if (hasTranscript && ageMinutes > 2) {
    return true;
  }

  return false;
}

function ticketFreshnessScore(ticket) {
  const status = normalizeStatus(ticket?.status);
  const now = Date.now();
  const updatedAt = parseDateMs(ticket?.updated_at);
  const createdAt = parseDateMs(ticket?.created_at);
  const closedAt = parseDateMs(ticket?.closed_at);
  const deletedAt = parseDateMs(ticket?.deleted_at);
  const newest = Math.max(updatedAt, createdAt, closedAt, deletedAt);

  let score = 0;

  if (hasUsableChannel(ticket)) score += 50;
  if (hasTranscriptEvidence(ticket)) score += 25;
  if (status === "claimed") score += 20;
  if (status === "open") score += 15;
  if (status === "closed") score -= 10;
  if (status === "deleted") score -= 20;

  const ageMinutes = newest > 0 ? (now - newest) / 60000 : 999999;
  if (ageMinutes <= 30) score += 30;
  else if (ageMinutes <= 180) score += 15;
  else if (ageMinutes <= 1440) score += 5;
  else if (ageMinutes > 2880) score -= 20;

  if (isOpenLikeStatus(status) && hasTranscriptEvidence(ticket)) {
    score -= 40;
  }

  if (shouldHideStaleOpenTicket(ticket)) {
    score -= 1000;
  }

  return score;
}

function canonicalTicketKey(ticket) {
  const channelId = normalizeString(
    ticket?.channel_id || ticket?.discord_thread_id
  );
  if (channelId) return `channel:${channelId}`;

  const userId = normalizeString(ticket?.user_id || ticket?.owner_id);
  const category = normalizeString(ticket?.category).toLowerCase();
  const username = normalizeString(ticket?.username).toLowerCase();

  if (userId) return `user:${userId}:${category || "unknown"}`;
  if (username) return `username:${username}:${category || "unknown"}`;

  return `row:${normalizeString(ticket?.id)}`;
}

function canonicalizeTickets(rawTickets) {
  const visibleBase = rawTickets.filter(
    (ticket) =>
      !shouldHideStaleClosedTicket(ticket) && !shouldHideStaleOpenTicket(ticket)
  );

  const grouped = new Map();

  for (const ticket of visibleBase) {
    const key = canonicalTicketKey(ticket);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(ticket);
  }

  const chosenIds = new Set();

  for (const [, group] of grouped.entries()) {
    group.sort((a, b) => {
      const statusA = normalizeStatus(a?.status);
      const statusB = normalizeStatus(b?.status);

      const scoreDiff = ticketFreshnessScore(b) - ticketFreshnessScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      if (isOpenLikeStatus(statusA) !== isOpenLikeStatus(statusB)) {
        return isOpenLikeStatus(statusB) ? 1 : -1;
      }

      return (
        parseDateMs(b?.updated_at || b?.created_at) -
        parseDateMs(a?.updated_at || a?.created_at)
      );
    });

    chosenIds.add(String(group[0]?.id));
  }

  return visibleBase
    .filter((ticket) => chosenIds.has(String(ticket?.id)))
    .sort(
      (a, b) =>
        parseDateMs(b?.updated_at || b?.created_at) -
        parseDateMs(a?.updated_at || a?.created_at)
    );
}

function normalizeStaffKey(value) {
  return String(value || "").trim();
}

function looksLikeDiscordId(value) {
  const text = normalizeString(value);
  return /^\d{16,22}$/.test(text);
}

function normalizeStaffName(value) {
  return normalizeString(value);
}

function cleanDisplayName(value) {
  const text = normalizeStaffName(value);
  if (!text) return "";
  if (looksLikeDiscordId(text)) return "";
  return text;
}

function pickBestStaffDisplayName(candidates, fallback = "Unknown Staff") {
  const cleaned = safeArray(candidates)
    .map(cleanDisplayName)
    .filter(Boolean);

  if (!cleaned.length) return fallback;

  cleaned.sort((a, b) => {
    const score = (name) => {
      let s = 0;
      if (/[A-Z]/.test(name)) s += 5;
      if (!name.includes("#")) s += 2;
      if (!/^\d+$/.test(name)) s += 5;
      s += Math.min(name.length, 32) / 10;
      return s;
    };

    const diff = score(b) - score(a);
    if (diff !== 0) return diff;

    return a.localeCompare(b);
  });

  return cleaned[0] || fallback;
}

function buildMemberIdentityMaps(guildMembers) {
  const byId = new Map();
  const nameToId = new Map();

  for (const member of safeArray(guildMembers)) {
    const userId = normalizeString(member?.user_id);
    const names = [
      member?.display_name,
      member?.nickname,
      member?.username,
      ...(Array.isArray(member?.previous_usernames)
        ? member.previous_usernames
        : []),
      ...(Array.isArray(member?.previous_display_names)
        ? member.previous_display_names
        : []),
      ...(Array.isArray(member?.previous_nicknames)
        ? member.previous_nicknames
        : []),
    ]
      .map((v) => normalizeString(v))
      .filter(Boolean);

    if (userId) {
      byId.set(userId, member);
    }

    for (const name of names) {
      const key = name.toLowerCase();
      if (key && userId) {
        if (!nameToId.has(key)) {
          nameToId.set(key, userId);
        }
      }
    }
  }

  return { byId, nameToId };
}

function resolveStaffIdentity(value, memberMaps) {
  const raw = normalizeStaffKey(value);
  if (!raw) return { key: "", member: null, rawName: "" };

  if (looksLikeDiscordId(raw)) {
    return {
      key: raw,
      member: memberMaps.byId.get(raw) || null,
      rawName: "",
    };
  }

  const matchedId = memberMaps.nameToId.get(raw.toLowerCase()) || "";
  if (matchedId) {
    return {
      key: matchedId,
      member: memberMaps.byId.get(matchedId) || null,
      rawName: raw,
    };
  }

  return {
    key: `name:${raw.toLowerCase()}`,
    member: null,
    rawName: raw,
  };
}

function deriveMetricsFromTickets(
  tickets = [],
  existingMetrics = [],
  guildMembers = []
) {
  const memberMaps = buildMemberIdentityMaps(guildMembers);
  const byStaff = new Map();

  function ensureRow(identityKey, seed = {}) {
    const key = normalizeStaffKey(identityKey);
    if (!key) return null;

    if (!byStaff.has(key)) {
      const member = seed.member || null;
      byStaff.set(key, {
        staff_id:
          looksLikeDiscordId(key)
            ? key
            : normalizeStaffKey(seed?.staff_id || ""),
        staff_name: pickBestStaffDisplayName(
          [
            seed?.staff_name,
            seed?.rawName,
            member?.display_name,
            member?.nickname,
            member?.username,
          ],
          member?.display_name ||
            member?.nickname ||
            member?.username ||
            seed?.staff_name ||
            seed?.rawName ||
            "Unknown Staff"
        ),
        tickets_handled: 0,
        approvals: 0,
        denials: 0,
        avg_response_minutes: 0,
        last_active: null,
      });
    }

    return byStaff.get(key);
  }

  for (const row of safeArray(existingMetrics)) {
    const idIdentity = resolveStaffIdentity(row?.staff_id, memberMaps);
    const nameIdentity = resolveStaffIdentity(row?.staff_name, memberMaps);

    const identityKey =
      idIdentity.key ||
      nameIdentity.key ||
      normalizeStaffKey(row?.staff_id || row?.staff_name);

    if (!identityKey) continue;

    const preferredMember = idIdentity.member || nameIdentity.member || null;

    byStaff.set(identityKey, {
      staff_id: preferredMember?.user_id || (looksLikeDiscordId(identityKey) ? identityKey : ""),
      staff_name: pickBestStaffDisplayName(
        [
          row?.staff_name,
          nameIdentity.rawName,
          preferredMember?.display_name,
          preferredMember?.nickname,
          preferredMember?.username,
        ],
        preferredMember?.display_name ||
          preferredMember?.nickname ||
          preferredMember?.username ||
          row?.staff_name ||
          "Unknown Staff"
      ),
      tickets_handled: Number(row?.tickets_handled || 0),
      approvals: Number(row?.approvals || 0),
      denials: Number(row?.denials || 0),
      avg_response_minutes: Number(row?.avg_response_minutes || 0),
      last_active: row?.last_active || null,
    });
  }

  for (const ticket of safeArray(tickets)) {
    const status = normalizeStatus(ticket?.status);
    const category = String(ticket?.category || "").trim().toLowerCase();

    const candidates = [
      ticket?.closed_by,
      ticket?.claimed_by,
      ticket?.assigned_to,
      ticket?.staff_id,
      ticket?.closed_by_name,
      ticket?.claimed_by_name,
      ticket?.assigned_to_name,
      ticket?.staff_name,
    ];

    let identity = { key: "", member: null, rawName: "" };

    for (const candidate of candidates) {
      identity = resolveStaffIdentity(candidate, memberMaps);
      if (identity.key) break;
    }

    if (!identity.key) continue;

    const row = ensureRow(identity.key, {
      staff_id: identity.member?.user_id || (looksLikeDiscordId(identity.key) ? identity.key : ""),
      staff_name: pickBestStaffDisplayName(
        [
          ticket?.closed_by_name,
          ticket?.claimed_by_name,
          ticket?.assigned_to_name,
          ticket?.staff_name,
          identity.rawName,
          identity.member?.display_name,
          identity.member?.nickname,
          identity.member?.username,
        ],
        identity.member?.display_name ||
          identity.member?.nickname ||
          identity.member?.username ||
          identity.rawName ||
          "Unknown Staff"
      ),
      rawName: identity.rawName,
      member: identity.member,
    });

    if (!row) continue;

    const updatedAt =
      ticket?.updated_at || ticket?.closed_at || ticket?.created_at || null;

    if (
      updatedAt &&
      (!row.last_active || parseDateMs(updatedAt) > parseDateMs(row.last_active))
    ) {
      row.last_active = updatedAt;
    }

    row.staff_name = pickBestStaffDisplayName(
      [
        row.staff_name,
        ticket?.closed_by_name,
        ticket?.claimed_by_name,
        ticket?.assigned_to_name,
        ticket?.staff_name,
        identity.rawName,
        identity.member?.display_name,
        identity.member?.nickname,
        identity.member?.username,
      ],
      row.staff_name || "Unknown Staff"
    );

    if (!row.staff_id && identity.member?.user_id) {
      row.staff_id = String(identity.member.user_id);
    } else if (!row.staff_id && looksLikeDiscordId(identity.key)) {
      row.staff_id = identity.key;
    }

    if (status === "closed" || status === "deleted") {
      row.tickets_handled += 1;

      const reasonText = String(
        ticket?.closed_reason || ticket?.reason || ticket?.mod_suggestion || ""
      ).toLowerCase();

      const denied =
        /\b(deny|denied|reject|rejected|decline|declined|failed)\b/.test(
          reasonText
        );

      if (category.includes("verification")) {
        if (denied) {
          row.denials += 1;
        } else {
          row.approvals += 1;
        }
      }
    }
  }

  return [...byStaff.values()]
    .filter((row) => row.staff_id || row.staff_name)
    .sort((a, b) => {
      const handledDiff =
        Number(b?.tickets_handled || 0) - Number(a?.tickets_handled || 0);
      if (handledDiff !== 0) return handledDiff;

      const approvalsDiff =
        Number(b?.approvals || 0) - Number(a?.approvals || 0);
      if (approvalsDiff !== 0) return approvalsDiff;

      return String(a?.staff_name || a?.staff_id || "").localeCompare(
        String(b?.staff_name || b?.staff_id || "")
      );
    });
}

function pickMessageContent(row) {
  return (
    normalizeString(row?.content) ||
    normalizeString(row?.message_content) ||
    normalizeString(row?.body) ||
    ""
  );
}

function mergeJoinWithMember(joinRow, memberRow) {
  return {
    ...(memberRow || {}),
    ...(joinRow || {}),
    user_id: joinRow?.user_id || memberRow?.user_id || "",
    username: memberRow?.username || joinRow?.username || "",
    display_name:
      memberRow?.display_name ||
      joinRow?.display_name ||
      joinRow?.username ||
      "",
    nickname: memberRow?.nickname || "",
    avatar_url: memberRow?.avatar_url || null,
    in_guild: memberRow?.in_guild !== false,
    has_verified_role: Boolean(memberRow?.has_verified_role),
    has_staff_role: Boolean(memberRow?.has_staff_role),
    has_unverified: Boolean(memberRow?.has_unverified),
    role_state: memberRow?.role_state || "unknown",
    role_state_reason: memberRow?.role_state_reason || "",
    top_role: memberRow?.top_role || memberRow?.highest_role_name || null,
    highest_role_name: memberRow?.highest_role_name || null,
    highest_role_id: memberRow?.highest_role_id || null,
    role_names: Array.isArray(memberRow?.role_names) ? memberRow.role_names : [],
    role_ids: Array.isArray(memberRow?.role_ids) ? memberRow.role_ids : [],
    roles: Array.isArray(memberRow?.roles) ? memberRow.roles : [],
    joined_at: joinRow?.joined_at || memberRow?.joined_at || null,
    synced_at: memberRow?.synced_at || null,
    updated_at: memberRow?.updated_at || null,
    last_seen_at: memberRow?.last_seen_at || null,
    left_at: memberRow?.left_at || null,
    rejoined_at: memberRow?.rejoined_at || null,
  };
}

function mapTicket(row) {
  return {
    ...row,
    priority: row?.priority || derivePriority(row),
    channel_id: row?.channel_id || row?.discord_thread_id || null,
    channel_name: row?.channel_name || null,
    is_ghost: Boolean(row?.is_ghost),
    deleted_at: row?.deleted_at || null,
    deleted_by: row?.deleted_by || null,
    transcript_url: row?.transcript_url || null,
    transcript_message_id: row?.transcript_message_id || null,
    transcript_channel_id: row?.transcript_channel_id || null,
    source: row?.source || "discord",
  };
}

function mapGuildMember(row) {
  return {
    ...row,
    guild_id: row?.guild_id || null,
    user_id: row?.user_id || "",
    username: row?.username || "",
    display_name: row?.display_name || "",
    nickname: row?.nickname || "",
    avatar_url: row?.avatar_url || null,
    role_ids: Array.isArray(row?.role_ids) ? row.role_ids : [],
    role_names: Array.isArray(row?.role_names) ? row.role_names : [],
    roles: Array.isArray(row?.roles) ? row.roles : [],
    in_guild: row?.in_guild !== false,
    has_unverified: Boolean(row?.has_unverified),
    has_verified_role: Boolean(row?.has_verified_role),
    has_staff_role: Boolean(row?.has_staff_role),
    has_secondary_verified_role: Boolean(row?.has_secondary_verified_role),
    has_cosmetic_only: Boolean(row?.has_cosmetic_only),
    role_state: row?.role_state || "unknown",
    role_state_reason: row?.role_state_reason || "",
    joined_at: row?.joined_at || null,
    synced_at: row?.synced_at || null,
    updated_at: row?.updated_at || null,
    last_seen_at: row?.last_seen_at || null,
    left_at: row?.left_at || null,
    rejoined_at: row?.rejoined_at || null,
    previous_usernames: Array.isArray(row?.previous_usernames)
      ? row.previous_usernames
      : [],
    previous_display_names: Array.isArray(row?.previous_display_names)
      ? row.previous_display_names
      : [],
    previous_nicknames: Array.isArray(row?.previous_nicknames)
      ? row.previous_nicknames
      : [],
  };
}

function computeRoleMemberCount(role, members) {
  const roleId = normalizeString(role?.role_id);
  const roleName = normalizeString(role?.name).toLowerCase();

  return members.filter((member) => {
    const ids = safeArray(member?.role_ids).map((v) => normalizeString(v));
    const names = safeArray(member?.role_names).map((v) =>
      normalizeString(v).toLowerCase()
    );

    return (
      (roleId && ids.includes(roleId)) ||
      (roleName && names.includes(roleName))
    );
  }).length;
}

function prettifyAction(action) {
  const raw = normalizeString(action);
  if (!raw) return "Audit Log";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildAuditDescription(row) {
  const meta = row?.meta && typeof row.meta === "object" ? row.meta : {};
  const pieces = [];

  if (meta?.reason) pieces.push(`Reason: ${String(meta.reason)}`);
  if (meta?.channel_id) pieces.push(`Channel: ${String(meta.channel_id)}`);
  if (meta?.user_id) pieces.push(`User: ${String(meta.user_id)}`);
  if (meta?.staff_id) pieces.push(`Staff: ${String(meta.staff_id)}`);
  if (meta?.role_id) pieces.push(`Role: ${String(meta.role_id)}`);
  if (meta?.command_id) pieces.push(`Command: ${String(meta.command_id)}`);

  if (pieces.length) {
    return pieces.join(" • ");
  }

  return row?.token
    ? `Token: ${String(row.token)}`
    : "Dashboard/bot audit log entry";
}

function mapAuditLogToTimeline(row) {
  return {
    id: `audit-log-${row?.id ?? Math.random()}`,
    title: prettifyAction(row?.action),
    description: truncateText(buildAuditDescription(row), 220),
    event_type: "audit_log",
    related_id: row?.staff_id || null,
    created_at: row?.created_at || null,
    actor_id: row?.staff_id || null,
    meta: row?.meta || {},
    source: "audit_logs",
  };
}

function mapAuditEventToTimeline(row) {
  return {
    id: `audit-event-${row?.id ?? Math.random()}`,
    title: row?.title || "Audit Event",
    description: truncateText(row?.description || "", 220),
    event_type: row?.event_type || "audit_event",
    related_id: row?.related_id || null,
    created_at: row?.created_at || null,
    actor_id: null,
    meta: {},
    source: "audit_events",
  };
}

function mapStaffMessageToTimeline(row) {
  const content = pickMessageContent(row);
  const attachments = safeArray(row?.attachments);
  const embeds = safeArray(row?.embeds);

  let description = truncateText(content, 220);
  if (!description) {
    if (attachments.length) description = `${attachments.length} attachment(s)`;
    else if (embeds.length) description = `${embeds.length} embed(s)`;
    else description = "Staff message";
  }

  return {
    id: `staff-message-${row?.message_id || row?.id || Math.random()}`,
    title: row?.display_name || row?.username || "Staff Message",
    description,
    event_type: "staff_message",
    related_id: row?.channel_id || null,
    created_at: row?.created_at || row?.timestamp || null,
    actor_id: row?.author_id || row?.user_id || null,
    meta: {
      channel_id: row?.channel_id || null,
      message_id: row?.message_id || null,
      attachments,
      embeds,
      full_content: content,
    },
    source: "dashboard_staff_messages",
    actor_name:
      row?.display_name ||
      row?.username ||
      row?.author_name ||
      row?.author_id ||
      null,
    actor_avatar_url: row?.avatar_url || row?.author_avatar_url || null,
    channel_id: row?.channel_id || null,
    message_id: row?.message_id || null,
  };
}

function buildTimeline(auditLogs, auditEvents, staffMessages, guildMembers) {
  const memberMap = new Map(
    guildMembers.map((member) => [String(member.user_id), member])
  );

  return [
    ...safeArray(auditLogs).map(mapAuditLogToTimeline),
    ...safeArray(auditEvents).map(mapAuditEventToTimeline),
    ...safeArray(staffMessages).map(mapStaffMessageToTimeline),
  ]
    .sort((a, b) => toTime(b.created_at) - toTime(a.created_at))
    .slice(0, 100)
    .map((event) => {
      if (event.source === "dashboard_staff_messages") {
        return event;
      }

      const actorId = normalizeString(event.actor_id);
      const actor = actorId ? memberMap.get(actorId) : null;

      return {
        ...event,
        actor_name:
          actor?.display_name ||
          actor?.nickname ||
          actor?.username ||
          (actorId ? actorId : null),
        actor_avatar_url: actor?.avatar_url || null,
      };
    });
}

function mapWarn(row, guildMembers) {
  const member = guildMembers.find(
    (m) => String(m.user_id) === String(row?.user_id || "")
  );

  return {
    ...row,
    display_name:
      member?.display_name ||
      member?.nickname ||
      row?.username ||
      row?.user_id ||
      "Unknown User",
    avatar_url: member?.avatar_url || null,
  };
}

function mapFraud(row, guildMembers) {
  const member = guildMembers.find(
    (m) => String(m.user_id) === String(row?.user_id || "")
  );

  return {
    ...row,
    display_name:
      member?.display_name ||
      member?.nickname ||
      row?.username ||
      row?.user_id ||
      "Unknown User",
    avatar_url: member?.avatar_url || null,
    reasons: Array.isArray(row?.reasons) ? row.reasons : [],
  };
}

function mapRaid(row) {
  return {
    ...row,
    summary: row?.summary || "Raid alert",
    severity: row?.severity || "unknown",
    join_count: Number(row?.join_count || 0),
    window_seconds: Number(row?.window_seconds || 0),
  };
}

export async function GET() {
  try {
    await requireStaffSessionForRoute();

    const supabase = createServerSupabase();
    const guildId = env.guildId || "";

    if (debugEnabled()) {
      console.log("[dashboard/live] env.guildId =", guildId);
      console.log(
        "[dashboard/live] DISCORD_GUILD_ID =",
        process.env.DISCORD_GUILD_ID || ""
      );
      console.log("[dashboard/live] GUILD_ID =", process.env.GUILD_ID || "");
    }

    const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      ticketsRes,
      auditLogsRes,
      auditEventsRes,
      staffMessagesRes,
      rolesRes,
      metricsRes,
      categoriesRes,
      memberJoinsRes,
      recentActiveMembersRes,
      recentFormerMembersRes,
      allGuildMembersRes,
      warnsTodayRes,
      raidAlertsRes,
      fraudFlagsRes,
      activeMembersCountRes,
      formerMembersCountRes,
      pendingVerificationCountRes,
      verifiedMembersCountRes,
      staffMembersCountRes,
      warnsRowsRes,
      raidsRowsRes,
      fraudRowsRes,
    ] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("guild_id", guildId)
        .order("updated_at", { ascending: false })
        .limit(300),

      supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40),

      supabase
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40),

      supabase
        .from("dashboard_staff_messages")
        .select("*")
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(120),

      supabase
        .from("guild_roles")
        .select("*")
        .eq("guild_id", guildId)
        .order("position", { ascending: false })
        .limit(100),

      supabase
        .from("staff_metrics")
        .select("*")
        .eq("guild_id", guildId)
        .order("tickets_handled", { ascending: false })
        .limit(50),

      supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", guildId)
        .order("name", { ascending: true }),

      supabase
        .from("member_joins")
        .select("*")
        .eq("guild_id", guildId)
        .order("joined_at", { ascending: false })
        .limit(50),

      supabase
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .eq("in_guild", true)
        .order("joined_at", { ascending: false })
        .limit(25),

      supabase
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .eq("in_guild", false)
        .order("updated_at", { ascending: false })
        .limit(25),

      supabase
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .order("updated_at", { ascending: false })
        .limit(2000),

      supabase
        .from("warns")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .gte("created_at", last24hIso),

      supabase
        .from("raid_events")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .gte("created_at", last24hIso),

      supabase
        .from("verification_flags")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("flagged", true),

      supabase
        .from("guild_members")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("in_guild", true),

      supabase
        .from("guild_members")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("in_guild", false),

      supabase
        .from("guild_members")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("in_guild", true)
        .eq("has_unverified", true),

      supabase
        .from("guild_members")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("in_guild", true)
        .eq("has_verified_role", true),

      supabase
        .from("guild_members")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("in_guild", true)
        .eq("has_staff_role", true),

      supabase
        .from("warns")
        .select("*")
        .eq("guild_id", guildId)
        .gte("created_at", last24hIso)
        .order("created_at", { ascending: false })
        .limit(25),

      supabase
        .from("raid_events")
        .select("*")
        .eq("guild_id", guildId)
        .gte("created_at", last24hIso)
        .order("created_at", { ascending: false })
        .limit(25),

      supabase
        .from("verification_flags")
        .select("*")
        .eq("guild_id", guildId)
        .eq("flagged", true)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const firstError =
      ticketsRes.error ||
      auditLogsRes.error ||
      auditEventsRes.error ||
      staffMessagesRes.error ||
      rolesRes.error ||
      metricsRes.error ||
      categoriesRes.error ||
      memberJoinsRes.error ||
      recentActiveMembersRes.error ||
      recentFormerMembersRes.error ||
      allGuildMembersRes.error ||
      warnsTodayRes.error ||
      raidAlertsRes.error ||
      fraudFlagsRes.error ||
      activeMembersCountRes.error ||
      formerMembersCountRes.error ||
      pendingVerificationCountRes.error ||
      verifiedMembersCountRes.error ||
      staffMembersCountRes.error ||
      warnsRowsRes.error ||
      raidsRowsRes.error ||
      fraudRowsRes.error;

    if (firstError) {
      if (debugEnabled()) {
        console.error("[dashboard/live] query error =", firstError);
      }

      return Response.json(
        { error: firstError.message || "Failed to load dashboard data." },
        { status: 500 }
      );
    }

    const rawTickets = safeArray(ticketsRes.data).map(mapTicket);
    const canonicalTickets = canonicalizeTickets(rawTickets);

    const auditLogs = safeArray(auditLogsRes.data);
    const auditEvents = safeArray(auditEventsRes.data);
    const staffMessages = safeArray(staffMessagesRes.data);
    const categories = categoriesRes.data || [];
    const memberJoins = memberJoinsRes.data || [];
    const recentActiveMembers = safeArray(recentActiveMembersRes.data).map(
      mapGuildMember
    );
    const recentFormerMembers = safeArray(recentFormerMembersRes.data).map(
      mapGuildMember
    );
    const guildMembers = safeArray(allGuildMembersRes.data).map(mapGuildMember);

    const activeTickets = canonicalTickets.filter((ticket) => {
      if (!isOpenLikeStatus(ticket?.status)) return false;
      if (shouldHideStaleOpenTicket(ticket)) return false;
      return true;
    });

    const closedTickets = canonicalTickets.filter(
      (ticket) =>
        isClosedLikeStatus(ticket?.status) || shouldHideStaleOpenTicket(ticket)
    );

    const events = buildTimeline(
      auditLogs,
      auditEvents,
      staffMessages,
      guildMembers
    );

    const roles = safeArray(rolesRes.data).map((role) => ({
      ...role,
      member_count: Math.max(
        Number(role?.member_count || 0),
        computeRoleMemberCount(role, guildMembers)
      ),
    }));

    const warns = safeArray(warnsRowsRes.data).map((row) =>
      mapWarn(row, guildMembers)
    );

    const raids = safeArray(raidsRowsRes.data).map(mapRaid);

    const fraud = safeArray(fraudRowsRes.data).map((row) =>
      mapFraud(row, guildMembers)
    );

    const joinUserIds = [
      ...new Set(
        memberJoins
          .map((row) => String(row?.user_id || "").trim())
          .filter(Boolean)
      ),
    ];

    let recentJoins = [];

    if (joinUserIds.length) {
      const memberMap = new Map(
        guildMembers.map((row) => [String(row.user_id), row])
      );

      recentJoins = memberJoins
        .map((joinRow) =>
          mergeJoinWithMember(joinRow, memberMap.get(String(joinRow.user_id)))
        )
        .sort(
          (a, b) =>
            toJoinedTimestamp(b.joined_at || b.created_at) -
            toJoinedTimestamp(a.joined_at || a.created_at)
        )
        .slice(0, 25);
    }

    const memberRows = guildMembers
      .slice()
      .sort(
        (a, b) =>
          toTime(b.updated_at || b.last_seen_at || b.joined_at) -
          toTime(a.updated_at || a.last_seen_at || a.joined_at)
      );

    const metrics = deriveMetricsFromTickets(
      rawTickets,
      metricsRes.data || [],
      guildMembers
    );

    const openTicketsCount = activeTickets.length;
    const closedTicketsCount = closedTickets.length;

    if (debugEnabled()) {
      console.log("[dashboard/live] raw tickets found =", rawTickets.length);
      console.log(
        "[dashboard/live] canonical tickets found =",
        canonicalTickets.length
      );
      console.log("[dashboard/live] active tickets found =", activeTickets.length);
      console.log("[dashboard/live] closed tickets found =", closedTickets.length);
      console.log("[dashboard/live] metrics found =", metrics.length);
      console.log("[dashboard/live] auditLogs found =", auditLogs.length);
      console.log("[dashboard/live] auditEvents found =", auditEvents.length);
      console.log("[dashboard/live] staffMessages found =", staffMessages.length);
      console.log("[dashboard/live] merged timeline events =", events.length);
      console.log("[dashboard/live] warns found =", warns.length);
      console.log("[dashboard/live] raids found =", raids.length);
      console.log("[dashboard/live] fraud found =", fraud.length);
      console.log("[dashboard/live] memberJoins found =", memberJoins.length);
      console.log("[dashboard/live] recentJoins hydrated =", recentJoins.length);
      console.log(
        "[dashboard/live] recentActiveMembers found =",
        recentActiveMembers.length
      );
      console.log(
        "[dashboard/live] recentFormerMembers found =",
        recentFormerMembers.length
      );
      console.log("[dashboard/live] guildMembers found =", guildMembers.length);
      console.log("[dashboard/live] roles found =", roles.length);
      console.log("[dashboard/live] categories found =", categories.length);
      console.log(
        "[dashboard/live] activeMembersCount =",
        activeMembersCountRes.count || 0
      );
      console.log(
        "[dashboard/live] formerMembersCount =",
        formerMembersCountRes.count || 0
      );
      console.log(
        "[dashboard/live] pendingVerificationCount =",
        pendingVerificationCountRes.count || 0
      );
      console.log(
        "[dashboard/live] verifiedMembersCount =",
        verifiedMembersCountRes.count || 0
      );
      console.log(
        "[dashboard/live] staffMembersCount =",
        staffMembersCountRes.count || 0
      );
    }

    const payload = {
      tickets: sortTickets(activeTickets, "priority_desc"),
      activeTickets: sortTickets(activeTickets, "priority_desc"),
      closedTickets: sortTickets(closedTickets, "updated_desc"),
      events,
      warns,
      raids,
      fraud,
      fraudFlagsList: fraud,
      roles,
      metrics,
      categories,
      recentJoins,
      recentActiveMembers,
      recentFormerMembers,
      guildMembers,
      members: guildMembers,
      memberRows,
      memberCounts: {
        tracked:
          (activeMembersCountRes.count || 0) +
          (formerMembersCountRes.count || 0),
        active: activeMembersCountRes.count || 0,
        former: formerMembersCountRes.count || 0,
        pendingVerification: pendingVerificationCountRes.count || 0,
        verified: verifiedMembersCountRes.count || 0,
        staff: staffMembersCountRes.count || 0,
      },
      counts: {
        openTickets: openTicketsCount,
        closedTickets: closedTicketsCount,
        warnsToday: warnsTodayRes.count || 0,
        raidAlerts: raidAlertsRes.count || 0,
        fraudFlags: fraudFlagsRes.count || 0,
      },
      debug: debugEnabled()
        ? {
            guildId,
            envGuildId: process.env.GUILD_ID || "",
            envDiscordGuildId: process.env.DISCORD_GUILD_ID || "",
            rawTicketCount: rawTickets.length,
            canonicalTicketCount: canonicalTickets.length,
            activeTicketCount: activeTickets.length,
            closedTicketCount: closedTickets.length,
            metricsCount: metrics.length,
            guildMembersCount: guildMembers.length,
            timelineCount: events.length,
            warnsCount: warns.length,
            raidsCount: raids.length,
            fraudCount: fraud.length,
            staffMessagesCount: staffMessages.length,
            memberCounts: {
              tracked:
                (activeMembersCountRes.count || 0) +
                (formerMembersCountRes.count || 0),
              active: activeMembersCountRes.count || 0,
              former: formerMembersCountRes.count || 0,
              pendingVerification: pendingVerificationCountRes.count || 0,
              verified: verifiedMembersCountRes.count || 0,
              staff: staffMembersCountRes.count || 0,
            },
            recentJoinsCount: recentJoins.length,
            memberJoinsCount: memberJoins.length,
          }
        : undefined,
    };

    return Response.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (debugEnabled()) {
      console.error("[dashboard/live] fatal error =", error);
    }

    const message = error?.message || "Failed to load dashboard.";
    const unauthorized = message === "Unauthorized";

    return Response.json(
      { error: message },
      {
        status: unauthorized ? 401 : 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
