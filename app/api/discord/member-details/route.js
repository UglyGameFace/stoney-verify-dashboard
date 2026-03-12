import { NextResponse } from "next/server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"
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

export async function GET(req) {
  try {
    const { refreshedTokens } = await requireStaffSessionForRoute()
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
      // Handle Discord Unknown Member (user left / kicked / banned)
      if (err?.status === 404) {
        const response = NextResponse.json({
          ok: true,
          member: {
            user_id: userId,
            username: "",
            global_name: "",
            avatar: "",
            nickname: "",
            joined_at: null,
            role_ids: [],
            role_names: [],
            top_role: null,
            roles: [],
            in_guild: false,
            discord_unavailable: true
          }
        })

        applyAuthCookies(response, refreshedTokens)
        return response
      }

      throw err
    }

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
        user_id: member.user?.id || userId,
        username: member.user?.username || "",
        global_name: member.user?.global_name || "",
        avatar: member.user?.avatar || "",
        nickname: member.nick || "",
        joined_at: member.joined_at || null,
        role_ids: fullRoles.map((role) => role.id),
        role_names: fullRoles.map((role) => role.name),
        top_role: fullRoles[0]?.name || null,
        roles: fullRoles,
        in_guild: true
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
