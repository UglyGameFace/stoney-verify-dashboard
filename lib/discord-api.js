import { env } from "@/lib/env"

const API_BASE = "https://discord.com/api/v10"

export async function discordBotFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${env.discordToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  })

  if (!res.ok) {
    throw new Error(`Discord API ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function discordUserFetch(path, accessToken, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  })

  if (!res.ok) {
    throw new Error(`Discord user API ${res.status}: ${await res.text()}`)
  }
  return res.json()
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
  if (!query?.trim()) return []
  return discordBotFetch(`/guilds/${guildId}/members/search?query=${encodeURIComponent(query.trim())}&limit=${limit}`)
}

export function normalizeMember(member, roleMap = new Map()) {
  const roleNames = [...(member.roles || [])]
    .map((roleId) => roleMap.get(roleId))
    .filter(Boolean)
    .sort((a, b) => b.position - a.position)
    .map((role) => role.name)

  const discrim = Number(member.user.discriminator || 0) % 5

  return {
    user_id: member.user.id,
    username: member.user.global_name || member.user.username,
    nickname: member.nick || null,
    avatar_hash: member.user.avatar || null,
    avatar_url: member.user.avatar
      ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${discrim}.png`,
    roles: roleNames,
    top_role: roleNames[0] || null,
    joined_at: member.joined_at || null
  }
}
