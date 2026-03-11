import { cookies } from "next/headers"
import { env, assertOAuthEnv } from "@/lib/env"
import { discordUserFetch, discordBotFetch, fetchGuildRoles } from "@/lib/discord-api"

const ACCESS_COOKIE = "discord_access_token"
const REFRESH_COOKIE = "discord_refresh_token"
const EXPIRES_COOKIE = "discord_expires_at"

export function getCookieOptions(maxAgeSec) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: maxAgeSec
  }
}

export function hasDiscordOAuthConfig() {
  return Boolean(
    env.discordClientId &&
    env.discordClientSecret &&
    env.discordRedirectUri &&
    env.guildId &&
    env.appUrl
  )
}

export function getDiscordLoginUrl() {
  assertOAuthEnv()

  const params = new URLSearchParams({
    client_id: env.discordClientId,
    response_type: "code",
    redirect_uri: env.discordRedirectUri,
    scope: "identify guilds guilds.members.read"
  })

  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code) {
  assertOAuthEnv()

  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.discordRedirectUri
  })

  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store"
  })

  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${await res.text()}`)
  }

  return res.json()
}

export async function refreshAccessToken(refreshToken) {
  assertOAuthEnv()

  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  })

  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store"
  })

  if (!res.ok) {
    throw new Error(`OAuth refresh failed: ${await res.text()}`)
  }

  return res.json()
}

export async function buildSession(accessToken) {
  const user = await discordUserFetch("/users/@me", accessToken)
  const member = await discordBotFetch(`/guilds/${env.guildId}/members/${user.id}`)
  const roles = await fetchGuildRoles(env.guildId)

  const roleMap = new Map(roles.map((r) => [r.id, r]))
  const memberRoleIds = member.roles || []

  const memberRoleNames = memberRoleIds
    .map((roleId) => roleMap.get(roleId))
    .filter(Boolean)
    .sort((a, b) => b.position - a.position)
    .map((r) => r.name)

  const isStaff =
    memberRoleIds.some((id) => env.staffRoleIds.includes(id)) ||
    memberRoleNames.some((name) => env.staffRoleNames.includes(name))

  return {
    user: {
      id: user.id,
      username: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : null
    },
    member: {
      nickname: member.nick || null,
      roleIds: memberRoleIds,
      roles: memberRoleNames
    },
    isStaff
  }
}

export async function getSession() {
  const accessToken = cookies().get(ACCESS_COOKIE)?.value
  if (!accessToken) return null

  try {
    return await buildSession(accessToken)
  } catch {
    return null
  }
}

export async function requireStaffSessionForRoute() {
  const cookieStore = cookies()
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value
  const expiresAt = Number(cookieStore.get(EXPIRES_COOKIE)?.value || 0)
  let refreshedTokens = null

  if (!accessToken && !refreshToken) {
    throw new Error("Unauthorized")
  }

  const shouldRefresh = !accessToken || (expiresAt && Date.now() > expiresAt - 60000)

  if (shouldRefresh) {
    if (!refreshToken) throw new Error("Unauthorized")
    refreshedTokens = await refreshAccessToken(refreshToken)
    accessToken = refreshedTokens.access_token
  }

  const session = await buildSession(accessToken)

  if (!session?.isStaff) {
    throw new Error("Unauthorized")
  }

  return { session, refreshedTokens }
}

export function applyAuthCookies(response, tokenPayload) {
  if (!tokenPayload) return response

  const expiresAtMs = Date.now() + (tokenPayload.expires_in || 604800) * 1000

  response.cookies.set(
    ACCESS_COOKIE,
    tokenPayload.access_token,
    getCookieOptions(tokenPayload.expires_in || 604800)
  )

  if (tokenPayload.refresh_token) {
    response.cookies.set(
      REFRESH_COOKIE,
      tokenPayload.refresh_token,
      getCookieOptions(60 * 60 * 24 * 30)
    )
  }

  response.cookies.set(
    EXPIRES_COOKIE,
    String(expiresAtMs),
    getCookieOptions(60 * 60 * 24 * 30)
  )

  return response
}

export function clearAuthCookies(response) {
  response.cookies.set(ACCESS_COOKIE, "", getCookieOptions(0))
  response.cookies.set(REFRESH_COOKIE, "", getCookieOptions(0))
  response.cookies.set(EXPIRES_COOKIE, "", getCookieOptions(0))
  return response
}
