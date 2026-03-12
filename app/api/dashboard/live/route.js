import { createServerSupabase } from "@/lib/supabase-server"
import { env } from "@/lib/env"
import { sortTickets } from "@/lib/priority"

export const dynamic = "force-dynamic"
export const revalidate = 0

function debugEnabled() {
  return String(process.env.DASHBOARD_DEBUG || "").toLowerCase() === "true"
}

function toJoinedTimestamp(value) {
  const ts = new Date(value || 0).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function mergeJoinWithMember(joinRow, memberRow) {
  return {
    ...(memberRow || {}),
    ...(joinRow || {}),
    user_id: joinRow?.user_id || memberRow?.user_id || "",
    username: memberRow?.username || joinRow?.username || "",
    display_name: memberRow?.display_name || joinRow?.display_name || joinRow?.username || "",
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
    roles: Array.isArray(memberRow?.roles) ? memberRow.roles : [],
    joined_at: joinRow?.joined_at || memberRow?.joined_at || null,
    synced_at: memberRow?.synced_at || null,
    updated_at: memberRow?.updated_at || null
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const guildId = env.guildId || ""

    if (debugEnabled()) {
      console.log("[dashboard/live] env.guildId =", guildId)
      console.log("[dashboard/live] DISCORD_GUILD_ID =", process.env.DISCORD_GUILD_ID || "")
      console.log("[dashboard/live] GUILD_ID =", process.env.GUILD_ID || "")
    }

    const [
      ticketsRes,
      eventsRes,
      rolesRes,
      metricsRes,
      categoriesRes,
      memberJoinsRes,
      recentActiveMembersRes,
      recentFormerMembersRes,
      openTicketsRes,
      warnsTodayRes,
      raidAlertsRes,
      fraudFlagsRes,
      activeMembersCountRes,
      formerMembersCountRes,
      pendingVerificationCountRes,
      verifiedMembersCountRes,
      staffMembersCountRes
    ] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("guild_id", guildId)
        .order("updated_at", { ascending: false })
        .limit(100),

      supabase
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),

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
        .eq("has_staff_role", true)
    ])

    const tickets = ticketsRes.data || []
    const events = eventsRes.data || []
    const roles = rolesRes.data || []
    const metrics = metricsRes.data || []
    const categories = categoriesRes.data || []
    const memberJoins = memberJoinsRes.data || []
    const recentActiveMembers = recentActiveMembersRes.data || []
    const recentFormerMembers = recentFormerMembersRes.data || []

    const joinUserIds = [...new Set(
      memberJoins
        .map((row) => String(row?.user_id || "").trim())
        .filter(Boolean)
    )]

    let recentJoins = []

    if (joinUserIds.length) {
      const { data: joinedMembersData, error: joinedMembersError } = await supabase
        .from("guild_members")
        .select("*")
        .eq("guild_id", guildId)
        .in("user_id", joinUserIds)

      if (joinedMembersError) {
        if (debugEnabled()) {
          console.error("[dashboard/live] joinedMembers hydrate error =", joinedMembersError)
        }

        return Response.json(
          { error: joinedMembersError.message || "Failed to hydrate recent joins." },
          { status: 500 }
        )
      }

      const memberMap = new Map(
        (joinedMembersData || []).map((row) => [String(row.user_id), row])
      )

      recentJoins = memberJoins
        .map((joinRow) => mergeJoinWithMember(joinRow, memberMap.get(String(joinRow.user_id))))
        .sort((a, b) => toJoinedTimestamp(b.joined_at || b.created_at) - toJoinedTimestamp(a.joined_at || a.created_at))
        .slice(0, 25)
    }

    if (debugEnabled()) {
      console.log("[dashboard/live] tickets found =", tickets.length)
      console.log("[dashboard/live] memberJoins found =", memberJoins.length)
      console.log("[dashboard/live] recentJoins hydrated =", recentJoins.length)
      console.log("[dashboard/live] recentActiveMembers found =", recentActiveMembers.length)
      console.log("[dashboard/live] recentFormerMembers found =", recentFormerMembers.length)
      console.log("[dashboard/live] roles found =", roles.length)
      console.log("[dashboard/live] categories found =", categories.length)
      console.log("[dashboard/live] activeMembersCount =", activeMembersCountRes.count || 0)
      console.log("[dashboard/live] formerMembersCount =", formerMembersCountRes.count || 0)
      console.log("[dashboard/live] pendingVerificationCount =", pendingVerificationCountRes.count || 0)
      console.log("[dashboard/live] verifiedMembersCount =", verifiedMembersCountRes.count || 0)
      console.log("[dashboard/live] staffMembersCount =", staffMembersCountRes.count || 0)

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
            created_at: t.created_at
          }))
        )
      } else {
        const rawTicketCheck = await supabase
          .from("tickets")
          .select("id,guild_id,username,category,status,created_at")
          .order("created_at", { ascending: false })
          .limit(10)

        console.log("[dashboard/live] no tickets matched env.guildId")
        console.log("[dashboard/live] latest raw tickets =", rawTicketCheck.data || [])
      }
    }

    const firstError =
      ticketsRes.error ||
      eventsRes.error ||
      rolesRes.error ||
      metricsRes.error ||
      categoriesRes.error ||
      memberJoinsRes.error ||
      recentActiveMembersRes.error ||
      recentFormerMembersRes.error ||
      openTicketsRes.error ||
      warnsTodayRes.error ||
      raidAlertsRes.error ||
      fraudFlagsRes.error ||
      activeMembersCountRes.error ||
      formerMembersCountRes.error ||
      pendingVerificationCountRes.error ||
      verifiedMembersCountRes.error ||
      staffMembersCountRes.error

    if (firstError) {
      if (debugEnabled()) {
        console.error("[dashboard/live] query error =", firstError)
      }

      return Response.json(
        { error: firstError.message || "Failed to load dashboard data." },
        { status: 500 }
      )
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
      memberCounts: {
        tracked: (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
        active: activeMembersCountRes.count || 0,
        former: formerMembersCountRes.count || 0,
        pendingVerification: pendingVerificationCountRes.count || 0,
        verified: verifiedMembersCountRes.count || 0,
        staff: staffMembersCountRes.count || 0
      },
      counts: {
        openTickets: openTicketsRes.count || 0,
        warnsToday: warnsTodayRes.count || 0,
        raidAlerts: raidAlertsRes.count || 0,
        fraudFlags: fraudFlagsRes.count || 0
      },
      debug: debugEnabled()
        ? {
            guildId,
            envGuildId: process.env.GUILD_ID || "",
            envDiscordGuildId: process.env.DISCORD_GUILD_ID || "",
            ticketCount: tickets.length,
            memberCounts: {
              tracked: (activeMembersCountRes.count || 0) + (formerMembersCountRes.count || 0),
              active: activeMembersCountRes.count || 0,
              former: formerMembersCountRes.count || 0,
              pendingVerification: pendingVerificationCountRes.count || 0,
              verified: verifiedMembersCountRes.count || 0,
              staff: staffMembersCountRes.count || 0
            },
            recentJoinsCount: recentJoins.length,
            memberJoinsCount: memberJoins.length
          }
        : undefined
    }

    return Response.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    })
  } catch (error) {
    if (debugEnabled()) {
      console.error("[dashboard/live] fatal error =", error)
    }

    return Response.json(
      { error: error.message || "Failed to load dashboard." },
      { status: 500 }
    )
  }
}
