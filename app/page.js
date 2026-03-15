import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardClient from "@/components/DashboardClient";
import { createServerSupabase } from "@/lib/supabase-server";
import { sortTickets, derivePriority } from "@/lib/priority";
import {
  getSession,
  getDiscordLoginUrl,
  hasDiscordOAuthConfig,
} from "@/lib/auth-server";
import { env } from "@/lib/env";

async function getDashboardData() {
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
    openTicketsRes,
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

    supabase
      .from("warns")
      .select("*")
      .eq("guild_id", guildId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(25),

    supabase
      .from("raid_events")
      .select("*")
      .eq("guild_id", guildId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
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

  const tickets = (ticketsRes.data || []).map((ticket) => ({
    ...ticket,
    priority: ticket.priority || derivePriority(ticket),
    channel_id: ticket.channel_id || ticket.discord_thread_id || null,
    transcript_url: ticket.transcript_url || null,
    transcript_message_id: ticket.transcript_message_id || null,
    transcript_channel_id: ticket.transcript_channel_id || null,
  }));

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
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 40);

  const roles = (rolesRes.data || []).map((role) => ({
    ...role,
  }));

  const metrics = metricsRes.data || [];
  const categories = categoriesRes.data || [];
  const recentJoins = memberJoinsRes.data || [];
  const recentActiveMembers = recentActiveMembersRes.data || [];
  const recentFormerMembers = recentFormerMembersRes.data || [];
  const guildMembers = allGuildMembersRes.data || [];
  const warns = warnsRowsRes.data || [];
  const raids = raidsRowsRes.data || [];
  const fraud = fraudRowsRes.data || [];

  return {
    tickets: sortTickets(tickets, "priority_desc"),
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
  };
}

export default async function HomePage() {
  const session = await getSession();

  if (!session?.isStaff) {
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
            Discord staff login is required to use this dashboard.
          </p>
          <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
            OAuth configuration is currently missing or incomplete.
          </p>
        </div>
      </main>
    );
  }

  const data = await getDashboardData();

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
