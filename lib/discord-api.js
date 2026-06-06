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
  return [scope, requestMethod(init), safeText(path), hashToken(token)].join(":")
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
