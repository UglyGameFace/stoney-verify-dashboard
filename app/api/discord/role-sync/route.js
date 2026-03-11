import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { fetchGuildRoles, discordBotFetch, normalizeMember } from "@/lib/discord-api"
import { env } from "@/lib/env"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function fetchGuildMemberBatch(guildId, after = "0", limit = 500) {
  return discordBotFetch(`/guilds/${guildId}/members?limit=${limit}&after=${after}`)
}

export async function POST() {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const guildId = env.guildId || "demo"
    const batchLimit = Math.min(Math.max(Number(env.botAutoSyncBatchLimit || 500), 100), 1000)

    const roles = await fetchGuildRoles(guildId)
    const roleMap = new Map(roles.map((role) => [role.id, role]))
    const roleCounts = new Map()

    const allMembers = []
    let after = "0"

    while (true) {
      const batch = await fetchGuildMemberBatch(guildId, after, batchLimit)
      const members = Array.isArray(batch) ? batch : []

      if (!members.length) {
        break
      }

      allMembers.push(...members)

      for (const member of members) {
        for (const roleId of member.roles || []) {
          roleCounts.set(roleId, (roleCounts.get(roleId) || 0) + 1)
        }
      }

      if (members.length < batchLimit) {
        break
      }

      after = members[members.length - 1].user.id
    }

    const now = new Date().toISOString()

    const normalizedMembers = allMembers.map((member) => ({
      guild_id: guildId,
      ...normalizeMember(member, roleMap),
      in_guild: true,
      synced_at: now,
      updated_at: now
    }))

    const roleRows = roles.map((role) => ({
      guild_id: guildId,
      role_id: role.id,
      name: role.name,
      position: role.position,
      member_count: roleCounts.get(role.id) || 0
    }))

    const { error: roleError } = await supabase
      .from("guild_roles")
      .upsert(roleRows, { onConflict: "guild_id,role_id" })

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }

    const { error: markLeftError } = await supabase
      .from("guild_members")
      .update({
        in_guild: false,
        data_health: "left_guild",
        role_state: "left_guild",
        role_state_reason: "Not present in latest Discord role sync.",
        synced_at: now,
        updated_at: now
      })
      .eq("guild_id", guildId)

    if (markLeftError) {
      return NextResponse.json({ error: markLeftError.message }, { status: 500 })
    }

    if (normalizedMembers.length) {
      const { error: memberError } = await supabase
        .from("guild_members")
        .upsert(normalizedMembers, { onConflict: "guild_id,user_id" })

      if (memberError) {
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }
    }

    await supabase.from("audit_events").insert({
      title: "Full role sync completed",
      description: `Synced ${roles.length} roles and ${normalizedMembers.length} members from Discord`,
      event_type: "role_sync"
    })

    const response = NextResponse.json({
      ok: true,
      syncedRoles: roles.length,
      syncedMembers: normalizedMembers.length,
      has_more: false,
      next_after: null
    })

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Role sync failed" },
      { status: 500 }
    )
  }
}
