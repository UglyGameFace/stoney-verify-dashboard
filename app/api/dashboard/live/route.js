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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function truncateText(value, max = 240) {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function clampActivityLimit(value, fallback = 500, max = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function chunkArray(values, size = 150) {
  const clean = safeArray(values).filter(Boolean);
  const out = [];
  for (let i = 0; i < clean.length; i += size) {
    out.push(clean.slice(i, i + size));
  }
  return out;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of safeArray(items)) {
    const key = String(keyFn(item) || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function safeSupabaseRows(queryFactory) {
  try {
    const res = await queryFactory();
    return safeArray(res?.data);
  } catch {
    return [];
  }
}

async function safeSupabaseCount(queryFactory) {
  try {
    const res = await queryFactory();
    return Number(res?.count || 0);
  } catch {
    return 0;
  }
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
    normalizeString(ticket?.channel_id || ticket?.discord_thread_id)
  );
}

function hasTranscriptEvidence(ticket) {
  return Boolean(
    normalizeString(ticket?.transcript_url) ||
      normalizeString(ticket?.transcript_message_id) ||
      normalizeString(ticket?.transcript_channel_id)
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
  return Math.max(0, Math.floor((Date.now() - newest) / 60000));
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
  const newest = newestTicketTimestamp(ticket);

  let score = 0;

  if (hasUsableChannel(ticket)) score += 50;
  if (hasTranscriptEvidence(ticket)) score += 25;
  if (status === "claimed") score += 24;
  if (status === "open") score += 18;
  if (status === "closed") score += 8;
  if (status === "deleted") score += 4;

  const ageMinutes = newest > 0 ? (Date.now() - newest) / 60000 : 999999;
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
  const matchedSlug = normalizeString(ticket?.matched_category_slug).toLowerCase();
  const title = normalizeString(ticket?.title).toLowerCase();

  if (userId && matchedSlug) return `user:${userId}:${matchedSlug}`;
  if (userId && category) return `user:${userId}:${category}`;
  if (userId && title) return `user_title:${userId}:${title}`;

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
    if (!grouped.has(key)) grouped.set(key, []);
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
    first_seen_at: row?.first_seen_at || null,
    last_seen_username: row?.last_seen_username || null,
    last_seen_display_name: row?.last_seen_display_name || null,
    last_seen_nickname: row?.last_seen_nickname || null,
    previous_usernames: Array.isArray(row?.previous_usernames) ? row.previous_usernames : [],
    previous_display_names: Array.isArray(row?.previous_display_names) ? row.previous_display_names : [],
    previous_nicknames: Array.isArray(row?.previous_nicknames) ? row.previous_nicknames : [],
    top_role: row?.top_role || row?.highest_role_name || null,
    highest_role_name: row?.highest_role_name || row?.top_role || null,
    highest_role_id: row?.highest_role_id || null,
    invited_by: row?.invited_by || null,
    invited_by_name: row?.invited_by_name || null,
    invite_code: row?.invite_code || null,
    vouched_by: row?.vouched_by || null,
    vouched_by_name: row?.vouched_by_name || null,
    approved_by: row?.approved_by || null,
    approved_by_name: row?.approved_by_name || null,
    verification_ticket_id: row?.verification_ticket_id || null,
    source_ticket_id: row?.source_ticket_id || null,
    entry_method: row?.entry_method || null,
    verification_source: row?.verification_source || null,
    entry_reason: row?.entry_reason || null,
    approval_reason: row?.approval_reason || null,
  };
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
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeString(value);
    if (text) return text;
  }
  return "";
}

function looksLikeDiscordId(value) {
  return /^\d{16,22}$/.test(normalizeString(value));
}

function getBestMemberDisplayName(member) {
  return firstNonEmpty(
    member?.display_name,
    member?.nickname,
    member?.username
  );
}

function cleanIdentityLabel(value) {
  let text = normalizeString(value);
  if (!text) return "";
  if (looksLikeDiscordId(text)) return "";

  text = text.replace(/\(\s*(\d{16,22})\s*\)\s*[•·]\s*\1\b/g, "($1)");
  text = text.replace(/\b(\d{16,22})\b\s*[•·]\s*\1\b/g, "$1");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function firstNonEmptyCleanIdentity(...values) {
  for (const value of values) {
    const text = cleanIdentityLabel(value);
    if (text) return text;
  }
  return "";
}

function getBestAvatarUrl(...values) {
  for (const value of values) {
    const text = normalizeString(value);
    if (!text) continue;
    if (looksLikeDiscordId(text)) continue;
    if (text === "[object Object]") continue;
    return text;
  }
  return "";
}

function resolveStaffContext({
  memberMaps,
  idCandidates = [],
  nameCandidates = [],
}) {
  const cleanedIdCandidates = safeArray(idCandidates)
    .map((value) => normalizeString(value))
    .filter(Boolean);

  const cleanedNameCandidates = safeArray(nameCandidates)
    .map((value) => normalizeString(value))
    .filter(Boolean);

  const resolved = resolveMemberByIdOrName({
    memberMaps,
    idCandidates: cleanedIdCandidates,
    nameCandidates: cleanedNameCandidates,
  });

  const resolvedMember = resolved?.member || null;
  const resolvedId = firstNonEmpty(resolved?.id, ...cleanedIdCandidates);

  const explicitName =
    cleanedNameCandidates.find((value) => value && !looksLikeDiscordId(value)) || "";

  const resolvedName = firstNonEmpty(
    explicitName,
    getBestMemberDisplayName(resolvedMember)
  );

  return {
    id: resolvedId || null,
    name: resolvedName || (resolvedId ? "Unknown Staff" : "Unclaimed"),
    avatar_url: resolvedMember?.avatar_url || null,
  };
}

function buildMemberIdentityMaps(guildMembers) {
  const byId = new Map();
  const nameToId = new Map();

  for (const member of safeArray(guildMembers)) {
    const userId = normalizeString(member?.user_id);
    if (userId) byId.set(userId, member);

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

    for (const name of names) {
      const key = name.toLowerCase();
      if (key && userId && !nameToId.has(key)) {
        nameToId.set(key, userId);
      }
    }
  }

  return { byId, nameToId };
}

function getSafeMeta(row) {
  return row?.metadata && typeof row.metadata === "object"
    ? row.metadata
    : row?.meta && typeof row.meta === "object"
      ? row.meta
      : {};
}

function resolveMemberByIdOrName({ memberMaps, idCandidates = [], nameCandidates = [] }) {
  for (const candidate of idCandidates) {
    const id = normalizeString(candidate);
    if (!id) continue;
    const member = memberMaps.byId.get(id);
    if (member) {
      return { member, id, resolvedBy: "id" };
    }
  }

  for (const candidate of nameCandidates) {
    const name = normalizeString(candidate);
    if (!name) continue;
    const matchedId = memberMaps.nameToId.get(name.toLowerCase());
    if (!matchedId) continue;
    const member = memberMaps.byId.get(matchedId);
    if (member) {
      return { member, id: matchedId, resolvedBy: "name" };
    }
  }

  return { member: null, id: "", resolvedBy: "" };
}

function mapActivityFeedEvent(row, guildMembers, memberMaps) {
  const meta = getSafeMeta(row);

  const actorResolved = resolveMemberByIdOrName({
    memberMaps,
    idCandidates: [
      row?.actor_user_id,
      row?.actor_id,
      row?.staff_id,
      meta?.actor_user_id,
      meta?.actor_id,
      meta?.staff_id,
      meta?.requested_by,
      meta?.closed_by,
      meta?.claimed_by,
      meta?.assigned_to,
    ],
    nameCandidates: [
      row?.actor_name,
      row?.actor_display,
      row?.staff_name,
      meta?.actor_name,
      meta?.actor_display,
      meta?.staff_name,
      meta?.requested_by_name,
      meta?.closed_by_name,
      meta?.claimed_by_name,
      meta?.assigned_to_name,
    ],
  });

  const targetResolved = resolveMemberByIdOrName({
    memberMaps,
    idCandidates: [
      row?.target_user_id,
      row?.user_id,
      row?.member_id,
      meta?.target_user_id,
      meta?.user_id,
      meta?.member_id,
      meta?.owner_id,
      meta?.requester_id,
    ],
    nameCandidates: [
      row?.target_name,
      row?.username,
      row?.member_name,
      meta?.target_name,
      meta?.username,
      meta?.member_name,
      meta?.owner_name,
      meta?.requester_display_name,
      meta?.requester_username,
    ],
  });

  const actorId = firstNonEmpty(
    actorResolved?.member?.user_id,
    actorResolved?.id,
    row?.actor_user_id,
    row?.actor_id,
    row?.staff_id,
    meta?.actor_user_id,
    meta?.actor_id,
    meta?.staff_id
  );

  const targetId = firstNonEmpty(
    targetResolved?.member?.user_id,
    targetResolved?.id,
    row?.target_user_id,
    row?.user_id,
    row?.member_id,
    meta?.target_user_id,
    meta?.user_id,
    meta?.member_id,
    meta?.owner_id,
    meta?.requester_id
  );

  const resolvedActorName = getBestMemberDisplayName(actorResolved?.member);
  const resolvedTargetName = getBestMemberDisplayName(targetResolved?.member);

  const actorName = firstNonEmpty(
    resolvedActorName,
    firstNonEmptyCleanIdentity(
      row?.actor_name,
      row?.actor_display,
      row?.staff_name,
      meta?.actor_name,
      meta?.actor_display,
      meta?.staff_name,
      meta?.requested_by_name,
      meta?.closed_by_name,
      meta?.claimed_by_name,
      meta?.assigned_to_name
    ),
    actorId ? `User ${actorId}` : "",
    "System"
  );

  const targetName = firstNonEmpty(
    resolvedTargetName,
    firstNonEmptyCleanIdentity(
      row?.target_name,
      row?.username,
      row?.member_name,
      meta?.target_name,
      meta?.username,
      meta?.member_name,
      meta?.owner_name,
      meta?.requester_display_name,
      meta?.requester_username
    ),
    targetId ? `User ${targetId}` : ""
  );

  const sameIdentity =
    (actorId && targetId && actorId === targetId) ||
    (normalizeString(actorName) &&
      normalizeString(targetName) &&
      normalizeString(actorName).toLowerCase() ===
        normalizeString(targetName).toLowerCase());

  const actorAvatarUrl = getBestAvatarUrl(
    row?.actor_avatar_url,
    row?.actorAvatarUrl,
    row?.avatar_url,
    row?.avatarUrl,
    meta?.actor_avatar_url,
    meta?.actorAvatarUrl,
    meta?.avatar_url,
    meta?.avatarUrl,
    actorResolved?.member?.avatar_url,
    sameIdentity ? row?.target_avatar_url : "",
    sameIdentity ? row?.targetAvatarUrl : "",
    sameIdentity ? meta?.target_avatar_url : "",
    sameIdentity ? meta?.targetAvatarUrl : "",
    sameIdentity ? targetResolved?.member?.avatar_url : ""
  );

  const targetAvatarUrl = getBestAvatarUrl(
    row?.target_avatar_url,
    row?.targetAvatarUrl,
    meta?.target_avatar_url,
    meta?.targetAvatarUrl,
    targetResolved?.member?.avatar_url,
    sameIdentity ? actorResolved?.member?.avatar_url : ""
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
    actor_display_name: resolvedActorName || actorName || null,
    actor_avatar_url: actorAvatarUrl || null,

    target_user_id: targetId || null,
    target_name: targetName || null,
    target_display_name: resolvedTargetName || targetName || null,
    target_avatar_url: targetAvatarUrl || null,

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
    .sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at))
    .slice(0, limit);
}

function buildSupportPayload({ roles, voiceChannels, debugInfo = null }) {
  return {
    roles,
    voiceChannels,
    supportOnly: true,
    debug: debugEnabled() ? debugInfo : undefined,
  };
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
  if (
    roleState &&
    roleState !== "unverified_only" &&
    roleState !== "missing_verified_role" &&
    roleState !== "unknown"
  ) {
    return false;
  }

  return true;
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

async function loadRowsByChunk({
  ids,
  size = 150,
  loader,
}) {
  const chunks = chunkArray(ids, size);
  if (!chunks.length) return [];

  const results = await Promise.all(
    chunks.map((chunk) => loader(chunk))
  );

  return results.flat();
}

function buildFlagsByUser(rows) {
  const map = new Map();

  for (const row of safeArray(rows)) {
    const userId = normalizeString(row?.user_id);
    if (!userId) continue;

    if (!map.has(userId)) {
      map.set(userId, []);
    }

    map.get(userId).push({
      id: row?.id || null,
      user_id: userId,
      score: normalizeNumber(row?.score, 0),
      flagged: Boolean(row?.flagged),
      reasons: Array.isArray(row?.reasons) ? row.reasons : [],
      created_at: row?.created_at || null,
    });
  }

  return map;
}

function buildMemberEventsByUser(rows) {
  const map = new Map();

  for (const row of safeArray(rows)) {
    const userId = normalizeString(row?.user_id);
    if (!userId) continue;

    if (!map.has(userId)) {
      map.set(userId, []);
    }

    map.get(userId).push({
      id: row?.id || null,
      user_id: userId,
      event_type: normalizeString(row?.event_type).toLowerCase(),
      title: row?.title || "",
      reason: row?.reason || "",
      created_at: row?.created_at || null,
      metadata: safeObject(row?.metadata),
    });
  }

  return map;
}

function buildNotesByTicket(rows) {
  const map = new Map();

  for (const row of safeArray(rows)) {
    const ticketId = normalizeString(row?.ticket_id);
    if (!ticketId) continue;

    if (!map.has(ticketId)) {
      map.set(ticketId, []);
    }

    map.get(ticketId).push({
      id: row?.id || null,
      ticket_id: ticketId,
      staff_id: row?.staff_id || row?.author_id || null,
      staff_name: row?.staff_name || row?.author_name || null,
      content: row?.content || row?.note_body || "",
      created_at: row?.created_at || null,
      updated_at: row?.updated_at || null,
      is_pinned: Boolean(row?.is_pinned),
    });
  }

  return map;
}

function buildMessagesByTicket(rows) {
  const map = new Map();

  for (const row of safeArray(rows)) {
    const ticketId = normalizeString(row?.ticket_id);
    if (!ticketId) continue;

    if (!map.has(ticketId)) {
      map.set(ticketId, []);
    }

    map.get(ticketId).push({
      id: row?.id || null,
      ticket_id: ticketId,
      author_id: row?.author_id || null,
      author_name: row?.author_name || null,
      content: row?.content || "",
      message_type: normalizeString(row?.message_type).toLowerCase() || "staff",
      created_at: row?.created_at || null,
      source: row?.source || null,
      attachments: safeArray(row?.attachments),
    });
  }

  return map;
}

function buildActivityByTicket(rows) {
  const map = new Map();

  for (const row of safeArray(rows)) {
    const ticketId = normalizeString(row?.ticket_id);
    if (!ticketId) continue;

    if (!map.has(ticketId)) {
      map.set(ticketId, []);
    }

    map.get(ticketId).push(row);
  }

  return map;
}

function buildTicketStatsByUser(tickets) {
  const map = new Map();

  for (const ticket of safeArray(tickets)) {
    const userId = normalizeString(ticket?.user_id);
    if (!userId) continue;

    if (!map.has(userId)) {
      map.set(userId, {
        total: 0,
        active: 0,
        closed: 0,
        deleted: 0,
        latest_ticket_at: null,
      });
    }

    const row = map.get(userId);
    row.total += 1;

    const status = normalizeStatus(ticket?.status);
    if (status === "open" || status === "claimed") row.active += 1;
    if (status === "closed") row.closed += 1;
    if (status === "deleted") row.deleted += 1;

    const candidateTime =
      ticket?.updated_at || ticket?.created_at || ticket?.closed_at || null;

    if (
      candidateTime &&
      (!row.latest_ticket_at ||
        parseDateMs(candidateTime) > parseDateMs(row.latest_ticket_at))
    ) {
      row.latest_ticket_at = candidateTime;
    }
  }

  return map;
}

function deriveModerationCount(memberEvents = []) {
  const moderationTypes = new Set([
    "warn",
    "warning",
    "kick",
    "ban",
    "timeout",
    "deny",
    "denial",
    "appeal_denied",
    "verification_denied",
  ]);

  return safeArray(memberEvents).filter((row) => {
    const type = normalizeString(row?.event_type).toLowerCase();
    if (moderationTypes.has(type)) return true;

    const haystack = `${row?.title || ""} ${row?.reason || ""}`.toLowerCase();
    return /(warn|kick|ban|timeout|denied|deny|rejected|reject)/.test(haystack);
  }).length;
}

function deriveVerificationLabel({
  member,
  flagRows,
  ticket,
}) {
  const status = normalizeStatus(ticket?.status);

  if (member?.has_staff_role) return "Staff";
  if (member?.has_verified_role || member?.has_secondary_verified_role) return "Verified";
  if (safeArray(flagRows).some((row) => row?.flagged)) return "Needs Review";
  if (ticket?.matched_intake_type === "verification" || member?.has_unverified) {
    if (status === "closed" || status === "deleted") {
      return "Verification History";
    }
    return "Pending Verification";
  }

  return "Unknown";
}

function deriveSla(ticket) {
  const now = Date.now();
  const deadlineMs = parseDateMs(ticket?.sla_deadline);
  const createdMs = parseDateMs(ticket?.created_at);
  const updatedMs = parseDateMs(ticket?.updated_at);
  const basisMs = Math.max(updatedMs, createdMs);
  const ageMinutes = basisMs ? Math.max(0, Math.floor((now - basisMs) / 60000)) : 0;
  const status = normalizeStatus(ticket?.status);
  const priority = normalizeStatus(ticket?.priority || "medium");

  let overdue = false;
  let minutesOverdue = 0;
  let minutesUntilDeadline = null;
  let slaStatus = "no_deadline";

  if (deadlineMs) {
    const diffMinutes = Math.floor((deadlineMs - now) / 60000);
    if (diffMinutes < 0 && !isClosedLikeStatus(status)) {
      overdue = true;
      minutesOverdue = Math.abs(diffMinutes);
      slaStatus = "overdue";
    } else if (!isClosedLikeStatus(status)) {
      minutesUntilDeadline = diffMinutes;
      slaStatus = "counting_down";
    } else {
      slaStatus = "closed";
    }
  } else {
    const softThreshold =
      priority === "urgent"
        ? 30
        : priority === "high"
          ? 60
          : priority === "medium"
            ? 180
            : 360;

    if (!isClosedLikeStatus(status) && ageMinutes > softThreshold) {
      overdue = true;
      minutesOverdue = ageMinutes - softThreshold;
      slaStatus = "overdue_soft";
    } else if (!isClosedLikeStatus(status)) {
      slaStatus = "open";
    } else {
      slaStatus = "closed";
    }
  }

  return {
    deadline_at: ticket?.sla_deadline || null,
    overdue,
    minutes_overdue: minutesOverdue,
    minutes_until_deadline: minutesUntilDeadline,
    age_minutes: ageMinutes,
    status: slaStatus,
  };
}

function deriveRiskLevel({
  member,
  flagRows,
  moderationCount,
  userTicketStats,
  sla,
  ticket,
}) {
  const flaggedCount = safeArray(flagRows).filter((row) => row?.flagged).length;
  const maxScore = Math.max(
    0,
    ...safeArray(flagRows).map((row) => normalizeNumber(row?.score, 0))
  );
  const activeCount = normalizeNumber(userTicketStats?.active, 0);
  const totalCount = normalizeNumber(userTicketStats?.total, 0);
  const priority = normalizeStatus(ticket?.priority || "medium");

  if (
    sla?.overdue ||
    priority === "urgent" ||
    flaggedCount > 0 ||
    maxScore >= 5 ||
    moderationCount >= 3 ||
    normalizeString(member?.role_state).includes("conflict")
  ) {
    return "high";
  }

  if (
    priority === "high" ||
    maxScore >= 2 ||
    moderationCount >= 1 ||
    activeCount >= 2 ||
    totalCount >= 4
  ) {
    return "medium";
  }

  return "low";
}

function buildRecommendedActions({
  ticket,
  member,
  flagRows,
  moderationCount,
  noteCount,
  sla,
  userTicketStats,
}) {
  const actions = [];

  if (!normalizeString(ticket?.assigned_to) && !normalizeString(ticket?.claimed_by)) {
    actions.push("Claim this ticket.");
  }

  if (sla?.overdue) {
    actions.push("Respond now — this ticket is overdue.");
  }

  if (safeArray(flagRows).some((row) => row?.flagged)) {
    actions.push("Review verification flags before deciding.");
  }

  if (normalizeString(member?.role_state).includes("conflict")) {
    actions.push("Check member role-state conflict.");
  }

  if ((ticket?.matched_intake_type || ticket?.category) === "verification" || member?.has_unverified) {
    actions.push("Confirm verification path and final role state.");
  }

  if (noteCount <= 0) {
    actions.push("Add an internal note for staff continuity.");
  }

  if (moderationCount > 0) {
    actions.push("Review prior moderation history.");
  }

  if (normalizeNumber(userTicketStats?.total, 0) >= 3) {
    actions.push("Check prior ticket history before replying.");
  }

  return uniqueBy(actions, (value) => value).slice(0, 6);
}

function buildOwnerContext(member, ticket) {
  return {
    owner_user_id: member?.user_id || ticket?.user_id || null,
    owner_username: member?.username || ticket?.username || null,
    owner_display_name:
      member?.display_name ||
      member?.nickname ||
      member?.username ||
      ticket?.username ||
      ticket?.user_id ||
      "Unknown Member",
    owner_avatar_url: member?.avatar_url || null,
    owner_role_state: member?.role_state || "unknown",
    owner_role_state_reason: member?.role_state_reason || null,
    owner_top_role: member?.top_role || member?.highest_role_name || null,
    owner_entry_method: member?.entry_method || null,
    owner_verification_source: member?.verification_source || null,
    owner_entry_reason: member?.entry_reason || null,
    owner_approval_reason: member?.approval_reason || null,
    owner_invited_by: member?.invited_by || null,
    owner_invited_by_name: member?.invited_by_name || null,
    owner_invite_code: member?.invite_code || null,
    owner_vouched_by: member?.vouched_by || null,
    owner_vouched_by_name: member?.vouched_by_name || null,
    owner_approved_by: member?.approved_by || null,
    owner_approved_by_name: member?.approved_by_name || null,
  };
}

function buildTicketWorkspace({
  ticket,
  member,
  flagRows,
  memberEvents,
  notes,
  messages,
  activities,
  userTicketStats,
}) {
  const sortedNotes = [...safeArray(notes)].sort(
    (a, b) =>
      parseDateMs(b?.updated_at || b?.created_at) -
      parseDateMs(a?.updated_at || a?.created_at)
  );

  const sortedMessages = [...safeArray(messages)].sort(
    (a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at)
  );

  const sortedActivities = [...safeArray(activities)].sort(
    (a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at)
  );

  const latestNote = sortedNotes[0] || null;
  const latestMessage = sortedMessages[0] || null;
  const latestActivity = sortedActivities[0] || null;

  const latestActivityAt =
    latestActivity?.created_at ||
    latestMessage?.created_at ||
    latestNote?.updated_at ||
    latestNote?.created_at ||
    ticket?.updated_at ||
    ticket?.created_at ||
    null;

  const noteCount = sortedNotes.length;
  const messageCount = sortedMessages.length;
  const activityCount = sortedActivities.length;
  const flaggedCount = safeArray(flagRows).filter((row) => row?.flagged).length;
  const maxFlagScore = Math.max(
    0,
    ...safeArray(flagRows).map((row) => normalizeNumber(row?.score, 0))
  );
  const moderationCount = deriveModerationCount(memberEvents);
  const sla = deriveSla(ticket);

  const verificationLabel = deriveVerificationLabel({
    member,
    flagRows,
    ticket,
  });

  const riskLevel = deriveRiskLevel({
    member,
    flagRows,
    moderationCount,
    userTicketStats,
    sla,
    ticket,
  });

  const recommendedActions = buildRecommendedActions({
    ticket,
    member,
    flagRows,
    moderationCount,
    noteCount,
    sla,
    userTicketStats,
  });

  return {
    note_count: noteCount,
    latest_note_at: latestNote?.updated_at || latestNote?.created_at || null,
    latest_note_preview: latestNote?.content ? truncateText(latestNote.content, 120) : "",
    message_count: messageCount,
    latest_message_at: latestMessage?.created_at || null,
    latest_message_preview: latestMessage?.content ? truncateText(latestMessage.content, 120) : "",
    activity_count: activityCount,
    latest_activity_at: latestActivityAt,
    latest_activity_title:
      latestActivity?.title ||
      latestActivity?.event_type ||
      latestMessage?.message_type ||
      null,
    flagged_count: flaggedCount,
    flag_max_score: maxFlagScore,
    moderation_count: moderationCount,
    prior_ticket_total: normalizeNumber(userTicketStats?.total, 0),
    prior_active_ticket_total: normalizeNumber(userTicketStats?.active, 0),
    verification_label: verificationLabel,
    risk_level: riskLevel,
    recommended_actions: recommendedActions,
    sla,
  };
}

function enrichTicketForDashboard({
  ticket,
  member,
  workspace,
  claimedStaff,
}) {
  const ownerContext = buildOwnerContext(member, ticket);

  const cleanClaimedByName = !looksLikeDiscordId(ticket?.claimed_by_name)
    ? normalizeString(ticket?.claimed_by_name)
    : "";

  const cleanAssignedToName = !looksLikeDiscordId(ticket?.assigned_to_name)
    ? normalizeString(ticket?.assigned_to_name)
    : "";

  const cleanClaimedByText =
    !looksLikeDiscordId(ticket?.claimed_by) ? normalizeString(ticket?.claimed_by) : "";

  const cleanAssignedToText =
    !looksLikeDiscordId(ticket?.assigned_to) ? normalizeString(ticket?.assigned_to) : "";

  const claimedById = firstNonEmpty(
    ticket?.claimed_by_id,
    claimedStaff?.id,
    looksLikeDiscordId(ticket?.claimed_by) ? ticket?.claimed_by : "",
    looksLikeDiscordId(ticket?.assigned_to) ? ticket?.assigned_to : ""
  );

  const claimedByName = firstNonEmpty(
    cleanClaimedByName,
    cleanAssignedToName,
    claimedStaff?.name,
    cleanClaimedByText,
    cleanAssignedToText,
    claimedById ? "Unknown Staff" : "Unclaimed"
  );

  const assignedToId = firstNonEmpty(
    ticket?.assigned_to_id,
    claimedStaff?.id,
    looksLikeDiscordId(ticket?.assigned_to) ? ticket?.assigned_to : ""
  );

  const assignedToName = firstNonEmpty(
    cleanAssignedToName,
    cleanClaimedByName,
    claimedStaff?.name,
    cleanAssignedToText,
    cleanClaimedByText
  );

  return {
    ...ticket,
    ...ownerContext,

    claimed_by_id: claimedById || null,
    claimed_by_name: claimedByName || "Unclaimed",
    claimed_by_avatar_url: claimedStaff?.avatar_url || null,

    assigned_to_id: assignedToId || null,
    assigned_to_name: assignedToName || null,
    assigned_to_avatar_url: claimedStaff?.avatar_url || null,

    owner_verification_label: workspace.verification_label,
    note_count: workspace.note_count,
    latest_note_at: workspace.latest_note_at,
    latest_note_preview: workspace.latest_note_preview,
    message_count: workspace.message_count,
    latest_message_at: workspace.latest_message_at,
    latest_message_preview: workspace.latest_message_preview,
    activity_count: workspace.activity_count,
    latest_activity_at: workspace.latest_activity_at,
    latest_activity_title: workspace.latest_activity_title,
    flagged_count: workspace.flagged_count,
    flag_max_score: workspace.flag_max_score,
    moderation_count: workspace.moderation_count,
    prior_ticket_total: workspace.prior_ticket_total,
    prior_active_ticket_total: workspace.prior_active_ticket_total,
    risk_level: workspace.risk_level,
    recommended_actions: workspace.recommended_actions,
    overdue: workspace.sla?.overdue || false,
    sla_status: workspace.sla?.status || "no_deadline",
    age_minutes: workspace.sla?.age_minutes || 0,
    minutes_overdue: workspace.sla?.minutes_overdue || 0,
    minutes_until_deadline: workspace.sla?.minutes_until_deadline ?? null,
    workspace: {
      verification_label: workspace.verification_label,
      risk_level: workspace.risk_level,
      note_count: workspace.note_count,
      message_count: workspace.message_count,
      activity_count: workspace.activity_count,
      latest_activity_at: workspace.latest_activity_at,
      latest_activity_title: workspace.latest_activity_title,
      flagged_count: workspace.flagged_count,
      flag_max_score: workspace.flag_max_score,
      moderation_count: workspace.moderation_count,
      prior_ticket_total: workspace.prior_ticket_total,
      prior_active_ticket_total: workspace.prior_active_ticket_total,
      recommended_actions: workspace.recommended_actions,
      sla: workspace.sla,
    },
  };
}

function buildIntelligence({ counts, memberCounts, fraud, guildMembers, activeTickets = [] }) {
  const openTickets = Number(counts?.openTickets || 0);
  const warnsToday = Number(counts?.warnsToday || 0);
  const raidAlerts = Number(counts?.raidAlerts || 0);
  const fraudFlags = Number(counts?.fraudFlags || 0);
  const pendingVerification = Number(memberCounts?.pendingVerification || 0);
  const verified = Number(memberCounts?.verified || 0);
  const active = Number(memberCounts?.active || 0);
  const overdueTickets = safeArray(activeTickets).filter((t) => t?.overdue).length;
  const highRiskTickets = safeArray(activeTickets).filter(
    (t) => normalizeString(t?.risk_level).toLowerCase() === "high"
  ).length;

  let serverHealth = "Stable";
  if (fraudFlags >= 4 || raidAlerts >= 2 || openTickets >= 14 || overdueTickets >= 5) {
    serverHealth = "Elevated";
  }
  if (fraudFlags >= 8 || raidAlerts >= 4 || openTickets >= 24 || overdueTickets >= 10) {
    serverHealth = "Critical";
  }

  let raidRisk = "Low";
  let raidReason = "No recent raid alert threshold was crossed.";
  if (raidAlerts >= 1) {
    raidRisk = "Moderate";
    raidReason = `${raidAlerts} recent raid alert(s) were recorded.`;
  }
  if (raidAlerts >= 3) {
    raidRisk = "High";
    raidReason = `${raidAlerts} raid alerts were recorded recently and need immediate review.`;
  }

  let fraudRisk = "Low";
  let fraudReason = "No active fraud flags are currently driving the score.";
  if (fraudFlags >= 1 || pendingVerification >= 12 || highRiskTickets >= 3) {
    fraudRisk = "Moderate";
    fraudReason =
      fraudFlags >= 1
        ? `${fraudFlags} active fraud flag(s) exist and should be reviewed.`
        : `Verification backlog or high-risk queue pressure is elevated.`;
  }
  if (fraudFlags >= 5 || highRiskTickets >= 8) {
    fraudRisk = "High";
    fraudReason = `${fraudFlags} fraud flag(s) or ${highRiskTickets} high-risk tickets are unresolved.`;
  }

  let ticketPressure = "Low";
  let ticketReason = "Ticket load is within normal range.";
  if (openTickets >= 6 || overdueTickets >= 2) {
    ticketPressure = "Moderate";
    ticketReason = `${openTickets} active tickets with ${overdueTickets} overdue.`;
  }
  if (openTickets >= 14 || overdueTickets >= 5) {
    ticketPressure = "High";
    ticketReason = `${openTickets} active tickets are creating heavy staff load.`;
  }

  let verificationPressure = "Low";
  let verificationReason = "Verification queue is under control.";
  if (pendingVerification >= 8) {
    verificationPressure = "Moderate";
    verificationReason = `${pendingVerification} members are currently pending verification.`;
  }
  if (pendingVerification >= 16) {
    verificationPressure = "High";
    verificationReason = `${pendingVerification} members are pending verification and need direct staff cleanup.`;
  }

  const verifiedRate = active > 0 ? Math.round((verified / active) * 100) : 0;

  const topFraudMembers = safeArray(fraud)
    .slice(0, 5)
    .map((row) => ({
      user_id: row?.user_id || "",
      display_name:
        row?.display_name || row?.username || row?.user_id || "Unknown User",
      score: Number(row?.score || 0),
      reasons: Array.isArray(row?.reasons) ? row.reasons : [],
    }));

  const topConflictMembers = safeArray(guildMembers)
    .filter((member) => String(member?.role_state || "").includes("conflict"))
    .slice(0, 5)
    .map((member) => ({
      user_id: member?.user_id || "",
      display_name:
        member?.display_name ||
        member?.nickname ||
        member?.username ||
        member?.user_id ||
        "Unknown User",
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
          : "Health is elevated by ticket load, overdue queue pressure, fraud signals, or raid activity.",
      raidRiskReason: raidReason,
      fraudRiskReason: fraudReason,
      ticketPressureReason: ticketReason,
      verificationPressureReason: verificationReason,
    },
    topFraudMembers,
    topConflictMembers,
  };
}

async function loadOptionalTableByIds({
  ids,
  loader,
  dedupeKey,
  size = 150,
}) {
  const rows = await loadRowsByChunk({
    ids,
    size,
    loader,
  });

  return uniqueBy(rows, dedupeKey);
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
    const activityLimit = clampActivityLimit(
      url.searchParams.get("activity_limit"),
      500,
      5000
    );

    if (!guildId) {
      return Response.json(
        { error: "Missing guild id." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    if (debugEnabled()) {
      console.log("[dashboard/live] guildId =", guildId);
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
        {
          status: 500,
          headers: { "Cache-Control": "no-store, max-age=0" },
        }
      );
    }

    const categoryRows = safeArray(categoriesRes.data || []);
    const mappedTickets = safeArray(ticketsRes.data).map(mapTicket);
    const rawTickets = mappedTickets.map((ticket) =>
      enrichTicketWithMatchedCategory(ticket, categoryRows)
    );
    const canonicalTicketsBase = canonicalizeTickets(rawTickets);

    const categories = categoryRows;
    const memberJoins = safeArray(memberJoinsRes.data || []);
    const recentActiveMembers = safeArray(recentActiveMembersRes.data).map(mapGuildMember);
    const recentFormerMembers = safeArray(recentFormerMembersRes.data).map(mapGuildMember);
    const guildMembers = safeArray(allGuildMembersRes.data).map(mapGuildMember);
    const activityFeedRows = safeArray(activityFeedRes.data || []);

    const pendingVerificationMembersRaw = safeArray(
      pendingVerificationRowsRes.data || []
    );

    const pendingVerificationMembers = pendingVerificationMembersRaw
      .map(mapGuildMember)
      .filter(isPendingVerificationMember)
      .sort(
        (a, b) =>
          parseDateMs(b.updated_at || b.last_seen_at || b.joined_at) -
          parseDateMs(a.updated_at || a.last_seen_at || a.joined_at)
      );

    const ownerUserIds = uniqueBy(
      canonicalTicketsBase
        .map((ticket) => normalizeString(ticket?.user_id))
        .filter(Boolean),
      (id) => id
    );

    const canonicalTicketIds = uniqueBy(
      canonicalTicketsBase
        .map((ticket) => normalizeString(ticket?.id))
        .filter(Boolean),
      (id) => id
    );

    const [
      verificationFlagRows,
      memberEventRows,
      ticketNotesRows,
      ticketMessageRows,
      ticketActivityRows,
    ] = await Promise.all([
      loadOptionalTableByIds({
        ids: ownerUserIds,
        loader: (chunk) =>
          safeSupabaseRows(() =>
            supabase
              .from("verification_flags")
              .select("*")
              .eq("guild_id", guildId)
              .in("user_id", chunk)
              .order("created_at", { ascending: false })
              .limit(1000)
          ),
        dedupeKey: (row) => row?.id || `${row?.user_id}:${row?.created_at}:${row?.score}`,
      }),

      loadOptionalTableByIds({
        ids: ownerUserIds,
        loader: (chunk) =>
          safeSupabaseRows(() =>
            supabase
              .from("member_events")
              .select("*")
              .eq("guild_id", guildId)
              .in("user_id", chunk)
              .order("created_at", { ascending: false })
              .limit(1500)
          ),
        dedupeKey: (row) => row?.id || `${row?.user_id}:${row?.event_type}:${row?.created_at}`,
      }),

      loadOptionalTableByIds({
        ids: canonicalTicketIds,
        loader: (chunk) =>
          safeSupabaseRows(() =>
            supabase
              .from("ticket_notes")
              .select("*")
              .in("ticket_id", chunk)
              .order("created_at", { ascending: false })
              .limit(1500)
          ),
        dedupeKey: (row) => row?.id || `${row?.ticket_id}:${row?.created_at}:${row?.staff_id}`,
      }),

      loadOptionalTableByIds({
        ids: canonicalTicketIds,
        loader: (chunk) =>
          safeSupabaseRows(() =>
            supabase
              .from("ticket_messages")
              .select("*")
              .in("ticket_id", chunk)
              .order("created_at", { ascending: false })
              .limit(2500)
          ),
        dedupeKey: (row) => row?.id || `${row?.ticket_id}:${row?.created_at}:${row?.author_id}`,
      }),

      loadOptionalTableByIds({
        ids: canonicalTicketIds,
        loader: (chunk) =>
          safeSupabaseRows(() =>
            supabase
              .from("activity_feed_events")
              .select("*")
              .eq("guild_id", guildId)
              .in("ticket_id", chunk)
              .order("created_at", { ascending: false })
              .limit(2500)
          ),
        dedupeKey: (row) => row?.id || `${row?.ticket_id}:${row?.created_at}:${row?.event_type}`,
      }),
    ]);

    const flagsByUser = buildFlagsByUser(verificationFlagRows);
    const memberEventsByUser = buildMemberEventsByUser(memberEventRows);
    const notesByTicket = buildNotesByTicket(ticketNotesRows);
    const messagesByTicket = buildMessagesByTicket(ticketMessageRows);
    const activityByTicket = buildActivityByTicket(ticketActivityRows);
    const ticketStatsByUser = buildTicketStatsByUser(canonicalTicketsBase);

    const memberLookup = new Map(guildMembers.map((member) => [String(member.user_id), member]));
    const memberMaps = buildMemberIdentityMaps(guildMembers);

    const canonicalTickets = canonicalTicketsBase.map((ticket) => {
      const userId = normalizeString(ticket?.user_id);
      const member = memberLookup.get(userId) || null;
      const flagRows = flagsByUser.get(userId) || [];
      const userEvents = memberEventsByUser.get(userId) || [];
      const notes = notesByTicket.get(normalizeString(ticket?.id)) || [];
      const messages = messagesByTicket.get(normalizeString(ticket?.id)) || [];
      const activities = activityByTicket.get(normalizeString(ticket?.id)) || [];
      const userTicketStats = ticketStatsByUser.get(userId) || {
        total: 0,
        active: 0,
        closed: 0,
        deleted: 0,
        latest_ticket_at: null,
      };

      const claimedStaff = resolveStaffContext({
        memberMaps,
        idCandidates: [
          ticket?.claimed_by_id,
          ticket?.assigned_to_id,
          looksLikeDiscordId(ticket?.claimed_by) ? ticket?.claimed_by : "",
          looksLikeDiscordId(ticket?.assigned_to) ? ticket?.assigned_to : "",
        ],
        nameCandidates: [
          !looksLikeDiscordId(ticket?.claimed_by_name) ? ticket?.claimed_by_name : "",
          !looksLikeDiscordId(ticket?.assigned_to_name) ? ticket?.assigned_to_name : "",
          !looksLikeDiscordId(ticket?.claimed_by) ? ticket?.claimed_by : "",
          !looksLikeDiscordId(ticket?.assigned_to) ? ticket?.assigned_to : "",
        ],
      });

      const workspace = buildTicketWorkspace({
        ticket,
        member,
        flagRows,
        memberEvents: userEvents,
        notes,
        messages,
        activities,
        userTicketStats,
      });

      return enrichTicketForDashboard({
        ticket,
        member,
        workspace,
        claimedStaff,
      });
    });

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
            parseDateMs(b.joined_at || b.created_at) -
            parseDateMs(a.joined_at || a.created_at)
        )
        .slice(0, 25);
    }

    if (!recentJoins.length) {
      recentJoins = recentActiveMembers
        .slice()
        .sort(
          (a, b) =>
            parseDateMs(b.joined_at || b.created_at) -
            parseDateMs(a.joined_at || a.created_at)
        )
        .slice(0, 25);
    }

    const memberRows = guildMembers
      .slice()
      .sort(
        (a, b) =>
          parseDateMs(b.updated_at || b.last_seen_at || b.joined_at) -
          parseDateMs(a.updated_at || a.last_seen_at || a.joined_at)
      );

    const metrics = uniqueBy(
      safeArray(metricsRes.data || []).map((row) => ({
        ...row,
        staff_id: row?.staff_id || null,
        staff_name: row?.staff_name || row?.staff_id || "Unknown Staff",
        tickets_handled: normalizeNumber(row?.tickets_handled, 0),
        approvals: normalizeNumber(row?.approvals, 0),
        denials: normalizeNumber(row?.denials, 0),
        avg_response_minutes: normalizeNumber(row?.avg_response_minutes, 0),
        last_active: row?.last_active || null,
      })),
      (row) => row?.id || row?.staff_id || row?.staff_name
    ).sort((a, b) => {
      const handledDiff = normalizeNumber(b?.tickets_handled, 0) - normalizeNumber(a?.tickets_handled, 0);
      if (handledDiff !== 0) return handledDiff;
      return normalizeString(a?.staff_name).localeCompare(normalizeString(b?.staff_name));
    });

    const counts = {
      openTickets: activeTickets.length,
      closedTickets: closedTickets.length,
      warnsToday: warnsTodayRes.count || 0,
      raidAlerts: raidAlertsRes.count || 0,
      fraudFlags: fraudFlagsRes.count || 0,
    };

    const memberCounts = {
      tracked: (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
      active: activeMembersCountRes.count || 0,
      former: formerMembersCountRes.count || 0,
      pendingVerification: pendingVerificationMembers.length,
      verified: verifiedMembersCountRes.count || 0,
      staff: staffMembersCountRes.count || 0,
    };

    const intelligence = buildIntelligence({
      counts,
      memberCounts,
      fraud,
      guildMembers,
      activeTickets,
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
      console.log("[dashboard/live] verificationFlagRows =", verificationFlagRows.length);
      console.log("[dashboard/live] memberEventRows =", memberEventRows.length);
      console.log("[dashboard/live] ticketNotesRows =", ticketNotesRows.length);
      console.log("[dashboard/live] ticketMessageRows =", ticketMessageRows.length);
      console.log("[dashboard/live] ticketActivityRows =", ticketActivityRows.length);
      console.log("[dashboard/live] voiceChannels found =", voiceChannels.length);
      if (discordChannelsResult?.__discord_error) {
        console.warn(
          "[dashboard/live] voice channel fetch warning =",
          discordChannelsResult.__discord_error
        );
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
      pendingVerificationMembersRaw,
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
            pendingVerificationMembersCount: pendingVerificationMembers.length,
            recentJoinsCount: recentJoins.length,
            memberJoinsCount: memberJoins.length,
            verificationFlagRowsCount: verificationFlagRows.length,
            memberEventRowsCount: memberEventRows.length,
            ticketNotesRowsCount: ticketNotesRows.length,
            ticketMessageRowsCount: ticketMessageRows.length,
            ticketActivityRowsCount: ticketActivityRows.length,
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
