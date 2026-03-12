import { createServerSupabase } from "@/lib/supabase-server"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"
export const revalidate = 0

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase()
}

function extractRoleSearchTerms(member) {
  const names = []

  if (Array.isArray(member?.role_names)) {
    for (const roleName of member.role_names) {
      if (roleName) names.push(String(roleName))
    }
  }

  if (Array.isArray(member?.roles)) {
    for (const role of member.roles) {
      if (!role) continue

      if (typeof role === "string") {
        names.push(role)
        continue
      }

      if (typeof role === "object" && role.name) {
        names.push(role.name)
      }
    }
  }

  return names
}

function buildHaystack(member) {
  return [
    member.user_id,
    member.username,
    member.display_name,
    member.nickname,
    member.top_role,
    member.highest_role_name,
    ...extractRoleSearchTerms(member)
  ]
    .filter(Boolean)
    .map((value) => normalizeSearchValue(value))
}

function exactScore(member, query) {
  const exactFields = [
    member.user_id,
    member.username,
    member.display_name,
    member.nickname
  ].map(normalizeSearchValue)

  return exactFields.some((value) => value === query) ? 1 : 0
}

function prefixScore(member, query) {
  const fields = [
    member.user_id,
    member.username,
    member.display_name,
    member.nickname,
    member.top_role,
    member.highest_role_name,
    ...extractRoleSearchTerms(member)
  ]
    .filter(Boolean)
    .map(normalizeSearchValue)

  return fields.some((value) => value.startsWith(query)) ? 1 : 0
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const q = String(url.searchParams.get("q") || "").trim()
    const guildId = env.guildId || "demo"

    if (!q) {
      return Response.json({ results: [] })
    }

    const supabase = createServerSupabase()
    const query = normalizeSearchValue(q)

    const { data, error } = await supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .limit(200)

    if (error) {
      return Response.json({ error: error.message || "Search failed" }, { status: 500 })
    }

    const results = (data || [])
      .filter((member) => {
        const haystack = buildHaystack(member)
        return haystack.some((value) => value.includes(query))
      })
      .sort((a, b) => {
        const aExact = exactScore(a, query)
        const bExact = exactScore(b, query)
        if (aExact !== bExact) return bExact - aExact

        const aPrefix = prefixScore(a, query)
        const bPrefix = prefixScore(b, query)
        if (aPrefix !== bPrefix) return bPrefix - aPrefix

        const aInGuild = a.in_guild !== false ? 1 : 0
        const bInGuild = b.in_guild !== false ? 1 : 0
        if (aInGuild !== bInGuild) return bInGuild - aInGuild

        const aVerified = a.has_verified_role ? 1 : 0
        const bVerified = b.has_verified_role ? 1 : 0
        if (aVerified !== bVerified) return bVerified - aVerified

        const aStaff = a.has_staff_role ? 1 : 0
        const bStaff = b.has_staff_role ? 1 : 0
        if (aStaff !== bStaff) return bStaff - aStaff

        const aUpdated = new Date(a.updated_at || a.synced_at || a.joined_at || a.created_at || 0).getTime()
        const bUpdated = new Date(b.updated_at || b.synced_at || b.joined_at || b.created_at || 0).getTime()
        if (aUpdated !== bUpdated) return bUpdated - aUpdated

        const aJoined = new Date(a.joined_at || a.created_at || 0).getTime()
        const bJoined = new Date(b.joined_at || b.created_at || 0).getTime()
        return bJoined - aJoined
      })
      .slice(0, 20)

    return Response.json({ results })
  } catch (error) {
    return Response.json(
      { error: error.message || "Search failed" },
      { status: 500 }
    )
  }
}
