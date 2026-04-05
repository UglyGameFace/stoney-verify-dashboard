function normalizeText(value) {
  return String(value || "").trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(toArray(values).map((value) => normalizeText(value)).filter(Boolean))];
}

function safeMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function buildTicketIdFilter(ticketIds = []) {
  const ids = uniqueStrings(ticketIds);
  if (!ids.length) return "";
  return ids.map((id) => `ticket_id.eq.${id}`).join(",");
}

function sanitizeActivityRow(row, fallbackSource) {
  const metadata = safeMetadata(row?.metadata);
  const title =
    normalizeText(row?.title) ||
    normalizeText(metadata?.title) ||
    normalizeText(metadata?.label) ||
    normalizeText(row?.event_type) ||
    normalizeText(row?.event_family) ||
    "Activity";

  const description =
    normalizeText(row?.description) ||
    normalizeText(row?.reason) ||
    normalizeText(metadata?.summary) ||
    normalizeText(metadata?.description) ||
    "";

  return {
    id: row?.id || `${fallbackSource}:${normalizeText(row?.created_at) || Date.now()}`,
    source: normalizeText(fallbackSource || row?.source || "system") || "system",
    event_family: normalizeText(row?.event_family || metadata?.event_family || "ticket") || "ticket",
    event_type:
      normalizeText(row?.event_type || metadata?.event_type || row?.action || "update") || "update",
    title,
    description,
    created_at: row?.created_at || null,
    actor_user_id:
      normalizeText(row?.actor_user_id || row?.actor_id || metadata?.actor_user_id || metadata?.actor_id) || null,
    actor_name:
      normalizeText(row?.actor_name || metadata?.actor_name || metadata?.actor_display) || null,
    target_user_id:
      normalizeText(row?.target_user_id || row?.user_id || metadata?.target_user_id || metadata?.user_id) || null,
    target_name:
      normalizeText(row?.target_name || metadata?.target_name || metadata?.username) || null,
    ticket_id:
      normalizeText(row?.ticket_id || row?.related_id || metadata?.ticket_id || metadata?.related_id) || null,
    channel_id:
      normalizeText(row?.channel_id || metadata?.channel_id || metadata?.discord_thread_id) || null,
    channel_name:
      normalizeText(row?.channel_name || metadata?.channel_name) || null,
    reason: normalizeText(row?.reason || metadata?.reason) || null,
    metadata,
  };
}

async function loadActivityFeedEvents(supabase, { guildId, userId, ticketIds = [], limit = 20 }) {
  try {
    const orFilters = [
      `target_user_id.eq.${userId}`,
      `actor_user_id.eq.${userId}`,
    ];

    const ticketFilter = buildTicketIdFilter(ticketIds);
    if (ticketFilter) {
      orFilters.push(ticketFilter);
    }

    const { data, error } = await supabase
      .from("activity_feed_events")
      .select("*")
      .eq("guild_id", guildId)
      .or(orFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return toArray(data).map((row) => sanitizeActivityRow(row, "activity_feed_events"));
  } catch {
    return [];
  }
}

async function loadMemberEvents(supabase, { guildId, userId, limit = 20 }) {
  try {
    const { data, error } = await supabase
      .from("member_events")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return toArray(data).map((row) => sanitizeActivityRow(row, "member_events"));
  } catch {
    return [];
  }
}

async function loadStaffActionLogs(supabase, { guildId, userId, limit = 20 }) {
  try {
    const { data, error } = await supabase
      .from("staff_action_logs")
      .select("*")
      .eq("guild_id", guildId)
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return toArray(data).map((row) =>
      sanitizeActivityRow(
        {
          ...row,
          event_family: "moderation",
          event_type: row?.action || "staff_action",
          title: row?.action || "Staff Action",
          description: row?.reason || "",
          actor_user_id: row?.actor_id,
          actor_name: row?.actor_display,
          target_user_id: row?.target_id,
          target_name: row?.target_display,
          metadata: safeMetadata(row?.metadata),
        },
        "staff_action_logs"
      )
    );
  } catch {
    return [];
  }
}

export async function fetchRecentTicketEventsForUser(
  supabase,
  { guildId, userId, ticketIds = [], limit = 20 } = {}
) {
  const cleanGuildId = normalizeText(guildId);
  const cleanUserId = normalizeText(userId);
  const cleanLimit = Math.max(1, Math.min(Number(limit) || 20, 50));

  if (!supabase || !cleanGuildId || !cleanUserId) {
    return [];
  }

  const [feedEvents, memberEvents, staffActions] = await Promise.all([
    loadActivityFeedEvents(supabase, {
      guildId: cleanGuildId,
      userId: cleanUserId,
      ticketIds,
      limit: cleanLimit,
    }),
    loadMemberEvents(supabase, {
      guildId: cleanGuildId,
      userId: cleanUserId,
      limit: Math.min(cleanLimit, 12),
    }),
    loadStaffActionLogs(supabase, {
      guildId: cleanGuildId,
      userId: cleanUserId,
      limit: Math.min(cleanLimit, 8),
    }),
  ]);

  const merged = [...feedEvents, ...memberEvents, ...staffActions]
    .filter((row) => row && row.id)
    .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at));

  const seen = new Set();
  const deduped = [];

  for (const row of merged) {
    const key = `${row.source}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= cleanLimit) break;
  }

  return deduped;
}
