function normalizeString(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function safeSupabaseRows(queryFactory) {
  try {
    const res = await queryFactory();
    if (Array.isArray(res?.data)) return res.data;
    if (res?.data && typeof res.data === "object") return [res.data];
    return [];
  } catch {
    return [];
  }
}

function buildUserTicketLifecycleEvents(tickets = []) {
  const events = [];

  for (const ticket of safeArray(tickets)) {
    const ticketId = ticket?.id || null;
    const ticketTitle = ticket?.title || ticket?.channel_name || "Ticket";
    const category = ticket?.matched_category_name || ticket?.category || "support";
    const baseMetadata = {
      ticket_id: ticketId,
      ticket_title: ticketTitle,
      channel_name: ticket?.channel_name || null,
      channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
      category,
      status: ticket?.status || null,
      priority: ticket?.priority || null,
    };

    if (ticket?.created_at) {
      events.push({
        id: `ticket-created-${ticketId || ticket?.created_at}`,
        title: "Ticket Opened",
        description: `Opened ${ticketTitle}`,
        reason: ticket?.initial_message || "",
        event_type: "ticket_created",
        created_at: ticket.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: ticketId,
        metadata: baseMetadata,
        _source: "tickets",
      });
    }

    if (ticket?.claimed_by && ticket?.updated_at) {
      events.push({
        id: `ticket-claimed-${ticketId || ticket?.updated_at}`,
        title: "Ticket Claimed",
        description: `${ticketTitle} was claimed by staff.`,
        reason: "",
        event_type: "ticket_claimed",
        created_at: ticket.updated_at,
        actor_id: ticket?.claimed_by || null,
        actor_name: ticket?.claimed_by_name || ticket?.claimed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          claimed_by: ticket?.claimed_by || null,
        },
        _source: "tickets",
      });
    }

    if (ticket?.closed_at || normalizeString(ticket?.status).toLowerCase() === "closed") {
      events.push({
        id: `ticket-closed-${ticketId || ticket?.closed_at || ticket?.updated_at}`,
        title: "Ticket Closed",
        description: `${ticketTitle} was closed.`,
        reason: ticket?.closed_reason || "",
        event_type: "ticket_closed",
        created_at: ticket?.closed_at || ticket?.updated_at || null,
        actor_id: ticket?.closed_by || null,
        actor_name: ticket?.closed_by_name || ticket?.closed_by || "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          closed_by: ticket?.closed_by || null,
          closed_reason: ticket?.closed_reason || null,
        },
        _source: "tickets",
      });
    }

    if (normalizeString(ticket?.status).toLowerCase() === "deleted") {
      events.push({
        id: `ticket-deleted-${ticketId || ticket?.deleted_at || ticket?.updated_at}`,
        title: "Ticket Deleted",
        description: `${ticketTitle} was deleted.`,
        reason: ticket?.closed_reason || "",
        event_type: "ticket_deleted",
        created_at: ticket?.deleted_at || ticket?.closed_at || ticket?.updated_at || null,
        actor_id: ticket?.deleted_by || ticket?.closed_by || null,
        actor_name:
          ticket?.deleted_by_name ||
          ticket?.closed_by_name ||
          ticket?.deleted_by ||
          ticket?.closed_by ||
          "Staff",
        ticket_id: ticketId,
        metadata: {
          ...baseMetadata,
          deleted_by: ticket?.deleted_by || null,
        },
        _source: "tickets",
      });
    }
  }

  return events.filter((event) => event?.created_at);
}

function buildVerificationFlagEvents(flags = []) {
  return safeArray(flags)
    .filter(Boolean)
    .map((flag) => ({
      id: `verification-flag-${flag?.id || flag?.created_at}`,
      title: flag?.flagged ? "Verification Flag Raised" : "Verification Reviewed",
      description: flag?.flagged
        ? "Your verification was flagged for manual review."
        : "Verification review activity detected.",
      reason: Array.isArray(flag?.reasons) ? flag.reasons.join(" • ") : "",
      event_type: "verification_flag",
      created_at: flag?.created_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: {
        score: Number(flag?.score || 0),
        reasons: Array.isArray(flag?.reasons) ? flag.reasons : [],
      },
      _source: "verification_flags",
    }))
    .filter((event) => event?.created_at);
}

function buildVcSessionEvents(rows = []) {
  const events = [];

  for (const row of safeArray(rows)) {
    const status = normalizeString(row?.status || "PENDING").toUpperCase();

    if (row?.created_at) {
      events.push({
        id: `vc-created-${row?.id || row?.created_at}`,
        title: "VC Verification Requested",
        description: `VC verification status: ${status}`,
        reason: "",
        event_type: "vc_verify_requested",
        created_at: row.created_at,
        actor_id: null,
        actor_name: "System",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
          access_minutes: Number(row?.access_minutes || 0),
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.accepted_at) {
      events.push({
        id: `vc-accepted-${row?.id || row?.accepted_at}`,
        title: "VC Verification Accepted",
        description: "A staff member accepted your VC verification request.",
        reason: "",
        event_type: "vc_verify_accepted",
        created_at: row.accepted_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.completed_at) {
      events.push({
        id: `vc-completed-${row?.id || row?.completed_at}`,
        title: "VC Verification Completed",
        description: `VC verification finished with status ${status}.`,
        reason: "",
        event_type: "vc_verify_completed",
        created_at: row.completed_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }

    if (row?.canceled_at) {
      events.push({
        id: `vc-canceled-${row?.id || row?.canceled_at}`,
        title: "VC Verification Ended",
        description: `VC verification ended with status ${status}.`,
        reason: "",
        event_type: "vc_verify_ended",
        created_at: row.canceled_at,
        actor_id: row?.staff_id || null,
        actor_name: row?.staff_name || row?.staff_id || "Staff",
        ticket_id: row?.ticket_id || null,
        metadata: {
          status,
        },
        _source: "vc_verify_sessions",
      });
    }
  }

  return events.filter((event) => event?.created_at);
}

function buildMemberJoinEvents(rows = []) {
  return safeArray(rows)
    .filter(Boolean)
    .map((row) => ({
      id: `member-join-${row?.id || row?.joined_at || row?.created_at}`,
      title: "Joined Server",
      description: "Your member profile was recorded in the server.",
      reason: row?.join_source || row?.entry_method || "",
      event_type: "member_join",
      created_at: row?.joined_at || row?.created_at || null,
      actor_id: null,
      actor_name: "System",
      ticket_id: null,
      metadata: {
        join_source: row?.join_source || null,
        entry_method: row?.entry_method || null,
      },
      _source: "member_joins",
    }))
    .filter((event) => event?.created_at);
}

function normalizeEventObject(event) {
  if (!event) return null;

  return {
    id: event?.id || null,
    title: event?.title || "Activity",
    description: event?.description || "",
    reason: event?.reason || "",
    event_type: event?.event_type || "activity",
    created_at: event?.created_at || null,
    updated_at: event?.updated_at || event?.created_at || null,
    actor_id: event?.actor_id || null,
    actor_name: event?.actor_name || "System",
    ticket_id: event?.ticket_id || null,
    metadata:
      event?.metadata && typeof event.metadata === "object" ? event.metadata : {},
    _source: event?._source || "activity",
  };
}

export async function fetchRecentTicketEventsForUser(
  supabase,
  { guildId, userId, ticketIds = [], tickets = [], limit = 24 }
) {
  const safeUserId = normalizeString(userId);
  const safeGuildId = normalizeString(guildId);
  const ticketIdSet = new Set(
    safeArray(ticketIds).map((value) => normalizeString(value)).filter(Boolean)
  );

  const lifecycleEvents = buildUserTicketLifecycleEvents(tickets);

  if (!supabase || !safeUserId || !safeGuildId) {
    return lifecycleEvents
      .map(normalizeEventObject)
      .filter(Boolean)
      .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at))
      .slice(0, limit);
  }

  const [flagRows, vcRows, joinRows, auditLogRows, auditEventRows, ticketEventRows] =
    await Promise.all([
      safeSupabaseRows(() =>
        supabase
          .from("verification_flags")
          .select("*")
          .eq("guild_id", safeGuildId)
          .eq("user_id", safeUserId)
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeSupabaseRows(() =>
        supabase
          .from("vc_verify_sessions")
          .select("*")
          .eq("owner_id", Number(safeUserId))
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeSupabaseRows(() =>
        supabase
          .from("member_joins")
          .select("*")
          .eq("guild_id", safeGuildId)
          .eq("user_id", safeUserId)
          .order("joined_at", { ascending: false })
          .limit(5)
      ),
      safeSupabaseRows(() =>
        supabase
          .from("audit_logs")
          .select("*")
          .eq("guild_id", safeGuildId)
          .order("created_at", { ascending: false })
          .limit(50)
      ),
      safeSupabaseRows(() =>
        supabase
          .from("audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      ),
      safeSupabaseRows(() =>
        supabase
          .from("ticket_events")
          .select("*")
          .eq("guild_id", safeGuildId)
          .order("created_at", { ascending: false })
          .limit(50)
      ),
    ]);

  const matchesUserOrTicket = (row) => {
    const meta =
      row?.meta && typeof row.meta === "object"
        ? row.meta
        : row?.metadata && typeof row.metadata === "object"
          ? row.metadata
          : {};

    const userCandidates = [
      row?.user_id,
      row?.owner_id,
      row?.member_id,
      row?.requester_id,
      row?.actor_id,
      row?.related_id,
      meta?.user_id,
      meta?.owner_id,
      meta?.member_id,
      meta?.requester_id,
      meta?.actor_id,
      meta?.related_id,
      meta?.approved_user_id,
      meta?.target_user_id,
      meta?.ticket_owner_id,
    ]
      .map((value) => normalizeString(value))
      .filter(Boolean);

    if (userCandidates.includes(safeUserId)) return true;

    const relatedTicketIds = [
      row?.ticket_id,
      row?.source_ticket_id,
      row?.verification_ticket_id,
      meta?.ticket_id,
      meta?.source_ticket_id,
      meta?.verification_ticket_id,
    ]
      .map((value) => normalizeString(value))
      .filter(Boolean);

    return relatedTicketIds.some((id) => ticketIdSet.has(id));
  };

  const auditLogEvents = safeArray(auditLogRows)
    .filter(matchesUserOrTicket)
    .map((row) => {
      const meta = row?.meta && typeof row.meta === "object" ? row.meta : {};
      return {
        id: `audit-log-${row?.id || row?.created_at}`,
        title: String(row?.action || "Audit Log")
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/\b\w/g, (m) => m.toUpperCase()),
        description: meta?.reason || meta?.message || "Ticket-related audit entry.",
        reason: meta?.reason || meta?.message || "",
        event_type: row?.action || "audit_log",
        created_at: row?.created_at || null,
        actor_id: row?.staff_id || meta?.staff_id || null,
        actor_name:
          row?.staff_name || meta?.staff_name || row?.staff_id || "Staff",
        ticket_id:
          meta?.ticket_id || meta?.source_ticket_id || row?.ticket_id || null,
        metadata: meta,
        _source: "audit_logs",
      };
    });

  const auditEvents = safeArray(auditEventRows)
    .filter(matchesUserOrTicket)
    .map((row) => ({
      id: `audit-event-${row?.id || row?.created_at}`,
      title: row?.title || "Audit Event",
      description: row?.description || "",
      reason: row?.description || "",
      event_type: row?.event_type || "audit_event",
      created_at: row?.created_at || null,
      actor_id: row?.actor_id || null,
      actor_name: row?.actor_name || "System",
      ticket_id: row?.ticket_id || null,
      metadata:
        row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
      _source: "audit_events",
    }));

  const ticketEvents = safeArray(ticketEventRows)
    .filter(matchesUserOrTicket)
    .map((row) => ({
      id: `ticket-event-${row?.id || row?.created_at}`,
      title:
        row?.title ||
        String(row?.event_type || "ticket_event")
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (m) => m.toUpperCase()),
      description: row?.description || row?.reason || "",
      reason: row?.reason || row?.description || "",
      event_type: row?.event_type || "ticket_event",
      created_at: row?.created_at || null,
      actor_id: row?.actor_id || row?.staff_id || null,
      actor_name: row?.actor_name || row?.staff_name || "System",
      ticket_id: row?.ticket_id || null,
      metadata:
        row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
      _source: "ticket_events",
    }));

  const merged = [
    ...lifecycleEvents,
    ...buildVerificationFlagEvents(flagRows),
    ...buildVcSessionEvents(vcRows),
    ...buildMemberJoinEvents(joinRows),
    ...auditLogEvents,
    ...auditEvents,
    ...ticketEvents,
  ]
    .map(normalizeEventObject)
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b?.created_at) - parseDateMs(a?.created_at));

  const deduped = [];
  const seen = new Set();

  for (const item of merged) {
    const key = `${item?._source || "activity"}:${item?.id || ""}:${item?.created_at || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

export async function fetchRecentTicketEventsForTicket(
  supabase,
  { guildId, userId, ticketId, tickets = [], limit = 20 }
) {
  const cleanTicketId = normalizeString(ticketId);
  if (!cleanTicketId) return [];

  return fetchRecentTicketEventsForUser(supabase, {
    guildId,
    userId,
    ticketIds: [cleanTicketId],
    tickets,
    limit,
  });
}
