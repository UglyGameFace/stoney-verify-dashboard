import { createServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { sortTickets } from "@/lib/priority";
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
    previous_usernames: Array.isArray(row?.previous_usernames) ? row.previous_usernames : [],
    previous_display_names: Array.isArray(row?.previous_display_names) ? row.previous_display_names : [],
    previous_nicknames: Array.isArray(row?.previous_nicknames) ? row.previous_nicknames : [],
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
    description: buildAuditDescription(row),
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
    description: row?.description || "",
    event_type: row?.event_type || "audit_event",
    related_id: row?.related_id || null,
    created_at: row?.created_at || null,
    actor_id: null,
    meta: {},
    source: "audit_events",
  };
}

function buildTimeline(auditLogs, auditEvents, guildMembers) {
  const memberMap = new Map(
    guildMembers.map((member) => [String(member.user_id), member])
  );

  const merged = [
    ...safeArray(auditLogs).map(mapAuditLogToTimeline),
    ...safeArray(auditEvents).map(mapAuditEventToTimeline),
  ]
    .sort((a, b) => toTime(b.created_at) - toTime(a.created_at))
    .slice(0, 40)
    .map((event) => {
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

  return merged;
}

export async function GET() {
  try {
    await requireStaffSessionForRoute();

    const supabase = createServerSupabase();
    const guildId = env.guildId || "";

    if (debugEnabled()) {
      console.log("[dashboard/live] env.guildId =", guildId);
      console.log("[dashboard/live] DISCORD_GUILD_ID =", process.env.DISCORD_GUILD_ID || "");
      console.log("[dashboard/live] GUILD_ID =", process.env.GUILD_ID || "");
    }

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
      openTicketsRes,
      warnsTodayRes,
      raidAlertsRes,
      fraudFlagsRes,
      activeMembersCountRes,
      formerMembersCountRes,
      pendingVerificationCountRes,
      verifiedMembersCountRes,
      staffMembersCountRes,
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
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .in("status", ["open", "claimed"]),

      supabase
        .from("warns")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      supabase
        .from("raid_events")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

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
    ]);

    const firstError =
      ticketsRes.error ||
      auditLogsRes.error ||
      auditEventsRes.error ||
      rolesRes.error ||
      metricsRes.error ||
      categoriesRes.error ||
      memberJoinsRes.error ||
      recentActiveMembersRes.error ||
      recentFormerMembersRes.error ||
      allGuildMembersRes.error ||
      openTicketsRes.error ||
      warnsTodayRes.error ||
      raidAlertsRes.error ||
      fraudFlagsRes.error ||
      activeMembersCountRes.error ||
      formerMembersCountRes.error ||
      pendingVerificationCountRes.error ||
      verifiedMembersCountRes.error ||
      staffMembersCountRes.error;

    if (firstError) {
      if (debugEnabled()) {
        console.error("[dashboard/live] query error =", firstError);
      }

      return Response.json(
        { error: firstError.message || "Failed to load dashboard data." },
        { status: 500 }
      );
    }

    const tickets = safeArray(ticketsRes.data).map(mapTicket);
    const auditLogs = safeArray(auditLogsRes.data);
    const auditEvents = safeArray(auditEventsRes.data);
    const metrics = metricsRes.data || [];
    const categories = categoriesRes.data || [];
    const memberJoins = memberJoinsRes.data || [];
    const recentActiveMembers = safeArray(recentActiveMembersRes.data).map(mapGuildMember);
    const recentFormerMembers = safeArray(recentFormerMembersRes.data).map(mapGuildMember);
    const guildMembers = safeArray(allGuildMembersRes.data).map(mapGuildMember);

    const events = buildTimeline(auditLogs, auditEvents, guildMembers);

    const roles = safeArray(rolesRes.data).map((role) => ({
      ...role,
      member_count: Math.max(
        Number(role?.member_count || 0),
        computeRoleMemberCount(role, guildMembers)
      ),
    }));

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

    if (debugEnabled()) {
      console.log("[dashboard/live] tickets found =", tickets.length);
      console.log("[dashboard/live] auditLogs found =", auditLogs.length);
      console.log("[dashboard/live] auditEvents found =", auditEvents.length);
      console.log("[dashboard/live] merged timeline events =", events.length);
      console.log("[dashboard/live] memberJoins found =", memberJoins.length);
      console.log("[dashboard/live] recentJoins hydrated =", recentJoins.length);
      console.log("[dashboard/live] recentActiveMembers found =", recentActiveMembers.length);
      console.log("[dashboard/live] recentFormerMembers found =", recentFormerMembers.length);
      console.log("[dashboard/live] guildMembers found =", guildMembers.length);
      console.log("[dashboard/live] roles found =", roles.length);
      console.log("[dashboard/live] categories found =", categories.length);
      console.log("[dashboard/live] activeMembersCount =", activeMembersCountRes.count || 0);
      console.log("[dashboard/live] formerMembersCount =", formerMembersCountRes.count || 0);
      console.log("[dashboard/live] pendingVerificationCount =", pendingVerificationCountRes.count || 0);
      console.log("[dashboard/live] verifiedMembersCount =", verifiedMembersCountRes.count || 0);
      console.log("[dashboard/live] staffMembersCount =", staffMembersCountRes.count || 0);

      if (tickets.length) {
        console.log(
          "[dashboard/live] latest ticket snapshot =",
          tickets.slice(0, 3).map((t) => ({
            id: t.id,
            guild_id: t.guild_id,
            username: t.username,
            category: t.category,
            status: t.status,
            discord_thread_id: t.discord_thread_id || null,
            channel_id: t.channel_id || null,
            is_ghost: Boolean(t.is_ghost),
            created_at: t.created_at,
          }))
        );
      } else {
        const rawTicketCheck = await supabase
          .from("tickets")
          .select("id,guild_id,username,category,status,created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        console.log("[dashboard/live] no tickets matched env.guildId");
        console.log("[dashboard/live] latest raw tickets =", rawTicketCheck.data || []);
      }
    }

    const payload = {
      tickets: sortTickets(tickets, "priority_desc"),
      events,
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
        tracked: (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
        active: activeMembersCountRes.count || 0,
        former: formerMembersCountRes.count || 0,
        pendingVerification: pendingVerificationCountRes.count || 0,
        verified: verifiedMembersCountRes.count || 0,
        staff: staffMembersCountRes.count || 0,
      },
      counts: {
        openTickets: openTicketsRes.count || 0,
        warnsToday: warnsTodayRes.count || 0,
        raidAlerts: raidAlertsRes.count || 0,
        fraudFlags: fraudFlagsRes.count || 0,
      },
      debug: debugEnabled()
        ? {
            guildId,
            envGuildId: process.env.GUILD_ID || "",
            envDiscordGuildId: process.env.DISCORD_GUILD_ID || "",
            ticketCount: tickets.length,
            guildMembersCount: guildMembers.length,
            timelineCount: events.length,
            memberCounts: {
              tracked: (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
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
      { status: unauthorized ? 401 : 500 }
    );
  }
}
