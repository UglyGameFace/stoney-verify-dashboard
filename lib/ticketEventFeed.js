function normalizeString(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeMetadata(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractIds(row, metadata) {
  return [
    normalizeString(row?.ticket_id),
    normalizeString(row?.source_ticket_id),
    normalizeString(row?.verification_ticket_id),
    normalizeString(metadata?.ticket_id),
    normalizeString(metadata?.source_ticket_id),
    normalizeString(metadata?.verification_ticket_id),
  ].filter(Boolean);
}

function formatTitle(eventType) {
  const clean = normalizeString(eventType).replace(/[_-]+/g, " ");
  if (!clean) return "Ticket Activity";
  return clean
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeEvent(row, source) {
  const metadata = safeMetadata(row?.metadata);
  const ids = extractIds(row, metadata);

  return {
    id: normalizeString(row?.id) || `${source}-${normalizeString(row?.created_at) || "event"}`,
    event_type:
      normalizeString(row?.event_type) ||
      normalizeString(row?.action) ||
      normalizeString(row?.type) ||
      "ticket_activity",
    title:
      normalizeString(row?.title) ||
      normalizeString(row?.label) ||
      formatTitle(
        normalizeString(row?.event_type) ||
          normalizeString(row?.action) ||
          normalizeString(row?.type)
      ),
    reason:
      normalizeString(row?.reason) ||
      normalizeString(row?.message) ||
      normalizeString(row?.description) ||
      "",
    actor_id:
      normalizeString(row?.actor_id) ||
      normalizeString(row?.staff_id) ||
      normalizeString(metadata?.actor_id) ||
      normalizeString(metadata?.staff_id) ||
      normalizeString(metadata?.approved_by) ||
      null,
    actor_name:
      normalizeString(row?.actor_name) ||
      normalizeString(row?.staff_name) ||
      normalizeString(metadata?.actor_name) ||
      normalizeString(metadata?.staff_name) ||
      normalizeString(metadata?.approved_by_name) ||
      null,
    user_id: normalizeString(row?.user_id) || normalizeString(metadata?.user_id) || null,
    guild_id: normalizeString(row?.guild_id) || normalizeString(metadata?.guild_id) || null,
    ticket_id: ids[0] || null,
    source_ticket_id: normalizeString(row?.source_ticket_id) || normalizeString(metadata?.source_ticket_id) || null,
    verification_ticket_id:
      normalizeString(row?.verification_ticket_id) || normalizeString(metadata?.verification_ticket_id) || null,
    created_at: row?.created_at || row?.updated_at || null,
    metadata,
    _source: source,
  };
}

function eventIds(event) {
  return [
    normalizeString(event?.ticket_id),
    normalizeString(event?.source_ticket_id),
    normalizeString(event?.verification_ticket_id),
    normalizeString(event?.metadata?.ticket_id),
    normalizeString(event?.metadata?.source_ticket_id),
    normalizeString(event?.metadata?.verification_ticket_id),
  ].filter(Boolean);
}

function looksTicketRelated(event) {
  const value = normalizeString(event?.event_type).toLowerCase();
  if (eventIds(event).length) return true;
  return [
    "ticket",
    "claim",
    "unclaim",
    "transfer",
    "priority",
    "macro",
    "note",
    "close",
    "reopen",
    "delete",
    "transcript",
    "verification_context",
  ].some((needle) => value.includes(needle));
}

function matchesAnyTicket(event, ticketIds) {
  const wanted = safeArray(ticketIds).map((item) => normalizeString(item)).filter(Boolean);
  if (!wanted.length) return true;
  const ids = eventIds(event);
  return wanted.some((id) => ids.includes(id));
}

async function readRows(supabase, tableName, guildId, userId, limit) {
  try {
    let query = supabase
      .from(tableName)
      .select("*")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tableName === "member_events" && normalizeString(userId)) {
      query = query.eq("user_id", normalizeString(userId));
    }

    const { data, error } = await query;
    if (error) return [];
    return safeArray(data);
  } catch {
    return [];
  }
}

function dedupe(events) {
  const seen = new Set();
  const out = [];

  for (const event of safeArray(events)) {
    const key = `${normalizeString(event?._source)}::${normalizeString(event?.id)}::${normalizeString(event?.created_at)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }

  return out;
}

export async function fetchRecentTicketEventsForUser(supabase, { guildId, userId, ticketIds = [], limit = 24 }) {
  const cleanGuildId = normalizeString(guildId);
  const cleanUserId = normalizeString(userId);
  const wantedTicketIds = safeArray(ticketIds).map((item) => normalizeString(item)).filter(Boolean);

  if (!cleanGuildId || !cleanUserId) return [];

  const windowSize = Math.max(limit * 4, 60);
  const [ticketRows, memberRows] = await Promise.all([
    readRows(supabase, "ticket_events", cleanGuildId, cleanUserId, windowSize),
    readRows(supabase, "member_events", cleanGuildId, cleanUserId, windowSize),
  ]);

  const ticketEvents = ticketRows
    .map((row) => normalizeEvent(row, "ticket_events"))
    .filter((event) => {
      const eventUserId = normalizeString(event?.user_id || event?.metadata?.user_id);
      const sameUser = !eventUserId || eventUserId === cleanUserId;
      return sameUser && (matchesAnyTicket(event, wantedTicketIds) || looksTicketRelated(event));
    });

  const memberEvents = memberRows
    .map((row) => normalizeEvent(row, "member_events"))
    .filter((event) => matchesAnyTicket(event, wantedTicketIds) || looksTicketRelated(event));

  return dedupe([...ticketEvents, ...memberEvents])
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
    .slice(0, limit);
}

export async function fetchRecentTicketEventsForTicket(supabase, { guildId, userId, ticketId, limit = 20 }) {
  const cleanTicketId = normalizeString(ticketId);
  if (!cleanTicketId) return [];

  return fetchRecentTicketEventsForUser(supabase, {
    guildId,
    userId,
    ticketIds: [cleanTicketId],
    limit,
  });
}
