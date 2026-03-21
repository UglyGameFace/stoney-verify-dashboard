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
  const recentJoins = memberJoinsRes.data || [];
  const recentActiveMembers = recentActiveMembersRes.data || [];
  const recentFormerMembers = recentFormerMembersRes.data || [];
  const guildMembers = allGuildMembersRes.data || [];
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

  if (!discordId) {
    return {
      viewer: {
        discord_id: null,
        username,
        isStaff: false,
      },
      member: null,
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

  const member = memberRes.data || null;
  const allTickets = (ticketsRes.data || []).map((ticket) => ({
    ...ticket,
    priority: ticket.priority || derivePriority(ticket),
    channel_id: ticket.channel_id || ticket.discord_thread_id || null,
  }));

  const visibleTickets = allTickets.filter((ticket) => !shouldHideStaleTicket(ticket));

  const openTicket =
    visibleTickets.find((ticket) =>
      ["open", "claimed"].includes(String(ticket?.status || "").toLowerCase())
    ) || null;

  return {
    viewer: {
      discord_id: discordId,
      username,
      isStaff: false,
    },
    member,
    openTicket,
    recentTickets: sortTickets(visibleTickets, "updated_desc"),
    categories: categoriesRes.data || [],
    verificationFlags: flagsRes.data || [],
    vcVerifySession: vcRes.data || null,
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
