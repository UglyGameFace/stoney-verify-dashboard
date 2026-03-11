import { createServerSupabase } from "@/lib/supabase-server"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const q = String(url.searchParams.get("q") || "").trim()
    const guildId = env.guildId || "demo"

    if (!q) {
      return Response.json({ results: [] })
    }

    const supabase = createServerSupabase()
    const query = q.toLowerCase()

    const { data, error } = await supabase
      .from("guild_members")
      .select("*")
      .eq("guild_id", guildId)
      .limit(100)

    if (error) {
      return Response.json({ error: error.message || "Search failed" }, { status: 500 })
    }

    const results = (data || [])
      .filter((member) => {
        const haystack = [
          member.user_id,
          member.username,
          member.display_name,
          member.nickname,
          member.top_role,
          member.highest_role_name,
          ...(Array.isArray(member.role_names) ? member.role_names : []),
          ...(Array.isArray(member.roles) ? member.roles : [])
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase())

        return haystack.some((value) => value.includes(query))
      })
      .sort((a, b) => {
        const aExact =
          String(a.user_id || "").toLowerCase() === query ||
          String(a.username || "").toLowerCase() === query ||
          String(a.display_name || "").toLowerCase() === query

        const bExact =
          String(b.user_id || "").toLowerCase() === query ||
          String(b.username || "").toLowerCase() === query ||
          String(b.display_name || "").toLowerCase() === query

        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1

        const aInGuild = a.in_guild !== false ? 1 : 0
        const bInGuild = b.in_guild !== false ? 1 : 0
        if (aInGuild !== bInGuild) return bInGuild - aInGuild

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
