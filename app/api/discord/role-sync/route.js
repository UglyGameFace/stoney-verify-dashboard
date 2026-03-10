import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { fetchGuildRoles, discordBotFetch, normalizeMember } from "@/lib/discord-api"
import { env } from "@/lib/env"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

async function fetchGuildMemberBatch(guildId, after = "0", limit = 500) {
  return discordBotFetch(`/guilds/${guildId}/members?limit=${limit}&after=${after}`)
}

export async function POST() {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const guildId = env.guildId || "demo"
    const batchLimit = Math.min(Math.max(env.botAutoSyncBatchLimit || 500, 100), 1000)

    const roles = await fetchGuildRoles(guildId)
    const roleMap = new Map(roles.map((role) => [role.id, role]))
    const firstPage = await fetchGuildMemberBatch(guildId, "0", batchLimit)

    const roleCounts = new Map()
    for (const member of firstPage) {
      for (const roleId of member.roles || []) {
        roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1)
      }
    }

    const normalizedMembers = firstPage.map((member) => ({
      guild_id: guildId,
      ...normalizeMember(member, roleMap),
      updated_at: new Date().toISOString()
    }))

    const roleRows = roles.map((role) => ({
      guild_id: guildId,
      role_id: role.id,
      name: role.name,
      position: role.position,
      member_count: roleCounts.get(role.id) || 0
    }))

    const { error: roleError } = await supabase.from("guild_roles").upsert(roleRows, { onConflict: "guild_id,role_id" })
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })

    if (normalizedMembers.length) {
      const { error: memberError } = await supabase.from("guild_members").upsert(normalizedMembers, { onConflict: "guild_id,user_id" })
      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    await supabase.from("audit_events").insert({
      title: "Partial role sync completed",
      description: `Synced ${roles.length} roles and ${normalizedMembers.length} members from Discord (first batch)`,
      event_type: "role_sync"
    })

    const nextAfter = firstPage.length ? firstPage[firstPage.length - 1].user.id : null
    const hasMore = firstPage.length === batchLimit

    const response = NextResponse.json({
      syncedRoles: roles.length,
      syncedMembers: normalizedMembers.length,
      next_after: hasMore ? nextAfter : null,
      has_more: hasMore
    })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
