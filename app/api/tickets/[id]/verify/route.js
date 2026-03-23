import { createServerSupabase } from "@/lib/supabase-server"
import {
  requireStaffSessionForRoute,
  applyAuthCookies,
} from "@/lib/auth-server"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"
export const revalidate = 0

function normalizeString(value) {
  return String(value || "").trim()
}

function getSessionUser(session) {
  return session?.user || session?.discordUser || session?.staffUser || null
}

function getStaffId(session) {
  const user = getSessionUser(session)
  return normalizeString(
    user?.id ||
      user?.user_id ||
      user?.discord_id ||
      session?.discordUser?.id ||
      ""
  )
}

function getStaffName(session) {
  const user = getSessionUser(session)
  return normalizeString(
    user?.global_name ||
      user?.display_name ||
      user?.username ||
      user?.name ||
      session?.discordUser?.username ||
      env.defaultStaffName ||
      "Dashboard Staff"
  )
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })
}

function buildCommandAction(action) {
  switch (action) {
    case "approve":
      return "approve_verification"
    case "deny":
      return "deny_verification"
    case "remove_unverified":
      return "remove_unverified_role"
    case "repost_verify_ui":
      return "repost_verify_ui"
    default:
      return ""
  }
}

function buildHumanMessage(action, username) {
  switch (action) {
    case "approve":
      return `Verification approval queued for ${username || "member"}.`
    case "deny":
      return `Verification denial queued for ${username || "member"}.`
    case "remove_unverified":
      return `Unverified-role removal queued for ${username || "member"}.`
    case "repost_verify_ui":
      return `Verify UI repost queued for ${username || "member"}.`
    default:
      return "Verification action queued."
  }
}

async function insertTicketNoteSafe(supabase, payload) {
  const attempts = [
    {
      ticket_id: payload.ticket_id,
      staff_id: payload.staff_id,
      staff_name: payload.staff_name,
      content: payload.content,
      created_at: payload.created_at,
    },
    {
      ticket_id: payload.ticket_id,
      staff_id: payload.staff_id,
      content: payload.content,
      created_at: payload.created_at,
    },
    {
      ticket_id: payload.ticket_id,
      content: payload.content,
      created_at: payload.created_at,
    },
    {
      ticket_id: payload.ticket_id,
      content: payload.content,
    },
  ]

  let lastError = null

  for (const candidate of attempts) {
    const { error } = await supabase.from("ticket_notes").insert(candidate)
    if (!error) {
      return { ok: true }
    }
    lastError = error
  }

  return { ok: false, error: lastError }
}

export async function POST(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()

    const ticketId = normalizeString(params?.id)
    if (!ticketId) {
      return json({ error: "Missing ticket id." }, 400)
    }

    const body = await request.json().catch(() => ({}))
    const action = normalizeString(body?.action).toLowerCase()
    const staffId = normalizeString(body?.staff_id) || getStaffId(session)
    const staffName = getStaffName(session)
    const reason =
      normalizeString(body?.reason) ||
      (action === "deny" ? "Denied by staff review" : "Approved by staff review")
    const roleId = normalizeString(body?.role_id)

    if (!staffId) {
      return json({ error: "Missing staff identity." }, 401)
    }

    const supportedActions = new Set([
      "approve",
      "deny",
      "remove_unverified",
      "repost_verify_ui",
    ])

    if (!supportedActions.has(action)) {
      return json({ error: "Unsupported verification action." }, 400)
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single()

    if (ticketError || !ticket) {
      return json({ error: ticketError?.message || "Ticket not found." }, 404)
    }

    const guildId = normalizeString(env.guildId || env.discordGuildId || "")
    if (!guildId) {
      return json({ error: "Missing Discord guild id in environment." }, 500)
    }

    const userId = normalizeString(ticket?.user_id)
    if (!userId && action !== "repost_verify_ui") {
      return json({ error: "Ticket is missing user_id." }, 400)
    }

    const username =
      normalizeString(ticket?.username) ||
      normalizeString(ticket?.title) ||
      "member"

    const commandAction = buildCommandAction(action)
    if (!commandAction) {
      return json({ error: "Could not resolve verification command." }, 400)
    }

    const nowIso = new Date().toISOString()

    const noteLines = [
      "Verification action requested from dashboard.",
      `Action: ${action}`,
      `Staff: ${staffName} (${staffId})`,
      `Reason: ${reason}`,
    ]

    if (roleId) {
      noteLines.push(`Role ID: ${roleId}`)
    }

    const noteResult = await insertTicketNoteSafe(supabase, {
      ticket_id: ticketId,
      staff_id: staffId,
      staff_name: staffName,
      content: noteLines.join("\n"),
      created_at: nowIso,
    })

    let noteWarning = null
    if (!noteResult.ok) {
      noteWarning =
        noteResult?.error?.message || "Ticket note could not be saved, but verification continued."
    }

    const commandPayload = {
      guild_id: guildId,
      action: commandAction,
      status: "pending",
      payload: {
        ticket_id: ticketId,
        channel_id: normalizeString(ticket?.channel_id || ticket?.discord_thread_id || ""),
        user_id: userId || null,
        username,
        requester_id: staffId,
        staff_id: staffId,
        staff_name: staffName,
        reason,
        role_id: roleId || null,
        source: "dashboard_ticket_verify",
      },
      created_at: nowIso,
    }

    const { data: commandRow, error: commandError } = await supabase
      .from("bot_commands")
      .insert(commandPayload)
      .select("id")
      .single()

    if (commandError) {
      return json(
        { error: commandError.message || "Failed to queue verification command." },
        500
      )
    }

    if (action === "deny") {
      await supabase
        .from("tickets")
        .update({
          status: "closed",
          closed_reason: reason,
          closed_by: staffId,
          updated_at: nowIso,
        })
        .eq("id", ticketId)
    }

    const response = json({
      ok: true,
      action,
      ticketId,
      commandId: commandRow?.id || null,
      noteWarning,
      message: buildHumanMessage(action, username),
    })

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    const status = error?.status || (error?.message === "Unauthorized" ? 401 : 500)
    return json({ error: error?.message || "Verification route failed." }, status)
  }
}
