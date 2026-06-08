import { createHash } from "node:crypto"
import { env } from "@/lib/env"

const API_BASE = "https://discord.com/api/v10"

const discordCache = globalThis.__dankShieldDiscordCache || new Map()
const discordInFlight = globalThis.__dankShieldDiscordInFlight || new Map()
const discordCooldowns = globalThis.__dankShieldDiscordCooldowns || new Map()

globalThis.__dankShieldDiscordCache = discordCache
globalThis.__dankShieldDiscordInFlight = discordInFlight
globalThis.__dankShieldDiscordCooldowns = discordCooldowns

export class DiscordRateLimitError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = "DiscordRateLimitError"
    this.status = 429
    this.retryAfter = Number(details.retryAfter || 1)
    this.path = details.path || ""
    this.scope = details.scope || "unknown"
  }
}

export class DiscordAuthError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = "DiscordAuthError"
    this.status = Number(details.status || 401)
    this.path = details.path || ""
    this.scope = details.scope || "unknown"
  }
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function hashToken(value) {
  const text = safeText(value)
  if (!text) return "anonymous"
  return createHash("sha256").update(text).digest("hex").slice(0, 18)
}

function requestMethod(init = {}) {
  return safeText(init.method || "GET", "GET").toUpperCase()
}

function isCacheable(init = {}) {
  return requestMethod(init) === "GET"
}

function getCacheTtlMs(path) {
  const cleanPath = safeText(path)
  if (cleanPath === "/users/@me") return 5 * 60 * 1000
  if (cleanPath === "/users/@me/guilds") return 60 * 1000
  if (cleanPath.includes("/roles")) return 2 * 60 * 1000
  if (cleanPath.includes("/members/")) return 45 * 1000
  if (cleanPath.includes("/members?")) return 45 * 1000
  if (cleanPath.includes("/members/search")) return 20 * 1000
  return 30 * 1000
}

function getStaleTtlMs(path) {
  const cleanPath = safeText(path)
  if (cleanPath === "/users/@me") return 20 * 60 * 1000
  if (cleanPath === "/users/@me/guilds") return 10 * 60 * 1000
  if (cleanPath.includes("/roles")) return 10 * 60 * 1000
  if (cleanPath.includes("/members/")) return 5 * 60 * 1000
  if (cleanPath.includes("/members?")) return 3 * 60 * 1000
  if (cleanPath.includes("/members/search")) return 60 * 1000
  return 2 * 60 * 1000
}

function cacheKey(scope, path, token, init = {}) {
  return [scope, requestMethod(init), safeText(path), hashToken(token || "")].join(":")
}

function cloneData(value) {
  if (value == null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function getFreshCached(key) {
  const row = discordCache.get(key)
  if (!row) return null
  if (Date.now() <= row.expiresAt) return cloneData(row.data)
  return null
}

function getStaleCached(key) {
  const row = discordCache.get(key)
  if (!row) return null
  if (Date.now() <= row.staleUntil) return cloneData(row.data)
  return null
}

function setCached(key, path, data) {
  const ttl = getCacheTtlMs(path)
  const staleTtl = getStaleTtlMs(path)
  discordCache.set(key, {
    data: cloneData(data),
    savedAt: Date.now(),
    expiresAt: Date.now() + ttl,
    staleUntil: Date.now() + staleTtl,
  })
}

function parseRetryAfter(headers, bodyText) {
  const headerValue = headers?.get?.("retry-after") || headers?.get?.("x-ratelimit-reset-after")
  const headerNumber = Number(headerValue)
  if (Number.isFinite(headerNumber) && headerNumber > 0) return headerNumber

  try {
    const json = JSON.parse(bodyText || "{}")
    const retryAfter = Number(json?.retry_after)
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter
  } catch {
    // ignore parse errors
  }

  return 1
}

function friendlyDiscordError(status, bodyText, path, scope) {
  if (status === 401) {
    if (scope === "bot") {
      return "Discord rejected the dashboard bot token while checking the selected server. Check the DISCORD_TOKEN/Vercel bot credential and redeploy."
    }
    return "Discord rejected the user OAuth token for this dashboard request. Use Account → Reset Login once, then sign in again."
  }
  if (status === 403) {
    if (scope === "bot") return "Discord blocked the bot request for the selected server. Check bot permissions and server membership."
    return "Discord blocked this user request. Check your account permissions and selected server."
  }
  if (status === 404) return "Discord could not find the requested server or member."
  if (status === 429) return "Discord is rate limiting dashboard requests. Please wait a moment and try again."

  const text = safeText(bodyText)
  if (!text) return `Discord API request failed with status ${status}.`
  return `Discord API ${status}: ${text.length > 220 ? `${text.slice(0, 220)}…` : text}`
}

function discordDefaultAvatarUrl(user = {}) {
  const discriminator = Number(user?.discriminator || 0)
  const fallbackIndex = Number.isFinite(discriminator) ? discriminator % 5 : 0
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`
}

function discordAvatarUrl(user = {}) {
  const userId = safeText(user?.id)
  const avatar = safeText(user?.avatar)
  if (!userId) return null
  if (!avatar) return discordDefaultAvatarUrl(user)
  const extension = avatar.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=128`
}

function roleRowsForMember(roleIds = [], roleMap = new Map()) {
  return roleIds
    .map((roleId) => roleMap.get(String(roleId)))
    .filter(Boolean)
    .sort((a, b) => Number(b?.position || 0) - Number(a?.position || 0))
}

function roleNamesForMember(roleRows = []) {
  return roleRows.map((role) => safeText(role?.name)).filter(Boolean)
}

function inferCoreRoleFlags(roleNames = []) {
  const lowered = roleNames.map((name) => name.toLowerCase())
  const hasStaffRole = lowered.some((name) => /\b(staff|mod|moderator|admin|owner)\b/i.test(name))
  const hasUnverified = lowered.some((name) => name.includes("unverified"))
  const hasVerifiedRole = lowered.some((name) => name.includes("verified") && !name.includes("unverified"))
  const hasSecondaryVerifiedRole = lowered.some((name) => /\b(resident|member)\b/i.test(name))
  const hasCosmeticOnly = roleNames.length > 0 && !hasStaffRole && !hasUnverified && !hasVerifiedRole && !hasSecondaryVerifiedRole
  return {
    has_unverified: hasUnverified,
    has_verified_role: hasVerifiedRole || hasSecondaryVerifiedRole,
    has_secondary_verified_role: hasSecondaryVerifiedRole,
    has_staff_role: hasStaffRole,
    has_cosmetic_only: hasCosmeticOnly,
  }
}

function inferRoleState(flags, hasAnyRole) {
  if (flags.has_staff_role && flags.has_unverified) {
    return {
      data_health: "missing_role",
      role_state: "staff_conflict",
      role_state_reason: "Member has both Staff and Unverified.",
    }
  }
  if (flags.has_staff_role) {
    return {
      data_health: "ok",
      role_state: "staff_ok",
      role_state_reason: "Member has staff access with no unverified conflict.",
    }
  }
  if (flags.has_verified_role && flags.has_unverified) {
    return {
      data_health: "missing_role",
      role_state: "verified_conflict",
      role_state_reason: "Member has both Verified and Unverified roles.",
    }
  }
  if (flags.has_verified_role) {
    return {
      data_health: "ok",
      role_state: "verified_ok",
      role_state_reason: "Member has a valid verified role set.",
    }
  }
  if (flags.has_unverified) {
    return {
      data_health: "ok",
      role_state: "unverified_only",
      role_state_reason: "Member is pending verification and only has unverified access.",
    }
  }
  if (flags.has_cosmetic_only) {
    return {
      data_health: "missing_role",
      role_state: "booster_only",
      role_state_reason: "Member has roles but no core verification role.",
    }
  }
  if (!hasAnyRole) {
    return {
      data_health: "missing_role",
      role_state: "missing_unverified",
      role_state_reason: "Member has no tracked roles. Expected at least an unverified role.",
    }
  }
  return {
    data_health: "unknown",
    role_state: "unknown",
    role_state_reason: "Unable to determine member role state from current role set.",
  }
}

export function normalizeMember(member = {}, roleMap = new Map()) {
  const user = member?.user || {}
  const userId = safeText(user?.id)
  const username = safeText(user?.username)
  const displayName = safeText(user?.global_name || member?.nick || username, username || "Member")
  const roleIds = Array.isArray(member?.roles) ? member.roles.map(String).filter(Boolean) : []
  const fullRoles = roleRowsForMember(roleIds, roleMap)
  const roleNames = roleNamesForMember(fullRoles)
  const highestRole = fullRoles[0] || null
  const flags = inferCoreRoleFlags(roleNames)
  const roleState = inferRoleState(flags, roleIds.length > 0)

  return {
    user_id: userId,
    username,
    display_name: displayName,
    global_name: displayName,
    avatar: safeText(user?.avatar) || null,
    avatar_url: discordAvatarUrl(user),
    nickname: safeText(member?.nick) || null,
    joined_at: member?.joined_at || null,
    role_ids: roleIds,
    role_names: roleNames,
    roles: fullRoles,
    top_role: safeText(highestRole?.name) || null,
    highest_role_id: safeText(highestRole?.id) || null,
    highest_role_name: safeText(highestRole?.name) || null,
    in_guild: true,
    has_any_role: roleIds.length > 0,
    data_health: roleState.data_health,
    role_state: roleState.role_state,
    role_state_reason: roleState.role_state_reason,
    ...flags,
  }
}

async function protectedDiscordFetch({ scope, path, token, authorization, init = {} }) {
  const cleanPath = safeText(path)
  const key = cacheKey(scope, cleanPath, token || authorization, init)
  const cacheable = isCacheable(init)
  const now = Date.now()
  const cooldownUntil = Number(discordCooldowns.get(key) || 0)

  if (cacheable) {
    const fresh = getFreshCached(key)
    if (fresh) return fresh

    if (cooldownUntil && now < cooldownUntil) {
      const stale = getStaleCached(key)
      if (stale) return stale
      const retryAfter = Math.max(1, Math.ceil((cooldownUntil - now) / 1000))
      throw new DiscordRateLimitError(`Discord is rate limiting this request. Retry in about ${retryAfter}s.`, {
        retryAfter,
        path: cleanPath,
        scope,
      })
    }

    if (discordInFlight.has(key)) {
      return cloneData(await discordInFlight.get(key))
    }
  }

  const promise = (async () => {
    const res = await fetch(`${API_BASE}${cleanPath}`, {
      ...init,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        ...(init.headers || {})
      },
      cache: "no-store"
    })

    const bodyText = await res.text()

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = parseRetryAfter(res.headers, bodyText)
        discordCooldowns.set(key, Date.now() + Math.ceil(retryAfter * 1000))
        const stale = cacheable ? getStaleCached(key) : null
        if (stale) return stale
        throw new DiscordRateLimitError("Discord is rate limiting dashboard requests. Please wait a moment and try again.", {
          retryAfter,
          path: cleanPath,
          scope,
        })
      }

      if (res.status === 401 || res.status === 403) {
        throw new DiscordAuthError(friendlyDiscordError(res.status, bodyText, cleanPath, scope), {
          status: res.status,
          path: cleanPath,
          scope,
        })
      }

      throw new Error(friendlyDiscordError(res.status, bodyText, cleanPath, scope))
    }

    const data = bodyText ? JSON.parse(bodyText) : null
    if (cacheable) setCached(key, cleanPath, data)
    return data
  })()

  if (cacheable) discordInFlight.set(key, promise)

  try {
    return cloneData(await promise)
  } finally {
    if (cacheable) discordInFlight.delete(key)
  }
}

export async function discordBotFetch(path, init = {}) {
  return protectedDiscordFetch({
    scope: "bot",
    path,
    token: env.discordToken,
    authorization: `Bot ${env.discordToken}`,
    init,
  })
}

export async function discordUserFetch(path, accessToken, init = {}) {
  return protectedDiscordFetch({
    scope: "user",
    path,
    token: accessToken,
    authorization: `Bearer ${accessToken}`,
    init,
  })
}

export async function fetchGuildRoles(guildId = env.guildId) {
  const roles = await discordBotFetch(`/guilds/${guildId}/roles`)
  return roles.filter((role) => role.name !== "@everyone").sort((a, b) => b.position - a.position)
}

export async function fetchGuildMembers(guildId = env.guildId, limit = 1000) {
  let after = "0"
  const rows = []

  while (true) {
    const page = await discordBotFetch(`/guilds/${guildId}/members?limit=${limit}&after=${after}`)
    rows.push(...page)
    if (page.length < limit) break
    after = page[page.length - 1].user.id
  }

  return rows
}

export async function searchGuildMembers(query, guildId = env.guildId, limit = 12) {
  if (!query) return []
  return discordBotFetch(`/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=${limit}`)
}
