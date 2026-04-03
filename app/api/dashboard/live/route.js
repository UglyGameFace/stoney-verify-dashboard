import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { sortTickets, derivePriority } from "@/lib/priority";
import { requireStaffSessionForRoute } from "@/lib/auth-server";
import { enrichTicketWithMatchedCategory } from "@/lib/ticketCategoryMatching";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function debugEnabled() {
  return String(process.env.DASHBOARD_DEBUG || "").toLowerCase() === "true";
}

async function discordApi(path) {
  const token = process.env.DISCORD_TOKEN || env.discordToken || "";

  if (!token) {
    throw new Error("Missing DISCORD_TOKEN");
  }

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Discord API ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
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
    parseDateMs(ticket?.deleted_at),
    parseDateMs(ticket?.reopened_at)
  );
}

function ageMinutesFromTicket(ticket) {
  const newest = newestTicketTimestamp(ticket);
  if (!newest) return 999999;
  return Math.max(0, (Date.now() - newest) / 60000);
}

function shouldHideStaleClosedTicket(ticket) {
  const status = normalizeStatus(ticket?.status);
  if (!isClosedLikeStatus(status)) return false;

  const missingChannel = !hasUsableChannel(ticket);
  const hasTranscript = hasTranscriptEvidence(ticket);

  if (!missingChannel) return false;
  if (hasTranscript) return false;

  return ageMinutesFromTicket(ticket) <= 10;
}

function shouldHideStaleOpenTicket(ticket) {
  const status = normalizeStatus(ticket?.status);
  if (!isOpenLikeStatus(status)) return false;

  const missingChannel = !hasUsableChannel(ticket);
  const hasTranscript = hasTranscriptEvidence(ticket);
  const ageMinutes = ageMinutesFromTicket(ticket);

  if (missingChannel && hasTranscript) return true;
  if (missingChannel && ageMinutes > 30) return true;

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
  if (status === "claimed") score += 24;
  if (status === "open") score += 18;
  if (status === "closed") score += 8;
  if (status === "deleted") score += 4;

  const ageMinutes = newest > 0 ? (now - newest) / 60000 : 999999;
  if (ageMinutes <= 30) score += 30;
  else if (ageMinutes <= 180) score += 15;
  else if (ageMinutes <= 1440) score += 5;
  else if (ageMinutes > 2880) score -= 8;

  if (shouldHideStaleOpenTicket(ticket)) score -= 1000;
  if (shouldHideStaleClosedTicket(ticket)) score -= 1000;

  return score;
}

function canonicalTicketKey(ticket) {
  const channelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);
  if (channelId) return `channel:${channelId}`;

  const ticketNumber = normalizeString(ticket?.ticket_number);
  if (ticketNumber) return `ticket_number:${ticketNumber}`;

  const userId = normalizeString(ticket?.user_id || ticket?.owner_id);
  const category = normalizeString(ticket?.category).toLowerCase();
  const username = normalizeString(ticket?.username).toLowerCase();
  const title = normalizeString(ticket?.title).toLowerCase();

  if (userId && category) return `user:${userId}:${category}`;
  if (userId && title) return `user_title:${userId}:${title}`;
  if (username && category) return `username:${username}:${category}`;

  return `row:${normalizeString(ticket?.id)}`;
}

function chooseBestTicketInGroup(group) {
  const sorted = [...group].sort((a, b) => {
    const scoreDiff = ticketFreshnessScore(b) - ticketFreshnessScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    const statusA = normalizeStatus(a?.status);
    const statusB = normalizeStatus(b?.status);

    if (isOpenLikeStatus(statusA) !== isOpenLikeStatus(statusB)) {
      return isOpenLikeStatus(statusB) ? 1 : -1;
    }

    const newestDiff = newestTicketTimestamp(b) - newestTicketTimestamp(a);
    if (newestDiff !== 0) return newestDiff;

    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });

  return sorted[0] || null;
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

  const chosen = [];

  for (const [, group] of grouped.entries()) {
    const best = chooseBestTicketInGroup(group);
    if (best) chosen.push(best);
  }

  return chosen.sort((a, b) => {
    const statusA = normalizeStatus(a?.status);
    const statusB = normalizeStatus(b?.status);

    if (isOpenLikeStatus(statusA) !== isOpenLikeStatus(statusB)) {
      return isOpenLikeStatus(statusB) ? 1 : -1;
    }

    return newestTicketTimestamp(b) - newestTicketTimestamp(a);
  });
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

function isTruthyFlag(value) {
  if (typeof value === "boolean") return value;
  const text = normalizeString(value).toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function isLikelyBotName(value) {
  const text = normalizeString(value).toLowerCase();
  if (!text) return false;

  const needles = [
    "bot",
    "ticket tool",
    "tickettool",
    "disboard",
    "probot",
    "jockie music",
    "top.gg",
    "pokemon idle",
    "verify helper",
    "stoney verify",
    "stoney-verify-helper",
    "manager bot",
    "idle grow op",
  ];

  return needles.some((needle) => text.includes(needle));
}

function isBotLikeMember(member) {
  if (!member) return false;

  if (
    isTruthyFlag(member?.is_bot) ||
    isTruthyFlag(member?.bot) ||
    isTruthyFlag(member?.isBot) ||
    isTruthyFlag(member?.user_is_bot) ||
    isTruthyFlag(member?.member_is_bot)
  ) {
    return true;
  }

  return isLikelyBotName(member?.display_name) || isLikelyBotName(member?.username);
}

function pickBestStaffDisplayName(candidates, fallback = "Unknown Staff") {
  const cleaned = safeArray(candidates)
    .map(cleanDisplayName)
    .filter(Boolean)
    .filter((name) => !isLikelyBotName(name));

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
      ...(Array.isArray(member?.previous_usernames) ? member.previous_usernames : []),
      ...(Array.isArray(member?.previous_display_names) ? member.previous_display_names : []),
      ...(Array.isArray(member?.previous_nicknames) ? member.previous_nicknames : []),
    ]
      .map((v) => normalizeString(v))
      .filter(Boolean);

    if (userId) {
      byId.set(userId, member);
    }

    for (const name of names) {
      const key = name.toLowerCase();
      if (key && userId && !nameToId.has(key)) {
        nameToId.set(key, userId);
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

function deriveMetricsFromTickets(tickets = [], existingMetrics = [], guildMembers = []) {
  const humanGuildMembers = safeArray(guildMembers).filter(
    (member) => !isBotLikeMember(member)
  );

  const memberMaps = buildMemberIdentityMaps(humanGuildMembers);
  const byStaff = new Map();

  function isHumanIdentity(identity) {
    if (!identity?.key) return false;
    if (identity.member) return !isBotLikeMember(identity.member);
    if (isLikelyBotName(identity.rawName)) return false;
    return true;
  }

  function ensureRow(identityKey, seed = {}) {
    const key = normalizeStaffKey(identityKey);
    if (!key) return null;

    if (!byStaff.has(key)) {
      const member = seed.member || null;

      if (member && isBotLikeMember(member)) {
        return null;
      }

      const fallbackName =
        member?.display_name ||
        member?.nickname ||
        member?.username ||
        seed?.staff_name ||
        seed?.rawName ||
        "Unknown Staff";

      if (isLikelyBotName(fallbackName)) {
        return null;
      }

      byStaff.set(key, {
        staff_id: looksLikeDiscordId(key)
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
          fallbackName
        ),
        tickets_handled: 0,
        approvals: 0,
        denials: 0,
        avg_response_minutes: 0,
        last_active: null,
        is_bot: false,
      });
    }

    return byStaff.get(key);
  }

  for (const row of safeArray(existingMetrics)) {
    const idIdentity = resolveStaffIdentity(row?.staff_id, memberMaps);
    const nameIdentity = resolveStaffIdentity(row?.staff_name, memberMaps);

    const preferredMember = idIdentity.member || nameIdentity.member || null;
    const identityKey =
      idIdentity.key ||
      nameIdentity.key ||
      normalizeStaffKey(row?.staff_id || row?.staff_name);

    if (!identityKey) continue;
    if (preferredMember && isBotLikeMember(preferredMember)) continue;
    if (!preferredMember && isLikelyBotName(row?.staff_name || row?.staff_id)) continue;

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
      is_bot: false,
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
    if (!isHumanIdentity(identity)) continue;

    const row = ensureRow(identity.key, {
      staff_id:
        identity.member?.user_id ||
        (looksLikeDiscordId(identity.key) ? identity.key : ""),
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

    const updatedAt = ticket?.updated_at || ticket?.closed_at || ticket?.created_at || null;

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

      const denied = /\b(deny|denied|reject|rejected|decline|declined|failed)\b/.test(reasonText);

      if (category.includes("verification")) {
        if (denied) row.denials += 1;
        else row.approvals += 1;
      }
    }
  }

  return [...byStaff.values()]
    .filter((row) => row.staff_id || row.staff_name)
    .filter((row) => !isLikelyBotName(row?.staff_name || row?.staff_id))
    .sort((a, b) => {
      const handledDiff = Number(b?.tickets_handled || 0) - Number(a?.tickets_handled || 0);
      if (handledDiff !== 0) return handledDiff;

      const approvalsDiff = Number(b?.approvals || 0) - Number(a?.approvals || 0);
      if (approvalsDiff !== 0) return approvalsDiff;

      return String(a?.staff_name || a?.staff_id || "").localeCompare(
        String(b?.staff_name || b?.staff_id || "")
      );
    });
}

function mergeJoinWithMember(joinRow, memberRow) {
  return {
    ...(memberRow || {}),
    ...(joinRow || {}),
    user_id: joinRow?.user_id || memberRow?.user_id || "",
    username: memberRow?.username || joinRow?.username || "",
    display_name:
      memberRow?.display_name || joinRow?.display_name || joinRow?.username || "",
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
    voice_channel_id: memberRow?.voice_channel_id || null,
    voice_state: memberRow?.voice_state || null,
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
    is_bot:
      Boolean(row?.is_bot) ||
      Boolean(row?.bot) ||
      Boolean(row?.isBot) ||
      Boolean(row?.user_is_bot) ||
      Boolean(row?.member_is_bot),
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
    data_health: row?.data_health || "unknown",
    joined_at: row?.joined_at || null,
    synced_at: row?.synced_at || null,
    updated_at: row?.updated_at || null,
    last_seen_at: row?.last_seen_at || null,
    left_at: row?.left_at || null,
    rejoined_at: row?.rejoined_at || null,
    previous_usernames: Array.isArray(row?.previous_usernames) ? row.previous_usernames : [],
    previous_display_names: Array.isArray(row?.previous_display_names) ? row.previous_display_names : [],
    previous_nicknames: Array.isArray(row?.previous_nicknames) ? row.previous_nicknames : [],
    voice_channel_id: row?.voice_channel_id || null,
    voice_state: row?.voice_state || null,
  };
}

function computeRoleMemberCount(role, members) {
  const roleId = normalizeString(role?.role_id);
  const roleName = normalizeString(role?.name).toLowerCase();

  return members.filter((member) => {
    const ids = safeArray(member?.role_ids).map((v) => normalizeString(v));
    const names = safeArray(member?.role_names).map((v) => normalizeString(v).toLowerCase());

    return (
      (roleId && ids.includes(roleId)) ||
      (roleName && names.includes(roleName))
    );
  }).length;
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

function mapVoiceChannels(channels) {
  const allowedTypes = new Set([2, 13]);
  const rows = safeArray(channels)
    .filter((channel) => allowedTypes.has(Number(channel?.type)))
    .map((channel) => ({
      id: String(channel?.id || "").trim(),
      name: String(channel?.name || "").trim() || "Unnamed Voice",
      type: Number(channel?.type || 0),
      parent_id: channel?.parent_id || null,
      position: Number(channel?.position || 0),
      bitrate: Number(channel?.bitrate || 0),
      user_limit: Number(channel?.user_limit || 0),
    }))
    .filter((channel) => channel.id);

  rows.sort((a, b) => {
    const parentA = String(a.parent_id || "");
    const parentB = String(b.parent_id || "");
    if (parentA !== parentB) return parentA.localeCompare(parentB);
    if (a.position !== b.position) return a.position - b.position;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

function buildIntelligence({ counts, memberCounts, fraud, guildMembers }) {
  const openTickets = Number(counts?.openTickets || 0);
  const warnsToday = Number(counts?.warnsToday || 0);
  const raidAlerts = Number(counts?.raidAlerts || 0);
  const fraudFlags = Number(counts?.fraudFlags || 0);
  const pendingVerification = Number(memberCounts?.pendingVerification || 0);
  const verified = Number(memberCounts?.verified || 0);
  const active = Number(memberCounts?.active || 0);

  let serverHealth = "Stable";
  if (fraudFlags >= 4 || raidAlerts >= 2 || openTickets >= 14) {
    serverHealth = "Elevated";
  }
  if (fraudFlags >= 8 || raidAlerts >= 4 || openTickets >= 24) {
    serverHealth = "Critical";
  }

  let raidRisk = "Low";
  let raidReason = "No recent raid alert threshold was crossed.";
  if (raidAlerts >= 1) {
    raidRisk = "Moderate";
    raidReason = `${raidAlerts} recent raid alert(s) were recorded in the last 24 hours.`;
  }
  if (raidAlerts >= 3) {
    raidRisk = "High";
    raidReason = `${raidAlerts} raid alerts were recorded recently and need immediate review.`;
  }

  let fraudRisk = "Low";
  let fraudReason = "No active fraud flags are currently driving the score.";
  if (fraudFlags >= 1 || pendingVerification >= 12) {
    fraudRisk = "Moderate";
    fraudReason =
      fraudFlags >= 1
        ? `${fraudFlags} active fraud flag(s) exist and should be reviewed.`
        : `Verification backlog is elevated at ${pendingVerification} pending, which raises fraud/manual review pressure.`;
  }
  if (fraudFlags >= 5) {
    fraudRisk = "High";
    fraudReason = `${fraudFlags} active fraud flag(s) are currently unresolved.`;
  }

  let ticketPressure = "Low";
  let ticketReason = "Ticket load is within normal range.";
  if (openTickets >= 6) {
    ticketPressure = "Moderate";
    ticketReason = `${openTickets} active tickets are open or claimed.`;
  }
  if (openTickets >= 14) {
    ticketPressure = "High";
    ticketReason = `${openTickets} active tickets are creating heavy staff load.`;
  }

  let verificationPressure = "Low";
  let verificationReason = "Verification queue is under control.";
  if (pendingVerification >= 8) {
    verificationPressure = "Moderate";
    verificationReason = `${pendingVerification} members are currently pending verification after strict filtering.`;
  }
  if (pendingVerification >= 16) {
    verificationPressure = "High";
    verificationReason = `${pendingVerification} members are pending verification and the queue likely needs direct staff cleanup.`;
  }

  const verifiedRate = active > 0 ? Math.round((verified / active) * 100) : 0;

  const topFraudMembers = safeArray(fraud)
    .slice(0, 5)
    .map((row) => ({
      user_id: row?.user_id || "",
      display_name: row?.display_name || row?.username || row?.user_id || "Unknown User",
      score: Number(row?.score || 0),
      reasons: Array.isArray(row?.reasons) ? row.reasons : [],
    }));

  const topConflictMembers = safeArray(guildMembers)
    .filter((member) => String(member?.role_state || "").includes("conflict"))
    .slice(0, 5)
    .map((member) => ({
      user_id: member?.user_id || "",
      display_name:
        member?.display_name || member?.nickname || member?.username || member?.user_id || "Unknown User",
      role_state: member?.role_state || "unknown",
      role_state_reason: member?.role_state_reason || "",
    }));

  return {
    serverHealth,
    raidRisk,
    fraudRisk,
    ticketPressure,
    verificationPressure,
    verifiedRate,
    reasons: {
      serverHealth:
        serverHealth === "Stable"
          ? "No major threshold is currently tripping the health score."
          : "Health is elevated by ticket load, fraud signals, or raid activity.",
      raidRiskReason: raidReason,
      fraudRiskReason: fraudReason,
      ticketPressureReason: ticketReason,
      verificationPressureReason: verificationReason,
    },
    topFraudMembers,
    topConflictMembers,
  };
}

function buildSupportPayload({ roles, voiceChannels, debugInfo = null }) {
  return {
    roles,
    voiceChannels,
    supportOnly: true,
    debug: debugEnabled() ? debugInfo : undefined,
  };
}

// NOTE: Bumping the max and default limit drastically to support pulling back the missing historical events
function clampActivityLimit(value, fallback = 500, max = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeString(value);
    if (text) return text;
  }
  return "";
}

function getSafeMeta(row) {
  return row?.metadata && typeof row.metadata === "object"
    ? row.metadata
    : row?.meta && typeof row.meta === "object"
      ? row.meta
      : {};
}

function resolveMemberByIdOrName({ guildMembers, memberMaps, idCandidates = [], nameCandidates = [] }) {
  for (const candidate of idCandidates) {
    const id = normalizeString(candidate);
    if (!id) continue;
    const member = memberMaps.byId.get(id);
    if (member) {
      return {
        member,
        id,
        resolvedBy: "id",
      };
    }
  }

  for (const candidate of nameCandidates) {
    const name = normalizeString(candidate);
    if (!name) continue;
    const matchedId = memberMaps.nameToId.get(name.toLowerCase());
    if (matchedId) {
      const member = memberMaps.byId.get(matchedId);
      if (member) {
        return {
          member,
          id: matchedId,
          resolvedBy: "name",
        };
      }
    }
  }

  return {
    member: null,
    id: "",
    resolvedBy: "",
  };
}

function mapActivityFeedEvent(row, guildMembers, memberMaps) {
  const meta = getSafeMeta(row);

  const actorIdCandidates = [
    row?.actor_user_id,
    row?.actor_id,
    row?.staff_id,
    row?.requested_by,
    row?.performed_by,
    meta?.actor_user_id,
    meta?.actor_id,
    meta?.staff_id,
    meta?.requested_by,
    meta?.performed_by,
    meta?.closed_by,
    meta?.claimed_by,
    meta?.assigned_to,
  ];

  const actorNameCandidates = [
    row?.actor_name,
    row?.actor_display,
    row?.staff_name,
    row?.requested_by_name,
    row?.performed_by_name,
    meta?.actor_name,
    meta?.actor_display,
    meta?.staff_name,
    meta?.staff_display,
    meta?.requested_by_name,
    meta?.performed_by_name,
    meta?.closed_by_name,
    meta?.claimed_by_name,
    meta?.assigned_to_name,
  ];

  const targetIdCandidates = [
    row?.target_user_id,
    row?.user_id,
    row?.member_id,
    row?.owner_id,
    meta?.target_user_id,
    meta?.user_id,
    meta?.member_id,
    meta?.owner_id,
    meta?.requester_id,
  ];

  const targetNameCandidates = [
    row?.target_name,
    row?.username,
    row?.member_name,
    row?.owner_name,
    meta?.target_name,
    meta?.username,
    meta?.member_name,
    meta?.owner_name,
    meta?.requester_display_name,
    meta?.requester_username,
  ];

  const actorResolved = resolveMemberByIdOrName({
    guildMembers,
    memberMaps,
    idCandidates: actorIdCandidates,
    nameCandidates: actorNameCandidates,
  });

  const targetResolved = resolveMemberByIdOrName({
    guildMembers,
    memberMaps,
    idCandidates: targetIdCandidates,
    nameCandidates: targetNameCandidates,
  });

  const actorId = firstNonEmpty(
    actorResolved?.member?.user_id,
    actorResolved?.id,
    row?.actor_user_id,
    row?.actor_id,
    row?.staff_id,
    row?.requested_by,
    row?.performed_by,
    meta?.actor_user_id,
    meta?.actor_id,
    meta?.staff_id,
    meta?.requested_by,
    meta?.performed_by
  );

  const actorName = firstNonEmpty(
    row?.actor_name,
    row?.actor_display,
    row?.staff_name,
    row?.requested_by_name,
    row?.performed_by_name,
    meta?.actor_name,
    meta?.actor_display,
    meta?.staff_name,
    meta?.staff_display,
    meta?.requested_by_name,
    meta?.performed_by_name,
    actorResolved?.member?.display_name,
    actorResolved?.member?.nickname,
    actorResolved?.member?.username
  );

  const targetId = firstNonEmpty(
    targetResolved?.member?.user_id,
    targetResolved?.id,
    row?.target_user_id,
    row?.user_id,
    row?.member_id,
    row?.owner_id,
    meta?.target_user_id,
    meta?.user_id,
    meta?.member_id,
    meta?.owner_id,
    meta?.requester_id
  );

  const targetName = firstNonEmpty(
    row?.target_name,
    row?.username,
    row?.member_name,
    row?.owner_name,
    meta?.target_name,
    meta?.username,
    meta?.member_name,
    meta?.owner_name,
    meta?.requester_display_name,
    meta?.requester_username,
    targetResolved?.member?.display_name,
    targetResolved?.member?.nickname,
    targetResolved?.member?.username
  );

  const title =
    row?.title ||
    row?.event_type ||
    row?.event_family ||
    "Activity Event";

  const description =
    truncateText(
      row?.description ||
        row?.reason ||
        meta?.reason ||
        row?.title ||
        row?.event_type ||
        "",
      220
    ) || "Activity event";

  const eventType = firstNonEmpty(row?.event_type, meta?.event_type, "activity_event");
  const eventFamily = firstNonEmpty(row?.event_family, meta?.event_family, "system");
  const source = firstNonEmpty(row?.source, meta?.source, "system");

  const searchText = [
    row?.search_text,
    row?.title,
    row?.description,
    row?.reason,
    eventType,
    eventFamily,
    source,
    actorName,
    actorId,
    targetName,
    targetId,
    row?.channel_name,
    row?.channel_id,
    row?.ticket_id,
    row?.ticket_message_id,
    row?.related_id,
    row?.related_table,
    JSON.stringify(meta || {}),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `activity-${row?.id || Math.random()}`,
    activity_id: row?.id || null,
    title,
    description,
    event_type: eventType,
    event_family: eventFamily,
    related_id: row?.related_id || row?.ticket_id || row?.channel_id || null,
    created_at: row?.created_at || null,
    actor_id: actorId || null,
    actor_name: actorName || null,
    actor_avatar_url: actorResolved?.member?.avatar_url || null,
    target_user_id: targetId || null,
    target_name: targetName || null,
    target_avatar_url: targetResolved?.member?.avatar_url || null,
    source,
    channel_id: row?.channel_id || meta?.channel_id || null,
    channel_name: row?.channel_name || meta?.channel_name || null,
    ticket_id: row?.ticket_id || meta?.ticket_id || null,
    ticket_message_id: row?.ticket_message_id || meta?.ticket_message_id || null,
    related_table: row?.related_table || meta?.related_table || null,
    reason: row?.reason || meta?.reason || null,
    meta,
    search_text: searchText,
  };
}

function buildTimeline(activityRows, guildMembers, limit = 500) {
  const memberMaps = buildMemberIdentityMaps(guildMembers);

  return safeArray(activityRows)
    .map((row) => mapActivityFeedEvent(row, guildMembers, memberMaps))
    .sort((a, b) => toTime(b.created_at) - toTime(a.created_at))
    .slice(0, limit);
}

async function loadActivityFeed({
  supabase,
  guildId,
  activityQuery,
  activityUserId,
  activityActorId,
  activityFamily,
  activityType,
  activitySource,
  activityLimit,
}) {
  let query = supabase
    .from("activity_feed_events")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(activityLimit);

  if (activityUserId) {
    query = query.eq("target_user_id", activityUserId);
  }

  if (activityActorId) {
    query = query.eq("actor_user_id", activityActorId);
  }

  if (activityFamily) {
    query = query.eq("event_family", activityFamily);
  }

  if (activityType) {
    query = query.eq("event_type", activityType);
  }

  if (activitySource) {
    query = query.eq("source", activitySource);
  }

  if (activityQuery) {
    query = query.ilike("search_text", `%${activityQuery}%`);
  }

  return query;
}

function isPendingVerificationMember(row) {
  const member = mapGuildMember(row);
  if (!member) return false;
  if (member.in_guild === false) return false;
  if (member.is_bot) return false;
  if (member.has_staff_role) return false;
  if (member.has_verified_role) return false;
  if (!member.has_unverified) return false;

  const health = normalizeString(member?.data_health || "ok").toLowerCase();
  if (health === "left_guild") return false;

  const roleState = normalizeString(member?.role_state || "").toLowerCase();
  if (roleState && roleState !== "unverified_only" && roleState !== "missing_verified_role" && roleState !== "unknown") {
    return false;
  }

  return true;
}

export async function GET(request) {
  try {
    await requireStaffSessionForRoute();

    const supabase = createServerSupabase();
    const guildId = env.guildId || "";
    const url = new URL(request.url);

    const supportOnly =
      url.searchParams.get("support_only") === "1" ||
      url.searchParams.get("supportOnly") === "1" ||
      url.searchParams.get("mode") === "support";

    const activityQuery = normalizeString(url.searchParams.get("activity_q"));
    const activityUserId = normalizeString(url.searchParams.get("activity_user_id"));
    const activityActorId = normalizeString(url.searchParams.get("activity_actor_id"));
    const activityFamily = normalizeString(url.searchParams.get("activity_family"));
    const activityType = normalizeString(url.searchParams.get("activity_type"));
    const activitySource = normalizeString(url.searchParams.get("activity_source"));
    // Defaulting to 500 up to 5000 to solve the missing historical events requirement natively here
    const activityLimit = clampActivityLimit(url.searchParams.get("activity_limit"), 500, 5000);

    if (debugEnabled()) {
      console.log("[dashboard/live] env.guildId =", guildId);
      console.log("[dashboard/live] DISCORD_GUILD_ID =", process.env.DISCORD_GUILD_ID || "");
      console.log("[dashboard/live] GUILD_ID =", process.env.GUILD_ID || "");
      console.log("[dashboard/live] supportOnly =", supportOnly);
      console.log("[dashboard/live] activity filters =", {
        activityQuery,
        activityUserId,
        activityActorId,
        activityFamily,
        activityType,
        activitySource,
        activityLimit,
      });
    }

    if (!guildId) {
      return Response.json(
        { error: "Missing guild id." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    if (supportOnly) {
      const [rolesRes, discordChannelsResult] = await Promise.all([
        supabase
          .from("guild_roles")
          .select("*")
          .eq("guild_id", guildId)
          .order("position", { ascending: false })
          .limit(100),

        discordApi(`/guilds/${guildId}/channels`).catch((error) => ({
          __discord_error: error?.message || "Failed to load Discord channels.",
        })),
      ]);

      if (rolesRes.error) {
        return Response.json(
          { error: rolesRes.error.message || "Failed to load support data." },
          {
            status: 500,
            headers: { "Cache-Control": "no-store, max-age=0" },
          }
        );
      }

      const roles = safeArray(rolesRes.data).map((role) => ({
        ...role,
        member_count: Number(role?.member_count || 0),
      }));

      const voiceChannels = discordChannelsResult?.__discord_error
        ? []
        : mapVoiceChannels(discordChannelsResult || []);

      return Response.json(
        buildSupportPayload({
          roles,
          voiceChannels,
          debugInfo: {
            guildId,
            rolesCount: roles.length,
            voiceChannelsCount: voiceChannels.length,
            voiceChannelsError: discordChannelsResult?.__discord_error || null,
          },
        }),
        {
          status: 200,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      ticketsRes,
      activityFeedRes,
      rolesRes,
      metricsRes,
      categoriesRes,
      memberJoinsRes,
      recentActiveMembersRes,
      recentFormerMembersRes,
      allGuildMembersRes,
      pendingVerificationRowsRes,
      warnsTodayRes,
      raidAlertsRes,
      fraudFlagsRes,
      activeMembersCountRes,
      formerMembersCountRes,
      verifiedMembersCountRes,
      staffMembersCountRes,
      warnsRowsRes,
      raidsRowsRes,
      fraudRowsRes,
      discordChannelsResult,
    ] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("guild_id", guildId)
        .order("updated_at", { ascending: false })
        .limit(1000),

      loadActivityFeed({
        supabase,
        guildId,
        activityQuery,
        activityUserId,
        activityActorId,
        activityFamily,
        activityType,
        activitySource,
        activityLimit,
      }),

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
        .order("sort_order", { ascending: true, nullsFirst: false })
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
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .eq("in_guild", true)
        .eq("is_bot", false)
        .eq("has_staff_role", false)
        .eq("has_verified_role", false)
        .eq("has_unverified", true)
        .order("updated_at", { ascending: false })
        .limit(250),

      // Counts still need to look at last 24h
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
        .eq("in_guild", true)
        .eq("is_bot", false),

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
        .eq("is_bot", false)
        .eq("has_verified_role", true),

      supabase
        .from("guild_members")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("in_guild", true)
        .eq("is_bot", false)
        .eq("has_staff_role", true),

      // Removed `.gte("created_at", last24hIso)` directly from rows to pull missing historical events & bumped limit
      supabase
        .from("warns")
        .select("*")
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("raid_events")
        .select("*")
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("verification_flags")
        .select("*")
        .eq("guild_id", guildId)
        .eq("flagged", true)
        .order("created_at", { ascending: false })
        .limit(100),

      discordApi(`/guilds/${guildId}/channels`).catch((error) => ({
        __discord_error: error?.message || "Failed to load Discord channels.",
      })),
    ]);

    const firstError =
      ticketsRes.error ||
      activityFeedRes.error ||
      rolesRes.error ||
      metricsRes.error ||
      categoriesRes.error ||
      memberJoinsRes.error ||
      recentActiveMembersRes.error ||
      recentFormerMembersRes.error ||
      allGuildMembersRes.error ||
      pendingVerificationRowsRes.error ||
      warnsTodayRes.error ||
      raidAlertsRes.error ||
      fraudFlagsRes.error ||
      activeMembersCountRes.error ||
      formerMembersCountRes.error ||
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

    const categoryRows = safeArray(categoriesRes.data || []);
    const mappedTickets = safeArray(ticketsRes.data).map(mapTicket);
    const rawTickets = mappedTickets.map((ticket) =>
      enrichTicketWithMatchedCategory(ticket, categoryRows)
    );
    const canonicalTickets = canonicalizeTickets(rawTickets);

    const categories = categoryRows;
    const memberJoins = memberJoinsRes.data || [];
    const recentActiveMembers = safeArray(recentActiveMembersRes.data).map(mapGuildMember);
    const recentFormerMembers = safeArray(recentFormerMembersRes.data).map(mapGuildMember);
    const guildMembers = safeArray(allGuildMembersRes.data).map(mapGuildMember);
    const activityFeedRows = safeArray(activityFeedRes.data || []);

    // Expose Exact Raw rows (so you aren't fighting missing members due to mapping/filtering assumptions)
    const pendingVerificationMembersRaw = safeArray(pendingVerificationRowsRes.data || []);

    const pendingVerificationMembers = pendingVerificationMembersRaw
      .map(mapGuildMember)
      .filter(isPendingVerificationMember)
      .sort(
        (a, b) =>
          toTime(b.updated_at || b.last_seen_at || b.joined_at) -
          toTime(a.updated_at || a.last_seen_at || a.joined_at)
      );

    const activeTickets = canonicalTickets.filter((ticket) => {
      if (!isOpenLikeStatus(ticket?.status)) return false;
      if (shouldHideStaleOpenTicket(ticket)) return false;
      return true;
    });

    const closedTickets = canonicalTickets.filter((ticket) => {
      if (!isClosedLikeStatus(ticket?.status)) return false;
      if (shouldHideStaleClosedTicket(ticket)) return false;
      return true;
    });

    const events = buildTimeline(activityFeedRows, guildMembers, activityLimit);

    const roles = safeArray(rolesRes.data).map((role) => ({
      ...role,
      member_count: Math.max(
        Number(role?.member_count || 0),
        computeRoleMemberCount(role, guildMembers)
      ),
    }));

    const warns = safeArray(warnsRowsRes.data).map((row) => mapWarn(row, guildMembers));
    const raids = safeArray(raidsRowsRes.data).map(mapRaid);
    const fraud = safeArray(fraudRowsRes.data).map((row) => mapFraud(row, guildMembers));

    const voiceChannels = discordChannelsResult?.__discord_error
      ? []
      : mapVoiceChannels(discordChannelsResult || []);

    const joinUserIds = [
      ...new Set(
        memberJoins.map((row) => String(row?.user_id || "").trim()).filter(Boolean)
      ),
    ];

    let recentJoins = [];

    if (joinUserIds.length) {
      const memberMap = new Map(guildMembers.map((row) => [String(row.user_id), row]));

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

    if (!recentJoins.length) {
      recentJoins = recentActiveMembers
        .slice()
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
      canonicalTickets,
      metricsRes.data || [],
      guildMembers
    );

    const openTicketsCount = activeTickets.length;
    const closedTicketsCount = closedTickets.length;

    const memberCounts = {
      tracked: (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
      active: activeMembersCountRes.count || 0,
      former: formerMembersCountRes.count || 0,
      pendingVerification: pendingVerificationMembers.length,
      verified: verifiedMembersCountRes.count || 0,
      staff: staffMembersCountRes.count || 0,
    };

    const counts = {
      openTickets: openTicketsCount,
      closedTickets: closedTicketsCount,
      warnsToday: warnsTodayRes.count || 0,
      raidAlerts: raidAlertsRes.count || 0,
      fraudFlags: fraudFlagsRes.count || 0,
    };

    const intelligence = buildIntelligence({
      counts,
      memberCounts,
      fraud,
      guildMembers,
    });

    if (debugEnabled()) {
      console.log("[dashboard/live] raw tickets found =", rawTickets.length);
      console.log("[dashboard/live] canonical tickets found =", canonicalTickets.length);
      console.log("[dashboard/live] active tickets found =", activeTickets.length);
      console.log("[dashboard/live] closed tickets found =", closedTickets.length);
      console.log("[dashboard/live] metrics found =", metrics.length);
      console.log("[dashboard/live] activity feed rows found =", activityFeedRows.length);
      console.log("[dashboard/live] merged timeline events =", events.length);
      console.log("[dashboard/live] warns found =", warns.length);
      console.log("[dashboard/live] raids found =", raids.length);
      console.log("[dashboard/live] fraud found =", fraud.length);
      console.log("[dashboard/live] guildMembers found =", guildMembers.length);
      console.log("[dashboard/live] pendingVerificationMembers =", pendingVerificationMembers.length);
      console.log("[dashboard/live] voiceChannels found =", voiceChannels.length);
      if (discordChannelsResult?.__discord_error) {
        console.warn("[dashboard/live] voice channel fetch warning =", discordChannelsResult.__discord_error);
      }
    }

    const payload = {
      tickets: sortTickets(canonicalTickets, "updated_desc"),
      activeTickets: sortTickets(activeTickets, "priority_desc"),
      closedTickets: sortTickets(closedTickets, "updated_desc"),
      events,
      activityFeed: events,
      activityFeedRaw: activityFeedRows,
      activityFilters: {
        q: activityQuery || "",
        user_id: activityUserId || "",
        actor_id: activityActorId || "",
        family: activityFamily || "",
        type: activityType || "",
        source: activitySource || "",
        limit: activityLimit,
      },
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
      memberCounts,
      pendingVerificationMembers,
      pendingVerificationMembersRaw, // Exposes the exact db member row for 1:1 mapping on the FE
      counts,
      intelligence,
      voiceChannels,
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
            activityFeedRowsCount: activityFeedRows.length,
            warnsCount: warns.length,
            raidsCount: raids.length,
            fraudCount: fraud.length,
            voiceChannelsCount: voiceChannels.length,
            voiceChannelsError: discordChannelsResult?.__discord_error || null,
            memberCounts,
            pendingVerificationMembers,
            recentJoinsCount: recentJoins.length,
            memberJoinsCount: memberJoins.length,
            activityFilters: {
              activityQuery,
              activityUserId,
              activityActorId,
              activityFamily,
              activityType,
              activitySource,
              activityLimit,
            },
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
