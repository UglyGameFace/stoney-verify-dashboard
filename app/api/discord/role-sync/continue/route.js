import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { fetchGuildRoles, discordBotFetch, normalizeMember } from "@/lib/discord-api"
import { env } from "@/lib/env"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

async function fetchGuildMemberBatch(guildId, after = "0", limit = 500) {
  return discordBotFetch(`/guilds/${guildId}/members?limit=${limit}&after=${after}`)
}

export async function GET(request) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const guildId = env.guildId || "demo"
    const batchLimit = Math.min(Math.max(env.botAutoSyncBatchLimit || 500, 100), 1000)
    const url = new URL(request.url)
    const after = url.searchParams.get("after") || "0"

    const roles = await fetchGuildRoles(guildId)
    const roleMap = new Map(roles.map((role) => [role.id, role]))
    const page = await fetchGuildMemberBatch(guildId, after, batchLimit)

    const normalizedMembers = page.map((member) => ({
      guild_id: guildId,
      ...normalizeMember(member, roleMap),
      updated_at: new Date().toISOString()
    }))

    if (normalizedMembers.length) {
      const { error: memberError } = await supabase.from("guild_members").upsert(normalizedMembers, { onConflict: "guild_id,user_id" })
      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    const nextAfter = page.length ? page[page.length - 1].user.id : null
    const hasMore = page.length === batchLimit

    await supabase.from("audit_events").insert({
      title: "Continuation role sync completed",
      description: `Synced ${normalizedMembers.length} additional members from Discord`,
      event_type: "role_sync_continue"
    })

    const response = NextResponse.json({
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
