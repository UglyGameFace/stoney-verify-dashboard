import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardClient from "@/components/DashboardClient";
import UserDashboardClient from "@/components/UserDashboardClient";
import { createServerSupabase } from "@/lib/supabase-server";
import { sortTickets, derivePriority } from "@/lib/priority";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

function normalizeStaffKey(value) {
  return String(value || "").trim();
}

function normalizeStaffLabel(value, fallback = "Unknown Staff") {
  const text = String(value || "").trim();
  return text || fallback;
}

function parseDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isClosedLikeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return value === "closed" || value === "deleted";
}

function hasUsableChannel(ticket) {
  return Boolean(
    String(ticket?.channel_id || ticket?.discord_thread_id || "").trim()
  );
}

function shouldHideStaleTicket(ticket) {
  const status = String(ticket?.status || "").trim().toLowerCase();
  const missingChannel = !hasUsableChannel(ticket);

  if (!missingChannel) return false;
  if (!isClosedLikeStatus(status)) return false;

  const closedAtMs = parseDateMs(ticket?.closed_at);
  const updatedAtMs = parseDateMs(ticket?.updated_at);
  const createdAtMs = parseDateMs(ticket?.created_at);
  const newestMs = Math.max(closedAtMs, updatedAtMs, createdAtMs);
  const ageMs = Date.now() - newestMs;

  return ageMs > 5 * 60 * 1000;
}

function deriveMetricsFromTickets(tickets = [], existingMetrics = []) {
  const byStaff = new Map();

  function ensureRow(key, label) {
    const safeKey = normalizeStaffKey(key);
    if (!safeKey) return null;

    if (!byStaff.has(safeKey)) {
      byStaff.set(safeKey, {
        staff_id: safeKey,
        staff_name: normalizeStaffLabel(label, safeKey),
        tickets_handled: 0,
        approvals: 0,
        denials: 0,
        avg_response_minutes: 0,
        last_active: null,
      });
    }

    return byStaff.get(safeKey);
  }

  for (const row of Array.isArray(existingMetrics) ? existingMetrics : []) {
    const key = normalizeStaffKey(row?.staff_id || row?.staff_name);
    if (!key) continue;

    byStaff.set(key, {
      staff_id: key,
      staff_name: normalizeStaffLabel(row?.staff_name, key),
      tickets_handled: Number(row?.tickets_handled || 0),
      approvals: Number(row?.approvals || 0),
      denials: Number(row?.denials || 0),
      avg_response_minutes: Number(row?.avg_response_minutes || 0),
      last_active: row?.last_active || null,
    });
  }

  for (const ticket of Array.isArray(tickets) ? tickets : []) {
    const status = String(ticket?.status || "").trim().toLowerCase();
    const category = String(ticket?.category || "").trim().toLowerCase();

    const staffId = normalizeStaffKey(
      ticket?.closed_by ||
        ticket?.claimed_by ||
        ticket?.assigned_to ||
        ticket?.staff_id
    );

    const staffName = normalizeStaffLabel(
      ticket?.closed_by_name ||
        ticket?.claimed_by_name ||
        ticket?.assigned_to_name ||
        ticket?.staff_name ||
        staffId
    );

    if (!staffId) continue;

    const row = ensureRow(staffId, staffName);
    if (!row) continue;

    const updatedAt =
      ticket?.updated_at || ticket?.closed_at || ticket?.created_at || null;

    if (
      updatedAt &&
      (!row.last_active || parseDateMs(updatedAt) > parseDateMs(row.last_active))
    ) {
      row.last_active = updatedAt;
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

  return [...byStaff.values()].sort((a, b) => {
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

function sanitizeUserTicket(ticket) {
  return {
    id: ticket?.id || null,
    title: ticket?.title || "Ticket",
    category: ticket?.category || null,
    matched_category_name: ticket?.matched_category_name || null,
    matched_category_slug: ticket?.matched_category_slug || null,
    matched_intake_type: ticket?.matched_intake_type || null,
    status: ticket?.status || "open",
    priority: ticket?.priority || "medium",
    claimed_by: ticket?.claimed_by || null,
    closed_reason: ticket?.closed_reason || null,
    created_at: ticket?.created_at || null,
    updated_at: ticket?.updated_at || null,
    closed_at: ticket?.closed_at || null,
    channel_id: ticket?.channel_id || ticket?.discord_thread_id || null,
    channel_name: ticket?.channel_name || null,
  };
}

function sanitizeUserCategory(category) {
  return {
    id: category?.id || null,
    name: category?.name || "Category",
    slug: category?.slug || null,
    description: category?.description || null,
    intake_type: category?.intake_type || "general",
    button_label: category?.button_label || null,
    is_default: Boolean(category?.is_default),
  };
}

function normalizeRoleNames(roleNames) {
  return Array.isArray(roleNames)
    ? roleNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
}

function deriveSessionMemberFallback(session) {
  const sessionMember = session?.member || {};
  const roleNames = normalizeRoleNames(sessionMember?.roles);
  const roleNamesLower = roleNames.map((name) => name.toLowerCase());

  const hasStaffRole = Boolean(sessionMember?.has_staff_role);
  const hasVerifiedRole = Boolean(sessionMember?.has_verified_role);
  const hasUnverified =
    Boolean(sessionMember?.has_unverified_role) ||
    roleNamesLower.some((name) => name === "unverified" || name.includes("unverified"));
  const hasSecondaryVerifiedRole = roleNamesLower.some(
    (name) =>
      name === "resident" ||
      name === "verified" ||
      name.includes("verified") ||
      name.includes("resident")
  );

  let roleState = "not_synced";
  let roleStateReason = "Waiting for dashboard member sync.";

  if (hasStaffRole) {
    roleState = "staff_ok";
    roleStateReason = "Live Discord session shows staff access.";
  } else if (hasVerifiedRole || hasSecondaryVerifiedRole) {
    roleState = "verified_ok";
    roleStateReason = "Live Discord session shows verified access.";
  } else if (hasUnverified) {
    roleState = "unverified_only";
    roleStateReason = "Live Discord session shows pending verification.";
  }

  return {
    user_id:
      session?.user?.discord_id ||
      session?.user?.id ||
      session?.discordUser?.id ||
      null,
    username:
      session?.discordUser?.username ||
      session?.user?.login ||
      session?.user?.username ||
      null,
    display_name:
      sessionMember?.display_name ||
      session?.user?.username ||
      session?.discordUser?.global_name ||
      session?.discordUser?.username ||
      null,
    nickname: sessionMember?.nickname || null,
    avatar_url:
      sessionMember?.avatar_url ||
      session?.user?.avatar_url ||
      session?.user?.avatar ||
      session?.user?.image ||
      session?.user?.picture ||
      session?.discordUser?.avatar_url ||
      session?.discordUser?.avatar ||
      null,
    in_guild: true,
    has_unverified: hasUnverified,
    has_verified_role: hasVerifiedRole || hasSecondaryVerifiedRole,
    has_staff_role: hasStaffRole,
    has_secondary_verified_role: hasSecondaryVerifiedRole,
    role_state: roleState,
    role_state_reason: roleStateReason,
    joined_at: null,
    role_names: roleNames,
  };
}

function mergeMemberWithSession(member, session) {
  const fallback = deriveSessionMemberFallback(session);

  if (!member) {
    return fallback;
  }

  const dbRoleNames = normalizeRoleNames(member?.role_names);
  const fallbackRoleNames = normalizeRoleNames(fallback?.role_names);
  const mergedRoleNames = dbRoleNames.length ? dbRoleNames : fallbackRoleNames;

  const mergedHasStaffRole = Boolean(
    member?.has_staff_role || fallback?.has_staff_role
  );
  const mergedHasVerifiedRole = Boolean(
    member?.has_verified_role ||
      member?.has_secondary_verified_role ||
      fallback?.has_verified_role ||
      fallback?.has_secondary_verified_role
  );
  const mergedHasUnverified = Boolean(
    member?.has_unverified || fallback?.has_unverified
  );
  const mergedSecondaryVerified = Boolean(
    member?.has_secondary_verified_role || fallback?.has_secondary_verified_role
  );

  let mergedRoleState = member?.role_state || fallback?.role_state || "not_synced";
  let mergedRoleStateReason =
    member?.role_state_reason || fallback?.role_state_reason || null;

  if (mergedHasStaffRole) {
    mergedRoleState = "staff_ok";
    mergedRoleStateReason = "Staff access detected.";
  } else if (mergedHasVerifiedRole) {
    mergedRoleState = "verified_ok";
    mergedRoleStateReason = "Verified access detected.";
  } else if (mergedHasUnverified) {
    mergedRoleState = "unverified_only";
    mergedRoleStateReason = "Pending verification access detected.";
  } else if (!member?.role_state || member?.role_state === "unknown") {
    mergedRoleState = fallback?.role_state || "not_synced";
    mergedRoleStateReason =
      fallback?.role_state_reason || "Waiting for dashboard member sync.";
  }

  return {
    ...member,
    user_id: member?.user_id || fallback?.user_id || null,
    username: member?.username || fallback?.username || null,
    display_name: member?.display_name || fallback?.display_name || null,
    nickname: member?.nickname || fallback?.nickname || null,
    avatar_url: member?.avatar_url || fallback?.avatar_url || null,
    in_guild: member?.in_guild !== false,
    has_unverified: mergedHasUnverified,
    has_verified_role: mergedHasVerifiedRole,
    has_staff_role: mergedHasStaffRole,
    has_secondary_verified_role: mergedSecondaryVerified,
    role_state: mergedRoleState,
    role_state_reason: mergedRoleStateReason,
    joined_at: member?.joined_at || fallback?.joined_at || null,
    role_names: mergedRoleNames,
  };
}

function sanitizeUserMember(member, session = null) {
  const cleaned = member
    ? {
        user_id: member?.user_id || null,
        username: member?.username || null,
        display_name: member?.display_name || null,
        nickname: member?.nickname || null,
        avatar_url: member?.avatar_url || null,
        in_guild: member?.in_guild !== false,
        has_unverified: Boolean(member?.has_unverified),
        has_verified_role: Boolean(member?.has_verified_role),
        has_staff_role: Boolean(member?.has_staff_role),
        has_secondary_verified_role: Boolean(member?.has_secondary_verified_role),
        role_state: member?.role_state || "unknown",
        role_state_reason: member?.role_state_reason || null,
        joined_at: member?.joined_at || null,
        role_names: Array.isArray(member?.role_names) ? member.role_names : [],
      }
    : null;

  return mergeMemberWithSession(cleaned, session);
}

function sanitizeVerificationFlag(flag) {
  return {
    id: flag?.id || null,
    score: Number(flag?.score || 0),
    flagged: Boolean(flag?.flagged),
    reasons: Array.isArray(flag?.reasons) ? flag.reasons : [],
    created_at: flag?.created_at || null,
  };
}

function sanitizeVcVerifySession(session) {
  if (!session) return null;

  return {
    token: null,
    status: session?.status || "PENDING",
    created_at: session?.created_at || null,
    accepted_at: session?.accepted_at || null,
    started_at: session?.started_at || null,
    completed_at: session?.completed_at || null,
    canceled_at: session?.canceled_at || null,
    access_minutes: Number(session?.access_minutes || 0),
  };
}

function buildRecentJoinRows(memberJoins = [], guildMembers = []) {
  const joinRows = Array.isArray(memberJoins) ? memberJoins : [];
  const memberRows = Array.isArray(guildMembers) ? guildMembers : [];

  const membersById = new Map(
    memberRows
      .filter((row) => row?.user_id)
      .map((row) => [String(row.user_id), row])
  );

  const mergedJoinRows = joinRows.map((join) => {
    const key = String(join?.user_id || "");
    const member = membersById.get(key);

    return {
      ...(member || {}),
      ...(join || {}),
      user_id: join?.user_id || member?.user_id || null,
      username: join?.username || member?.username || null,
      display_name: join?.display_name || member?.display_name || null,
      nickname: join?.nickname || member?.nickname || null,
      avatar_url: join?.avatar_url || member?.avatar_url || null,
      joined_at: join?.joined_at || member?.joined_at || join?.created_at || null,
      updated_at: join?.updated_at || member?.updated_at || member?.last_seen_at || null,
      created_at: join?.created_at || member?.created_at || null,
      role_names:
        Array.isArray(join?.role_names) && join.role_names.length
          ? join.role_names
          : Array.isArray(member?.role_names)
            ? member.role_names
            : [],
      has_verified_role:
        typeof join?.has_verified_role === "boolean"
          ? join.has_verified_role
          : Boolean(member?.has_verified_role),
      has_unverified:
        typeof join?.has_unverified === "boolean"
          ? join.has_unverified
          : Boolean(member?.has_unverified),
      has_staff_role:
        typeof join?.has_staff_role === "boolean"
          ? join.has_staff_role
          : Boolean(member?.has_staff_role),
      in_guild:
        typeof join?.in_guild === "boolean"
          ? join.in_guild
          : member?.in_guild !== false,
      role_state: join?.role_state || member?.role_state || "tracked",
      role_state_reason:
        join?.role_state_reason || member?.role_state_reason || null,
      top_role:
        join?.top_role ||
        member?.top_role ||
        member?.highest_role_name ||
        (Array.isArray(member?.role_names) ? member.role_names[0] : null) ||
        null,
      highest_role_name:
        join?.highest_role_name ||
        member?.highest_role_name ||
        join?.top_role ||
        member?.top_role ||
        null,
      source: "member_joins",
    };
  });

  if (mergedJoinRows.length) {
    return mergedJoinRows
      .sort(
        (a, b) =>
          parseDateMs(b?.joined_at || b?.created_at || b?.updated_at) -
          parseDateMs(a?.joined_at || a?.created_at || a?.updated_at)
      )
      .slice(0, 50);
  }

  return memberRows
    .filter((member) => {
      const joinedAtMs = parseDateMs(member?.joined_at || member?.created_at);
      return joinedAtMs > 0;
    })
    .sort(
      (a, b) =>
        parseDateMs(b?.joined_at || b?.created_at || b?.updated_at) -
        parseDateMs(a?.joined_at || a?.created_at || a?.updated_at)
    )
    .slice(0, 50)
    .map((member) => ({
      ...member,
      source: "guild_members_fallback",
      top_role:
        member?.top_role ||
        member?.highest_role_name ||
        (Array.isArray(member?.role_names) ? member.role_names[0] : null) ||
        null,
      highest_role_name:
        member?.highest_role_name ||
        member?.top_role ||
        (Array.isArray(member?.role_names) ? member.role_names[0] : null) ||
        null,
    }));
}

async function getStaffDashboardData() {
  const supabase = createServerSupabase();
  const guildId = env.guildId || "";

  const [
    ticketsRes,
    auditLogsRes,
    auditEventsRes,
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
      .limit(25),

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
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      ),

    supabase
      .from("raid_events")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      ),

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
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(25),

    supabase
      .from("raid_events")
      .select("*")
      .eq("guild_id", guildId)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
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

  const rawTickets = (ticketsRes.data || []).map((ticket) => ({
    ...ticket,
    priority: ticket.priority || derivePriority(ticket),
    channel_id: ticket.channel_id || ticket.discord_thread_id || null,
    transcript_url: ticket.transcript_url || null,
    transcript_message_id: ticket.transcript_message_id || null,
    transcript_channel_id: ticket.transcript_channel_id || null,
  }));

  const visibleTickets = rawTickets.filter(
    (ticket) => !shouldHideStaleTicket(ticket)
  );

  const openTicketsCount = visibleTickets.filter((ticket) =>
    ["open", "claimed"].includes(String(ticket?.status || "").toLowerCase())
  ).length;

  const events = [
    ...(auditLogsRes.data || []).map((row) => ({
      id: `audit-log-${row.id}`,
      title: String(row.action || "Audit Log")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (m) => m.toUpperCase()),
      description:
        row?.meta && typeof row.meta === "object"
          ? [
              row.meta.reason ? `Reason: ${row.meta.reason}` : null,
              row.meta.channel_id ? `Channel: ${row.meta.channel_id}` : null,
              row.meta.user_id ? `User: ${row.meta.user_id}` : null,
              row.meta.staff_id ? `Staff: ${row.meta.staff_id}` : null,
              row.meta.command_id ? `Command: ${row.meta.command_id}` : null,
            ]
              .filter(Boolean)
              .join(" • ") || "Dashboard/bot audit log entry"
          : row?.token
            ? `Token: ${row.token}`
            : "Dashboard/bot audit log entry",
      event_type: "audit_log",
      related_id: row?.staff_id || null,
      created_at: row?.created_at || null,
      actor_id: row?.staff_id || null,
      meta: row?.meta || {},
      source: "audit_logs",
    })),
    ...(auditEventsRes.data || []).map((row) => ({
      id: `audit-event-${row.id}`,
      title: row?.title || "Audit Event",
      description: row?.description || "",
      event_type: row?.event_type || "audit_event",
      related_id: row?.related_id || null,
      created_at: row?.created_at || null,
      actor_id: null,
      meta: {},
      source: "audit_events",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    )
    .slice(0, 40);

  const roles = (rolesRes.data || []).map((role) => ({ ...role }));
  const metrics = deriveMetricsFromTickets(rawTickets, metricsRes.data || []);
  const categories = categoriesRes.data || [];
  const recentActiveMembers = recentActiveMembersRes.data || [];
  const recentFormerMembers = recentFormerMembersRes.data || [];
  const guildMembers = allGuildMembersRes.data || [];
  const recentJoins = buildRecentJoinRows(memberJoinsRes.data || [], guildMembers);
  const warns = warnsRowsRes.data || [];
  const raids = raidsRowsRes.data || [];
  const fraud = fraudRowsRes.data || [];

  return {
    tickets: sortTickets(visibleTickets, "priority_desc"),
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
    memberRows: guildMembers,
    memberCounts: {
      tracked:
        (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
      active: activeMembersCountRes.count || 0,
      former: formerMembersCountRes.count || 0,
      pendingVerification: pendingVerificationCountRes.count || 0,
      verified: verifiedMembersCountRes.count || 0,
      staff: staffMembersCountRes.count || 0,
    },
    counts: {
      openTickets: openTicketsCount,
      warnsToday: warnsTodayRes.count || 0,
      raidAlerts: raidAlertsRes.count || 0,
      fraudFlags: fraudFlagsRes.count || 0,
    },
  };
}

async function getUserDashboardData(session) {
  const supabase = createServerSupabase();
  const guildId = env.guildId || "";

  const discordId = String(
    session?.user?.discord_id ||
      session?.user?.id ||
      session?.discordUser?.id ||
      ""
  ).trim();

  const username =
    session?.user?.username ||
    session?.discordUser?.username ||
    session?.user?.global_name ||
    session?.user?.name ||
    "Member";

  const viewerAvatar =
    session?.user?.avatar_url ||
    session?.user?.avatar ||
    session?.user?.image ||
    session?.user?.picture ||
    session?.discordUser?.avatar_url ||
    session?.discordUser?.avatar ||
    null;

  const viewerDisplayName =
    session?.member?.display_name ||
    session?.discordUser?.global_name ||
    session?.user?.username ||
    session?.discordUser?.username ||
    "Member";

  if (!discordId) {
    return {
      viewer: {
        discord_id: null,
        username,
        display_name: viewerDisplayName,
        avatar_url: viewerAvatar,
        avatar: viewerAvatar,
        image: viewerAvatar,
        picture: viewerAvatar,
        isStaff: false,
      },
      member: sanitizeUserMember(null, session),
      openTicket: null,
      recentTickets: [],
      categories: [],
      verificationFlags: [],
      vcVerifySession: null,
    };
  }

  const [
    memberRes,
    ticketsRes,
    categoriesRes,
    flagsRes,
    vcRes,
  ] = await Promise.all([
    supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .maybeSingle(),

    supabase
      .from("tickets")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("updated_at", { ascending: false })
      .limit(25),

    supabase
      .from("ticket_categories")
      .select("*")
      .eq("guild_id", guildId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),

    supabase
      .from("verification_flags")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", discordId)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("vc_verify_sessions")
      .select("*")
      .eq("owner_id", Number(discordId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const member = sanitizeUserMember(memberRes.data || null, session);

  const allTickets = (ticketsRes.data || []).map((ticket) => ({
    ...ticket,
    priority: ticket.priority || derivePriority(ticket),
    channel_id: ticket.channel_id || ticket.discord_thread_id || null,
  }));

  const visibleTickets = allTickets
    .filter((ticket) => !shouldHideStaleTicket(ticket))
    .map(sanitizeUserTicket);

  const openTicket =
    visibleTickets.find((ticket) =>
      ["open", "claimed"].includes(String(ticket?.status || "").toLowerCase())
    ) || null;

  return {
    viewer: {
      discord_id: discordId,
      username,
      display_name: viewerDisplayName,
      avatar_url: viewerAvatar,
      avatar: viewerAvatar,
      image: viewerAvatar,
      picture: viewerAvatar,
      isStaff: false,
      verification_label:
        session?.member?.verification_label ||
        (member?.has_staff_role
          ? "Staff"
          : member?.has_verified_role
            ? "Verified"
            : member?.has_unverified
              ? "Pending Verification"
              : "Not Synced Yet"),
      access_label:
        session?.member?.access_label ||
        (member?.has_staff_role
          ? "Staff"
          : member?.has_verified_role
            ? "Verified"
            : member?.has_unverified
              ? "Limited"
              : "Not Synced Yet"),
      role_names: member?.role_names || [],
    },
    member,
    openTicket,
    recentTickets: sortTickets(visibleTickets, "updated_desc"),
    categories: (categoriesRes.data || []).map(sanitizeUserCategory),
    verificationFlags: (flagsRes.data || []).map(sanitizeVerificationFlag),
    vcVerifySession: sanitizeVcVerifySession(vcRes.data || null),
  };
}

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    if (hasDiscordOAuthConfig()) {
      redirect(getDiscordLoginUrl());
    }

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#09090b",
          color: "white",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <h1 style={{ marginTop: 0 }}>Login Required</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
            Discord login is required to use this dashboard.
          </p>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            OAuth configuration is currently missing or incomplete.
          </p>
        </div>
      </main>
    );
  }

  if (session?.isStaff) {
    const data = await getStaffDashboardData();

    return (
      <div className="shell">
        <Sidebar />
        <main className="content">
          <DashboardClient
            initialData={data}
            staffName={session?.user?.username || env.defaultStaffName}
          />
        </main>
      </div>
    );
  }

  const userData = await getUserDashboardData(session);

  return (
    <main className="content" style={{ minHeight: "100vh" }}>
      <UserDashboardClient initialData={userData} />
    </main>
  );
}
