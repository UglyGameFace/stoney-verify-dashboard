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

function normalizeLower(value) {
  return normalizeString(value).toLowerCase()
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
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

function buildJsonResponse(data, status = 200, refreshedTokens = null) {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })

  applyAuthCookies(response, refreshedTokens)
  return response
}

function buildErrorResponse(message, status = 500, refreshedTokens = null) {
  return buildJsonResponse({ error: message }, status, refreshedTokens)
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

function buildReason(action, requestedReason) {
  const explicit = normalizeString(requestedReason)
  if (explicit) return explicit

  switch (action) {
    case "deny":
      return "Denied by staff review"
    case "remove_unverified":
      return "Unverified role cleanup requested by staff review"
    case "repost_verify_ui":
      return "Verify UI repost requested by staff review"
    case "approve":
    default:
      return "Approved by staff review"
  }
}

function buildNoteLines({
  action,
  staffName,
  staffId,
  reason,
  roleId,
  extra,
}) {
  const lines = [
    "Verification action requested from dashboard.",
    `Action: ${action}`,
    `Staff: ${staffName} (${staffId})`,
    `Reason: ${reason}`,
  ]

  if (roleId) {
    lines.push(`Role ID: ${roleId}`)
  }

  if (Array.isArray(extra)) {
    for (const item of extra) {
      const line = normalizeString(item)
      if (line) lines.push(line)
    }
  }

  return lines
}

async function parseRequestBody(request) {
  try {
    const body = await request.json()
    return safeObject(body)
  } catch {
    return {}
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

async function insertActivityEventSafe(supabase, payload) {
  const candidate = {
    guild_id: payload.guild_id,
    title: payload.title,
    description: payload.description,
    event_family: "ticket",
    event_type: payload.event_type,
    source: "dashboard_ticket_verify",
    actor_user_id: payload.actor_user_id,
    actor_name: payload.actor_name,
    target_user_id: payload.target_user_id,
    target_name: payload.target_name,
    ticket_id: payload.ticket_id,
    channel_id: payload.channel_id,
    metadata: payload.metadata || {},
    created_at: payload.created_at,
  }

  try {
    await supabase.from("activity_feed_events").insert(candidate)
  } catch {
    // best-effort only
  }
}

export async function POST(request, { params }) {
  let refreshedTokens = null

  try {
    const auth = await requireStaffSessionForRoute()
    const session = auth?.session
    refreshedTokens = auth?.refreshedTokens ?? null

    const supabase = createServerSupabase()
    const body = await parseRequestBody(request)

    const ticketId = normalizeString(params?.id)
    if (!ticketId) {
      return buildErrorResponse("Missing ticket id.", 400, refreshedTokens)
    }

    const action = normalizeLower(body?.action)
    const supportedActions = new Set([
      "approve",
      "deny",
      "remove_unverified",
      "repost_verify_ui",
    ])

    if (!supportedActions.has(action)) {
      return buildErrorResponse(
        "Unsupported verification action.",
        400,
        refreshedTokens
      )
    }

    const staffId = normalizeString(body?.staff_id) || getStaffId(session)
    const staffName = getStaffName(session)
    const reason = buildReason(action, body?.reason)
    const roleId = normalizeString(body?.role_id)

    if (!staffId) {
      return buildErrorResponse("Missing staff identity.", 401, refreshedTokens)
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single()

    if (ticketError || !ticket) {
      return buildErrorResponse(
        ticketError?.message || "Ticket not found.",
        404,
        refreshedTokens
      )
    }

    const guildId = normalizeString(env.guildId || env.discordGuildId || ticket?.guild_id || "")
    if (!guildId) {
      return buildErrorResponse(
        "Missing Discord guild id in environment.",
        500,
        refreshedTokens
      )
    }

    const userId = normalizeString(ticket?.user_id)
    if (!userId && action !== "repost_verify_ui") {
      return buildErrorResponse(
        "Ticket is missing user_id.",
        400,
        refreshedTokens
      )
    }

    const channelId = normalizeString(ticket?.channel_id || ticket?.discord_thread_id)
    const username =
      normalizeString(ticket?.username) ||
      normalizeString(ticket?.owner_display_name) ||
      normalizeString(ticket?.title) ||
      "member"

    const commandAction = buildCommandAction(action)
    if (!commandAction) {
      return buildErrorResponse(
        "Could not resolve verification command.",
        400,
        refreshedTokens
      )
    }

    const nowIso = new Date().toISOString()

    const noteLines = buildNoteLines({
      action,
      staffName,
      staffId,
      reason,
      roleId,
      extra: [
        `Ticket ID: ${ticketId}`,
        channelId ? `Channel ID: ${channelId}` : "",
        userId ? `User ID: ${userId}` : "",
      ],
    })

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
        noteResult?.error?.message ||
        "Ticket note could not be saved, but verification continued."
    }

    const commandPayload = {
      guild_id: guildId,
      action: commandAction,
      status: "pending",
      payload: {
        ticket_id: ticketId,
        channel_id: channelId || null,
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
      return buildErrorResponse(
        commandError.message || "Failed to queue verification command.",
        500,
        refreshedTokens
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

    if (action === "approve") {
      await supabase
        .from("tickets")
        .update({
          updated_at: nowIso,
        })
        .eq("id", ticketId)
    }

    await insertActivityEventSafe(supabase, {
      guild_id: guildId,
      title:
        action === "approve"
          ? "Verification Approved"
          : action === "deny"
            ? "Verification Denied"
            : action === "remove_unverified"
              ? "Unverified Role Removal Queued"
              : "Verify UI Repost Queued",
      description: reason,
      event_type: `verification_${action}`,
      actor_user_id: staffId,
      actor_name: staffName,
      target_user_id: userId || null,
      target_name: username,
      ticket_id: ticketId,
      channel_id: channelId || null,
      metadata: {
        command_id: commandRow?.id || null,
        action,
        role_id: roleId || null,
      },
      created_at: nowIso,
    })

    return buildJsonResponse(
      {
        ok: true,
        action,
        ticketId,
        commandId: commandRow?.id || null,
        noteWarning,
        message: buildHumanMessage(action, username),
      },
      200,
      refreshedTokens
    )
  } catch (error) {
    const status =
      error?.status || (error?.message === "Unauthorized" ? 401 : 500)

    return buildErrorResponse(
      error?.message || "Verification route failed.",
      status,
      refreshedTokens
    )
  }
}
