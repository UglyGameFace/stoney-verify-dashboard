import { NextResponse } from "next/server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"
import { createServerSupabase } from "@/lib/supabase-server"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"
export const revalidate = 0

function isoTimeout(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

async function discordApi(path, { method = "GET", body } = {}) {
  const token = process.env.DISCORD_TOKEN || env.discordToken || ""

  if (!token) {
    throw new Error("Missing DISCORD_TOKEN")
  }

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord API ${res.status}: ${text}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function POST(req) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const guildId = env.guildId || ""
    const body = await req.json()

    const action = String(body.action || "").trim().toLowerCase()
    const userId = String(body.user_id || "").trim()
    const reason = String(body.reason || "").trim() || "Action taken from Stoney Verify Dashboard"
    const rawMinutes = Number(body.minutes || 10)
    const timeoutMinutes = Number.isFinite(rawMinutes) ? Math.max(1, Math.min(rawMinutes, 40320)) : 10
    const staffName =
      session?.user?.username ||
      session?.user?.name ||
      env.defaultStaffName ||
      "Dashboard Staff"
    const staffId = session?.user?.id || "unknown"

    if (!guildId) {
      return NextResponse.json({ error: "Missing guild id" }, { status: 500 })
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    if (!["warn", "timeout", "kick", "ban"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (action === "warn") {
      const { error } = await supabase.from("warns").insert({
        guild_id: guildId,
        user_id: userId,
        username: body.username || userId,
        reason: `${reason} — issued by ${staffName}`,
        source_message: null
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    if (action === "timeout") {
      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH",
        body: {
          communication_disabled_until: isoTimeout(timeoutMinutes)
        }
      })
    }

    if (action === "kick") {
      await discordApi(`/guilds/${guildId}/members/${userId}`, {
        method: "DELETE"
      })
    }

    if (action === "ban") {
      await discordApi(`/guilds/${guildId}/bans/${userId}`, {
        method: "PUT",
        body: {
          delete_message_seconds: 0
        }
      })
    }

    await supabase.from("audit_events").insert({
      title: `Member ${action}`,
      description:
        `${staffName} performed ${action} on ${userId}` +
        (action === "timeout" ? ` for ${timeoutMinutes} minute(s)` : "") +
        `. Reason: ${reason}`,
      event_type: `member_${action}`,
      related_id: userId
    })

    const response = NextResponse.json({
      ok: true,
      action,
      user_id: userId,
      timeout_minutes: action === "timeout" ? timeoutMinutes : null,
      staff_id: staffId
    })

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Moderation action failed" },
      { status: 500 }
    )
  }
}
