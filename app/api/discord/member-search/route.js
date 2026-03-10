import { searchGuildMembers, fetchGuildRoles, normalizeMember } from "@/lib/discord-api"

export async function GET(request) {
  try {
    const query = new URL(request.url).searchParams.get("q") || ""
    const [roles, members] = await Promise.all([fetchGuildRoles(), searchGuildMembers(query)])
    const roleMap = new Map(roles.map((role) => [role.id, role]))

    const results = members.map((member) => {
      const normalized = normalizeMember(member, roleMap)
      return {
        id: normalized.user_id,
        name: normalized.username,
        nickname: normalized.nickname,
        avatar: normalized.avatar_url,
        roles: normalized.roles,
        top_role: normalized.top_role,
        joinedAt: normalized.joined_at ? new Date(normalized.joined_at).toLocaleString() : null
      }
    })

    return Response.json({ results })
  } catch (error) {
    return Response.json({ error: error.message || "Member search failed." }, { status: 500 })
  }
}
