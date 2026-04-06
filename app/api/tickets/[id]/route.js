import { createServerSupabase } from "@/lib/supabase-server";
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { enrichTicketWithMatchedCategory } from "@/lib/ticketCategoryMatching";
import {
  insertMemberEvent,
  patchGuildMemberEntryFields,
  patchLatestMemberJoinContext,
} from "@/lib/memberEventWrites";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const clean = normalizeString(value).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function newestTimestamp(...values) {
  return Math.max(...values.map(parseDateMs), 0);
}

function truncateText(value, max = 220) {
  const text = normalizeString(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function mapTicket(row) {
  return {
    ...row,
    priority: row?.priority || "medium",
    channel_id: row?.channel_id || row?.discord_thread_id || null,
    channel_name: row?.channel_name || null,
    source: row?.source || "discord",
    is_ghost: Boolean(row?.is_ghost),
  };
}

function mapGuildMember(row) {
  if (!row) return null;

  return {
    ...row,
    user_id: normalizeString(row?.user_id),
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
    is_bot: Boolean(row?.is_bot),
  };
}

function mapTicketNote(row) {
  return {
    ...row,
    ticket_id: normalizeString(row?.ticket_id),
    staff_id: normalizeString(row?.staff_id),
    staff_name: row?.staff_name || "",
    content: row?.content || "",
    created_at: row?.created_at || null,
  };
}

function mapTicketMessage(row) {
  return {
    ...row,
    ticket_id: normalizeString(row?.ticket_id),
    author_id: normalizeString(row?.author_id),
    author_name: row?.author_name || "",
    content: row?.content || "",
    message_type: normalizeLower(row?.message_type || "staff") || "staff",
    created_at: row?.created_at || null,
    attachments: safeArray(row?.attachments),
    source: row?.source || null,
  };
}

function mapVerificationFlag(row) {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    score: normalizeNumber(row?.score, 0),
    flagged: Boolean(row?.flagged),
    reasons: Array.isArray(row?.reasons) ? row.reasons : [],
    created_at: row?.created_at || null,
  };
}

function mapVerificationToken(row) {
  return {
    ...row,
    requester_id: normalizeString(row?.requester_id),
    user_id: normalizeString(row?.user_id),
    approved_user_id: normalizeString(row?.approved_user_id),
    status: normalizeLower(row?.status || "pending") || "pending",
    decision: normalizeString(row?.decision || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    submitted_at: row?.submitted_at || null,
    decided_at: row?.decided_at || null,
    expires_at: row?.expires_at || null,
    role_sync_ok: Boolean(row?.role_sync_ok),
    role_sync_reason: row?.role_sync_reason || null,
    ai_status: row?.ai_status || null,
  };
}

function mapVcSession(row) {
  return {
    ...row,
    token: row?.token || null,
    guild_id: normalizeString(row?.guild_id),
    ticket_channel_id: normalizeString(row?.ticket_channel_id),
    requester_id: normalizeString(row?.requester_id),
    owner_id: normalizeString(row?.owner_id),
    vc_channel_id: normalizeString(row?.vc_channel_id),
    queue_channel_id: normalizeString(row?.queue_channel_id),
    accepted_by: normalizeString(row?.accepted_by),
    canceled_by: normalizeString(row?.canceled_by),
    status: normalizeString(row?.status || "PENDING").toUpperCase() || "PENDING",
    created_at: row?.created_at || null,
    accepted_at: row?.accepted_at || null,
    started_at: row?.started_at || null,
    completed_at: row?.completed_at || null,
    canceled_at: row?.canceled_at || null,
    revoke_at: row?.revoke_at || null,
    access_minutes: normalizeNumber(row?.access_minutes, 0),
    meta: safeObject(row?.meta),
  };
}

function mapWarn(row) {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    reason: row?.reason || "",
    created_at: row?.created_at || null,
  };
}

function mapMemberEvent(row) {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    actor_id: normalizeString(row?.actor_id),
    actor_name: row?.actor_name || "",
    event_type: normalizeLower(row?.event_type),
    title: row?.title || "",
    reason: row?.reason || "",
    metadata: safeObject(row?.metadata),
    created_at: row?.created_at || null,
  };
}

function mapJoin(row) {
  return {
    ...row,
    user_id: normalizeString(row?.user_id),
    username: row?.username || "",
    display_name: row?.display_name || "",
    avatar_url: row?.avatar_url || null,
    joined_at: row?.joined_at || null,
    entry_method: row?.entry_method || null,
    verification_source: row?.verification_source || null,
    invite_code: row?.invite_code || null,
    invited_by: row?.invited_by || null,
    invited_by_name: row?.invited_by_name || null,
    vouched_by: row?.vouched_by || null,
    vouched_by_name: row?.vouched_by_name || null,
    approved_by: row?.approved_by || null,
    approved_by_name: row?.approved_by_name || null,
    join_note: row?.join_note || null,
    source_ticket_id: row?.source_ticket_id || null,
  };
}

function mapActivityRow(row) {
  const meta = safeObject(row?.metadata);

  return {
    id: row?.id || null,
    created_at: row?.created_at || null,
    title: row?.title || row?.event_type || "Activity",
    description: row?.description || row?.reason || "",
    reason: row?.reason || "",
    event_family: row?.event_family || "activity",
    event_type: row?.event_type || "activity",
    source: row?.source || "system",
    actor_id: normalizeString(row?.actor_user_id),
    actor_name: row?.actor_name || "",
    target_user_id: normalizeString(row?.target_user_id),
    target_name: row?.target_name || "",
    channel_id: row?.channel_id || meta?.channel_id || null,
    channel_name: row?.channel_name || meta?.channel_name || null,
    ticket_id: row?.ticket_id || meta?.ticket_id || null,
    metadata: meta,
  };
}

function buildCategoryPatch(body) {
  return {
    category: normalizeString(body?.category) || null,
    category_id: normalizeString(body?.category_id) || null,
    category_override: normalizeBoolean(
      body?.category_override ?? body?.manual_override ?? true
    ),
    category_set_by: normalizeString(body?.category_set_by) || null,
    category_set_at: new Date().toISOString(),
  };
}

function getActorIdentity(session) {
  return {
    actorId:
      session?.user?.discord_id ||
      session?.user?.id ||
      session?.user?.user_id ||
      session?.discordUser?.id ||
      null,
    actorName:
      session?.user?.username ||
      session?.user?.name ||
      session?.discordUser?.username ||
      "Dashboard Staff",
  };
}

function indexCategories(rows) {
  const byId = new Map();
  const bySlug = new Map();

  for (const row of safeArray(rows)) {
    const id = normalizeString(row?.id);
    const slug = normalizeLower(row?.slug);
    if (id) byId.set(id, row);
    if (slug) bySlug.set(slug, row);
  }

  return { byId, bySlug };
}

function getTicketCategoryRow(ticket, categoryIndex) {
  const idCandidates = [
    ticket?.category_id,
    ticket?.matched_category_id,
  ]
    .map(normalizeString)
    .filter(Boolean);

  for (const id of idCandidates) {
    if (categoryIndex.byId.has(id)) return categoryIndex.byId.get(id);
  }

  const slugCandidates = [
    ticket?.matched_category_slug,
    ticket?.category,
    ticket?.matched_intake_type,
  ]
    .map(normalizeLower)
    .filter(Boolean);

  for (const slug of slugCandidates) {
    if (categoryIndex.bySlug.has(slug)) return categoryIndex.bySlug.get(slug);
  }

  return null;
}

function deriveVerificationLabel({ member, latestToken, latestVc, flaggedCount, ticket }) {
  const tokenStatus = normalizeLower(latestToken?.status);
  const tokenDecision = normalizeString(latestToken?.decision).toUpperCase();
  const vcStatus = normalizeString(latestVc?.status).toUpperCase();

  if (member?.has_staff_role) return "Staff";
  if (
    member?.has_verified_role ||
    member?.has_secondary_verified_role ||
    tokenStatus === "approved" ||
    tokenDecision === "APPROVED"
  ) {
    return "Verified";
  }

  if (tokenStatus === "denied" || tokenDecision === "DENIED") {
    return "Denied";
  }

  if (flaggedCount > 0) {
    return "Needs Review";
  }

  if (
    ["PENDING", "ACCEPTED", "STAFF_ACCEPTED", "READY", "IN_VC", "STARTED"].includes(
      vcStatus
    )
  ) {
    return "VC In Progress";
  }

  if (
    tokenStatus === "pending" ||
    tokenStatus === "submitted" ||
    tokenStatus === "resubmit" ||
    member?.has_unverified ||
    normalizeLower(ticket?.matched_intake_type) === "verification"
  ) {
    return "Pending";
  }

  return "Unknown";
}

function deriveSlaState(ticket) {
  const status = normalizeLower(ticket?.status);
  const deadlineMs = parseDateMs(ticket?.sla_deadline);

  if (status === "closed" || status === "deleted") {
    return {
      sla_status: "closed",
      overdue: false,
      minutes_overdue: 0,
      minutes_until_deadline: 0,
    };
  }

  if (!deadlineMs) {
    return {
      sla_status: "no_deadline",
      overdue: false,
      minutes_overdue: 0,
      minutes_until_deadline: 0,
    };
  }

  const diffMinutes = Math.floor((deadlineMs - Date.now()) / 60000);

  if (diffMinutes < 0) {
    return {
      sla_status: "overdue",
      overdue: true,
      minutes_overdue: Math.abs(diffMinutes),
      minutes_until_deadline: 0,
    };
  }

  return {
    sla_status: "counting_down",
    overdue: false,
    minutes_overdue: 0,
    minutes_until_deadline: diffMinutes,
  };
}

function deriveRiskLevel({
  ticket,
  member,
  flaggedCount,
  warnCount,
  maxFlagScore,
  noteCount,
  slaState,
}) {
  const priority = normalizeLower(ticket?.priority);

  if (
    slaState?.overdue ||
    flaggedCount > 0 ||
    maxFlagScore >= 5 ||
    warnCount >= 3 ||
    priority === "urgent"
  ) {
    return "high";
  }

  if (
    priority === "high" ||
    warnCount >= 1 ||
    maxFlagScore >= 2 ||
    (member?.has_unverified && normalizeLower(ticket?.matched_intake_type) === "verification") ||
    noteCount === 0
  ) {
    return "medium";
  }

  return "low";
}

function deriveRecommendedActions({
  ticket,
  member,
  flaggedCount,
  latestVc,
  noteCount,
  slaState,
}) {
  const actions = [];

  if (!normalizeString(ticket?.claimed_by) && !normalizeString(ticket?.assigned_to)) {
    actions.push("Claim this ticket.");
  }

  if (slaState?.overdue) {
    actions.push("Respond now — this ticket is overdue.");
  }

  if (flaggedCount > 0) {
    actions.push("Review verification flags before resolving.");
  }

  const vcStatus = normalizeString(latestVc?.status).toUpperCase();
  if (["PENDING", "ACCEPTED", "STAFF_ACCEPTED", "READY", "IN_VC", "STARTED"].includes(vcStatus)) {
    actions.push("Check VC verification status before deciding.");
  }

  if (noteCount === 0) {
    actions.push("Add an internal note for staff continuity.");
  }

  if (normalizeLower(ticket?.matched_intake_type) === "verification" && member?.has_unverified) {
    actions.push("Confirm verification path and final role state.");
  }

  return [...new Set(actions)].slice(0, 6);
}

function latestBy(rows, ...fields) {
  return [...safeArray(rows)].sort((a, b) => {
    const aTs = newestTimestamp(...fields.map((field) => a?.[field]));
    const bTs = newestTimestamp(...fields.map((field) => b?.[field]));
    return bTs - aTs;
  })[0] || null;
}

function buildTimeline({ activityRows, memberEvents, verificationFlags, verificationTokens, vcSessions, notes }) {
  const items = [];

  for (const row of safeArray(activityRows)) {
    items.push({
      id: `activity:${row.id || row.created_at}`,
      type: row.event_type || "activity",
      title: row.title || "Activity",
      description: row.description || "",
      created_at: row.created_at || null,
      actor_name: row.actor_name || "System",
      actor_id: row.actor_id || null,
      source: row.source || "activity_feed_events",
      raw: row,
    });
  }

  for (const row of safeArray(memberEvents)) {
    items.push({
      id: `member_event:${row.id || row.created_at}`,
      type: row.event_type || "member_event",
      title: row.title || "Member Event",
      description: row.reason || "",
      created_at: row.created_at || null,
      actor_name: row.actor_name || "System",
      actor_id: row.actor_id || null,
      source: "member_events",
      raw: row,
    });
  }

  for (const row of safeArray(verificationFlags)) {
    items.push({
      id: `flag:${row.id || row.created_at}`,
      type: "verification_flag",
      title: row.flagged ? "Verification Flag Raised" : "Verification Reviewed",
      description: Array.isArray(row.reasons) ? row.reasons.join(" • ") : "",
      created_at: row.created_at || null,
      actor_name: "System",
      actor_id: null,
      source: "verification_flags",
      raw: row,
    });
  }

  for (const row of safeArray(verificationTokens)) {
    const decision = normalizeString(row?.decision || row?.status).toUpperCase();
    items.push({
      id: `token:${row.token || row.created_at}`,
      type: "verification_token",
      title:
        decision === "APPROVED"
          ? "Verification Approved"
          : decision === "DENIED"
            ? "Verification Denied"
            : "Verification Token Updated",
      description: `Status: ${row.status || "pending"}${decision ? ` • Decision: ${decision}` : ""}`,
      created_at:
        row.decided_at ||
        row.submitted_at ||
        row.updated_at ||
        row.created_at ||
        null,
      actor_name: row.decided_by_display_name || row.decided_by_username || "System",
      actor_id: row.decided_by || null,
      source: "verification_tokens",
      raw: row,
    });
  }

  for (const row of safeArray(vcSessions)) {
    items.push({
      id: `vc:${row.token || row.created_at}`,
      type: "vc_session",
      title: "VC Verification Session",
      description: `Status: ${row.status || "PENDING"}`,
      created_at:
        row.completed_at ||
        row.started_at ||
        row.accepted_at ||
        row.canceled_at ||
        row.created_at ||
        null,
      actor_name: row.accepted_by || row.canceled_by || "System",
      actor_id: row.accepted_by || row.canceled_by || null,
      source: "vc_verify_sessions",
      raw: row,
    });
  }

  for (const row of safeArray(notes)) {
    items.push({
      id: `note:${row.id || row.created_at}`,
      type: "internal_note",
      title: "Internal Note Added",
      description: truncateText(row.content, 180),
      created_at: row.created_at || null,
      actor_name: row.staff_name || row.staff_id || "Staff",
      actor_id: row.staff_id || null,
      source: "ticket_notes",
      raw: row,
    });
  }

  return items
    .filter((row) => row.created_at)
    .sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at))
    .slice(0, 40);
}

export async function GET(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const ticketId = normalizeString(params?.id);

    if (!ticketId) {
      const badResponse = new Response(
        JSON.stringify({ error: "Missing ticket id." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
      applyAuthCookies(badResponse, refreshedTokens);
      return badResponse;
    }

    const [
      ticketRes,
      messagesRes,
      notesRes,
      categoriesRes,
    ] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", ticketId).single(),
      supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
      supabase
        .from("ticket_notes")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", env.guildId || ""),
    ]);

    if (ticketRes.error || !ticketRes.data) {
      const notFoundResponse = new Response(
        JSON.stringify({ error: ticketRes.error?.message || "Ticket not found." }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
      applyAuthCookies(notFoundResponse, refreshedTokens);
      return notFoundResponse;
    }

    const rawTicket = mapTicket(ticketRes.data);
    const categoryRows = safeArray(categoriesRes.data || []);
    const categoryIndex = indexCategories(categoryRows);
    const ticket = enrichTicketWithMatchedCategory(rawTicket, categoryRows);

    const ticketUserId = normalizeString(ticket?.user_id);
    const ticketChannelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id);

    const [
      memberRowsRes,
      joinsRes,
      memberEventsRes,
      flagsRes,
      tokensRes,
      vcRes,
      warnsRes,
      activityRes,
    ] = await Promise.all([
      ticketUserId
        ? supabase
            .from("guild_members")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .eq("user_id", ticketUserId)
            .limit(1)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("member_joins")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .eq("user_id", ticketUserId)
            .order("joined_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("member_events")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .eq("user_id", ticketUserId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("verification_flags")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .eq("user_id", ticketUserId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("verification_tokens")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .or(
              `requester_id.eq.${ticketUserId},user_id.eq.${ticketUserId},approved_user_id.eq.${ticketUserId}`
            )
            .order("created_at", { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("vc_verify_sessions")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .or(`owner_id.eq.${ticketUserId},requester_id.eq.${ticketUserId}`)
            .order("created_at", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("warns")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .eq("user_id", ticketUserId)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [], error: null }),

      ticketUserId
        ? supabase
            .from("activity_feed_events")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .or(
              ticketChannelId
                ? `ticket_id.eq.${ticketId},channel_id.eq.${ticketChannelId},target_user_id.eq.${ticketUserId}`
                : `ticket_id.eq.${ticketId},target_user_id.eq.${ticketUserId}`
            )
            .order("created_at", { ascending: false })
            .limit(100)
        : supabase
            .from("activity_feed_events")
            .select("*")
            .eq("guild_id", env.guildId || "")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: false })
            .limit(100),
    ]);

    const member = mapGuildMember(safeArray(memberRowsRes.data || [])[0] || null);
    const messages = safeArray(messagesRes.data).map(mapTicketMessage);
    const notes = safeArray(notesRes.data).map(mapTicketNote);
    const joins = safeArray(joinsRes.data).map(mapJoin);
    const memberEvents = safeArray(memberEventsRes.data).map(mapMemberEvent);
    const verificationFlags = safeArray(flagsRes.data).map(mapVerificationFlag);
    const verificationTokens = safeArray(tokensRes.data).map(mapVerificationToken);
    const vcSessions = safeArray(vcRes.data).map(mapVcSession);
    const warns = safeArray(warnsRes.data).map(mapWarn);
    const activity = safeArray(activityRes.data).map(mapActivityRow);

    const category = getTicketCategoryRow(ticket, categoryIndex);
    const latestNote = latestBy(notes, "created_at");
    const latestFlag = latestBy(verificationFlags, "created_at");
    const latestToken = latestBy(
      verificationTokens,
      "updated_at",
      "decided_at",
      "submitted_at",
      "created_at"
    );
    const latestVc = latestBy(
      vcSessions,
      "completed_at",
      "started_at",
      "accepted_at",
      "canceled_at",
      "created_at"
    );
    const latestActivity = latestBy(activity, "created_at");
    const latestJoin = latestBy(joins, "joined_at");

    const flaggedCount = verificationFlags.filter((row) => row.flagged).length;
    const maxFlagScore = Math.max(
      0,
      ...verificationFlags.map((row) => normalizeNumber(row.score, 0))
    );
    const warnCount = warns.length;
    const noteCount = notes.length;
    const messageCount = messages.length;

    const slaState = deriveSlaState(ticket);
    const verificationLabel = deriveVerificationLabel({
      member,
      latestToken,
      latestVc,
      flaggedCount,
      ticket,
    });
    const riskLevel = deriveRiskLevel({
      ticket,
      member,
      flaggedCount,
      warnCount,
      maxFlagScore,
      noteCount,
      slaState,
    });
    const recommendedActions = deriveRecommendedActions({
      ticket,
      member,
      flaggedCount,
      latestVc,
      noteCount,
      slaState,
    });

    const ownerDisplayName =
      member?.display_name ||
      member?.nickname ||
      member?.username ||
      ticket?.username ||
      ticket?.user_id ||
      "Unknown User";

    const latestActivityAt =
      latestActivity?.created_at ||
      latestNote?.created_at ||
      ticket?.updated_at ||
      ticket?.created_at ||
      null;

    const enrichedTicket = {
      ...ticket,
      owner_display_name: ownerDisplayName,
      owner_avatar_url: member?.avatar_url || null,
      owner_role_state: member?.role_state || "unknown",
      owner_role_state_reason: member?.role_state_reason || "",
      owner_has_unverified: Boolean(member?.has_unverified),
      owner_has_verified_role: Boolean(member?.has_verified_role),
      owner_has_staff_role: Boolean(member?.has_staff_role),
      owner_entry_method: member?.entry_method || latestJoin?.entry_method || null,
      owner_verification_source:
        member?.verification_source || latestJoin?.verification_source || null,
      owner_entry_reason: member?.entry_reason || null,
      owner_approval_reason: member?.approval_reason || null,
      owner_invited_by: member?.invited_by || latestJoin?.invited_by || null,
      owner_invited_by_name:
        member?.invited_by_name || latestJoin?.invited_by_name || null,
      owner_invite_code: member?.invite_code || latestJoin?.invite_code || null,
      owner_vouched_by: member?.vouched_by || latestJoin?.vouched_by || null,
      owner_vouched_by_name:
        member?.vouched_by_name || latestJoin?.vouched_by_name || null,
      owner_approved_by: member?.approved_by || latestJoin?.approved_by || null,
      owner_approved_by_name:
        member?.approved_by_name || latestJoin?.approved_by_name || null,

      owner_verification_label: verificationLabel,
      owner_flag_count: flaggedCount,
      owner_latest_flag_score: normalizeNumber(latestFlag?.score, 0),
      owner_latest_flag_at: latestFlag?.created_at || null,
      owner_latest_flag_reasons: Array.isArray(latestFlag?.reasons)
        ? latestFlag.reasons
        : [],
      owner_max_flag_score: maxFlagScore,

      owner_token_count: verificationTokens.length,
      owner_latest_token_status: latestToken?.status || null,
      owner_latest_token_decision: latestToken?.decision || null,
      owner_latest_token_at:
        latestToken?.updated_at ||
        latestToken?.decided_at ||
        latestToken?.submitted_at ||
        latestToken?.created_at ||
        null,

      owner_vc_count: vcSessions.length,
      owner_latest_vc_status: latestVc?.status || null,
      owner_latest_vc_at:
        latestVc?.completed_at ||
        latestVc?.started_at ||
        latestVc?.accepted_at ||
        latestVc?.canceled_at ||
        latestVc?.created_at ||
        null,

      owner_warn_count: warnCount,

      category_color: category?.color || null,
      category_description: category?.description || null,
      category_button_label: category?.button_label || null,

      note_count: noteCount,
      latest_note_at: latestNote?.created_at || null,
      latest_note_staff_id: latestNote?.staff_id || null,
      latest_note_staff_name: latestNote?.staff_name || null,

      message_count: messageCount,
      latest_message_at: messages.length
        ? messages[messages.length - 1]?.created_at || null
        : null,

      latest_activity_at: latestActivityAt,
      latest_activity_title: latestActivity?.title || latestActivity?.event_type || null,
      latest_activity_type: latestActivity?.event_type || null,

      sla_status: slaState.sla_status,
      overdue: slaState.overdue,
      minutes_overdue: slaState.minutes_overdue,
      minutes_until_deadline: slaState.minutes_until_deadline,

      risk_level: riskLevel,
      recommended_actions: recommendedActions,
    };

    const viewer = {
      id:
        session?.user?.discord_id ||
        session?.user?.id ||
        session?.discordUser?.id ||
        null,
      username:
        session?.user?.username ||
        session?.discordUser?.username ||
        session?.user?.name ||
        "Staff",
    };

    const timeline = buildTimeline({
      activityRows: activity,
      memberEvents,
      verificationFlags,
      verificationTokens,
      vcSessions,
      notes,
    });

    const response = new Response(
      JSON.stringify({
        ok: true,
        ticket: enrichedTicket,
        category: category || null,
        member,
        joins,
        latestJoin: latestJoin || null,
        memberEvents,
        verificationFlags,
        verificationTokens,
        vcSessions,
        warns,
        activity,
        timeline,
        messages,
        notes,
        workspace: {
          verificationLabel,
          riskLevel,
          noteCount,
          messageCount,
          flaggedCount,
          maxFlagScore,
          warnCount,
          latestActivityAt,
          recommendedActions,
          sla: slaState,
        },
        counts: {
          notes: noteCount,
          messages: messageCount,
          flags: flaggedCount,
          warns: warnCount,
          tokens: verificationTokens.length,
          vcSessions: vcSessions.length,
        },
        viewer,
        currentStaffId: viewer.id || "",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message = error?.message || "Failed to load ticket.";

    return new Response(JSON.stringify({ error: message }), {
      status: message === "Unauthorized" ? 401 : 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute();
    const supabase = createServerSupabase();
    const body = await request.json();
    const ticketId = params?.id;
    const guildId = env.guildId || "";
    const { actorId, actorName } = getActorIdentity(session);

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "Missing ticket id." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const action = normalizeString(body?.action || "update-category").toLowerCase();

    if (action !== "update-category") {
      return new Response(JSON.stringify({ error: "Unsupported patch action." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    const { data: existingTicket, error: existingTicketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (existingTicketError || !existingTicket) {
      return new Response(
        JSON.stringify({ error: existingTicketError?.message || "Ticket not found." }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
    }

    const patch = buildCategoryPatch({
      ...body,
      category_set_by: body?.category_set_by || actorId || "",
    });

    let categoryRow = null;

    if (patch.category_id) {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("id", patch.category_id)
        .eq("guild_id", guildId)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        });
      }

      categoryRow = data || null;
    } else if (patch.category) {
      const { data } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("guild_id", guildId)
        .or(`slug.eq.${patch.category},name.eq.${patch.category}`)
        .limit(1);

      categoryRow = Array.isArray(data) && data.length ? data[0] : null;
    }

    const selectedCategorySlug = categoryRow?.slug || patch.category || null;
    const selectedCategoryName = categoryRow?.name || patch.category || null;
    const selectedIntakeType = categoryRow?.intake_type || null;

    const updatePayload = {
      updated_at: new Date().toISOString(),
      category_override: patch.category_override,
      category_set_by: patch.category_set_by,
      category_set_at: patch.category_set_at,
      category_id: categoryRow?.id || patch.category_id || null,
      category: selectedCategorySlug || selectedCategoryName || null,
      matched_category_id: categoryRow?.id || null,
      matched_category_name: selectedCategoryName,
      matched_category_slug: selectedCategorySlug,
      matched_intake_type: selectedIntakeType,
      matched_category_reason: "manual-override",
      matched_category_score: 999,
    };

    const { data: ticket, error } = await supabase
      .from("tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    await insertMemberEvent(
      {
        guildId,
        userId: String(existingTicket.user_id || "").trim(),
        actorId,
        actorName,
        eventType: "ticket_category_overridden",
        title: "Ticket Category Overridden",
        reason: `Manual category override set to ${selectedCategoryName || selectedCategorySlug || "unknown"}.`,
        metadata: {
          ticket_id: ticketId,
          ticket_number: existingTicket.ticket_number || null,
          previous_category: existingTicket.category || null,
          previous_category_id: existingTicket.category_id || null,
          previous_matched_category_id: existingTicket.matched_category_id || null,
          previous_matched_category_name: existingTicket.matched_category_name || null,
          next_category: updatePayload.category,
          next_category_id: updatePayload.category_id,
          matched_category_name: updatePayload.matched_category_name,
          matched_category_slug: updatePayload.matched_category_slug,
          matched_intake_type: updatePayload.matched_intake_type,
          source: "dashboard_ticket_patch",
        },
      },
      supabase
    );

    const shouldPatchEntryContext =
      String(selectedIntakeType || "").toLowerCase() === "verification" ||
      String(selectedCategorySlug || "").toLowerCase().includes("verification") ||
      String(selectedCategoryName || "").toLowerCase().includes("verification");

    if (shouldPatchEntryContext) {
      await patchGuildMemberEntryFields(
        {
          guildId,
          userId: String(existingTicket.user_id || "").trim(),
          approvedBy: actorId,
          approvedByName: actorName,
          sourceTicketId: ticketId,
          verificationTicketId: ticketId,
          entryMethod:
            normalizeString(body?.entry_method) ||
            normalizeString(body?.verification_source) ||
            "verification_ticket",
          verificationSource:
            normalizeString(body?.verification_source) ||
            "dashboard_manual_category_override",
          entryReason:
            normalizeString(body?.entry_reason) ||
            `Ticket category manually set to ${selectedCategoryName || selectedCategorySlug || "verification"}.`,
          approvalReason:
            normalizeString(body?.approval_reason) ||
            `Dashboard staff manually set verification category on ticket ${ticketId}.`,
        },
        supabase
      );

      await patchLatestMemberJoinContext(
        {
          guildId,
          userId: String(existingTicket.user_id || "").trim(),
          username: existingTicket.username || null,
          approvedBy: actorId,
          approvedByName: actorName,
          sourceTicketId: ticketId,
          entryMethod:
            normalizeString(body?.entry_method) || "verification_ticket",
          verificationSource:
            normalizeString(body?.verification_source) ||
            "dashboard_manual_category_override",
          joinNote:
            normalizeString(body?.entry_reason) ||
            `Verification context linked from ticket ${ticketId}.`,
        },
        supabase
      );

      await insertMemberEvent(
        {
          guildId,
          userId: String(existingTicket.user_id || "").trim(),
          actorId,
          actorName,
          eventType: "verification_context_linked",
          title: "Verification Context Linked",
          reason:
            normalizeString(body?.approval_reason) ||
            "Verification entry context was linked from dashboard ticket override.",
          metadata: {
            ticket_id: ticketId,
            verification_ticket_id: ticketId,
            category_name: selectedCategoryName,
            category_slug: selectedCategorySlug,
            verification_source:
              normalizeString(body?.verification_source) ||
              "dashboard_manual_category_override",
          },
        },
        supabase
      );
    }

    const response = new Response(JSON.stringify({ ok: true, ticket }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });

    applyAuthCookies(response, refreshedTokens);
    return response;
  } catch (error) {
    const message = error?.message || "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
}
