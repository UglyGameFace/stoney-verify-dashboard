import { NextResponse } from "next/server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"
import { createServerSupabase } from "@/lib/supabase-server"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function discordApi(path) {
  const token = process.env.DISCORD_TOKEN || env.discordToken || ""

  if (!token) {
    throw new Error("Missing DISCORD_TOKEN")
  }

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  })

  if (!res.ok) {
    const text = await res.text()

    const err = new Error(`Discord API ${res.status}: ${text}`)
    err.status = res.status
    throw err
  }

  return res.json()
}

function normalizeStoredRoles(storedMember) {
  if (Array.isArray(storedMember?.roles) && storedMember.roles.length) {
    return storedMember.roles
      .map((role, index) => {
        if (typeof role === "string") {
          return {
            id: storedMember?.role_ids?.[index] || `stored-${index}`,
            name: role,
            position: 0
          }
        }

        if (role && typeof role === "object") {
          return {
            id: role.id || storedMember?.role_ids?.[index] || `stored-${index}`,
            name: role.name || storedMember?.role_names?.[index] || "Unknown Role",
            position: Number(role.position || 0)
          }
        }

        return null
      })
      .filter(Boolean)
  }

  if (Array.isArray(storedMember?.role_names) && storedMember.role_names.length) {
    return storedMember.role_names.map((name, index) => ({
      id: storedMember?.role_ids?.[index] || `stored-${index}`,
      name,
      position: 0
    }))
  }

  return []
}

async function getStoredMember(supabase, guildId, userId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Failed to load stored member record.")
  }

  return data || null
}

export async function GET(req) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const url = new URL(req.url)
    const guildId = env.guildId || ""
    const userId = String(url.searchParams.get("user_id") || "").trim()

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id" }, { status: 500 })
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    let member = null
    let roles = []

    try {
      const results = await Promise.all([
        discordApi(`/guilds/${guildId}/members/${userId}`),
        discordApi(`/guilds/${guildId}/roles`)
      ])

      member = results[0]
      roles = results[1]
    } catch (err) {
      if (err?.status === 404) {
        const storedMember = await getStoredMember(supabase, guildId, userId)
        const storedRoles = normalizeStoredRoles(storedMember)

        const response = NextResponse.json({
          ok: true,
          member: {
            user_id: storedMember?.user_id || userId,
            username: storedMember?.username || "",
            display_name: storedMember?.display_name || "",
            global_name: storedMember?.display_name || "",
            avatar: storedMember?.avatar_hash || "",
            avatar_url: storedMember?.avatar_url || "",
            nickname: storedMember?.nickname || "",
            joined_at: storedMember?.joined_at || null,
            role_ids: Array.isArray(storedMember?.role_ids) ? storedMember.role_ids : storedRoles.map((role) => role.id),
            role_names: Array.isArray(storedMember?.role_names) ? storedMember.role_names : storedRoles.map((role) => role.name),
            top_role:
              storedMember?.top_role ||
              storedMember?.highest_role_name ||
              storedRoles[0]?.name ||
              null,
            roles: storedRoles,
            in_guild: false,
            discord_unavailable: true,
            data_health: storedMember?.data_health || "left_guild",
            role_state: storedMember?.role_state || "left_guild",
            role_state_reason: storedMember?.role_state_reason || "",
            has_unverified: storedMember?.has_unverified || false,
            has_verified_role: storedMember?.has_verified_role || false,
            has_staff_role: storedMember?.has_staff_role || false,
            has_secondary_verified_role: storedMember?.has_secondary_verified_role || false,
            has_cosmetic_only: storedMember?.has_cosmetic_only || false,
            synced_at: storedMember?.synced_at || null,
            updated_at: storedMember?.updated_at || null
          }
        })

        applyAuthCookies(response, refreshedTokens)
        return response
      }

      throw err
    }

    const storedMember = await getStoredMember(supabase, guildId, userId)

    const roleMap = new Map((roles || []).map((role) => [role.id, role]))
    const roleIds = Array.isArray(member.roles) ? member.roles : []

    const fullRoles = roleIds
      .map((roleId) => roleMap.get(roleId))
      .filter(Boolean)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        position: role.position
      }))

    const response = NextResponse.json({
      ok: true,
      member: {
        user_id: member.user?.id || storedMember?.user_id || userId,
        username: member.user?.username || storedMember?.username || "",
        display_name: storedMember?.display_name || member.user?.global_name || member.nick || "",
        global_name: member.user?.global_name || storedMember?.display_name || "",
        avatar: member.user?.avatar || storedMember?.avatar_hash || "",
        avatar_url: storedMember?.avatar_url || "",
        nickname: member.nick || storedMember?.nickname || "",
        joined_at: member.joined_at || storedMember?.joined_at || null,
        role_ids: fullRoles.map((role) => role.id),
        role_names: fullRoles.map((role) => role.name),
        top_role:
          fullRoles[0]?.name ||
          storedMember?.top_role ||
          storedMember?.highest_role_name ||
          null,
        roles: fullRoles,
        in_guild: true,
        discord_unavailable: false,
        data_health: storedMember?.data_health || "ok",
        role_state: storedMember?.role_state || "unknown",
        role_state_reason: storedMember?.role_state_reason || "",
        has_unverified: storedMember?.has_unverified || false,
        has_verified_role: storedMember?.has_verified_role || false,
        has_staff_role: storedMember?.has_staff_role || false,
        has_secondary_verified_role: storedMember?.has_secondary_verified_role || false,
        has_cosmetic_only: storedMember?.has_cosmetic_only || false,
        synced_at: storedMember?.synced_at || null,
        updated_at: storedMember?.updated_at || null
      }
    })

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load member details" },
      { status: 500 }
    )
  }
}
