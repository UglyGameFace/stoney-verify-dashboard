import { createServerSupabase } from "@/lib/supabase-server"
import { discordBotFetch } from "@/lib/discord-api"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export const dynamic = "force-dynamic"

export async function POST(req, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const body = await req.json()

    const message = String(body.message || "").trim()
    const attachments = Array.isArray(body.attachments) ? body.attachments : []

    if (!message) {
      return Response.json(
        { error: "Message content required" },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    const staffName = session?.user?.username || "Dashboard Staff"

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return Response.json(
        { error: ticketError?.message || "Ticket not found" },
        { status: 404 }
      )
    }

    const { error: insertError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticket.id,
        author_id: session.user.id,
        author_name: staffName,
        content: message,
        attachments,
        message_type: "staff"
      })

    if (insertError) {
      return Response.json(
        { error: insertError.message || "Failed to save reply" },
        { status: 500 }
      )
    }

    const { error: ticketUpdateError } = await supabase
      .from("tickets")
      .update({
        updated_at: new Date().toISOString()
      })
      .eq("id", ticket.id)

    if (ticketUpdateError) {
      console.error("Failed to update ticket timestamp:", ticketUpdateError.message)
    }

    const auditPayload = {
      title: "Staff replied to ticket",
      description: `${staffName} replied to ticket ${ticket.id}`,
      event_type: "ticket_reply",
      related_id: ticket.id
    }

    const auditPromise = supabase.from("audit_events").insert(auditPayload)

    let discordMirrorOk = false
    let discordMirrorError = null

    if (ticket.discord_thread_id) {
      try {
        const attachmentLines = attachments.length
          ? [
              "",
              "**Attachments:**",
              ...attachments.map((attachment) => {
                const name = attachment?.name || "attachment"
                const url = attachment?.url || ""
                return url ? `- ${name}: ${url}` : `- ${name}`
              })
            ]
          : []

        await discordBotFetch(
          `/channels/${ticket.discord_thread_id}/messages`,
          {
            method: "POST",
            body: {
              content: [
                `🌿 **Staff Reply — ${staffName}**`,
                "",
                message,
                ...attachmentLines
              ].join("\n")
            }
          }
        )

        discordMirrorOk = true
      } catch (error) {
        discordMirrorError = error.message || "Discord mirror failed"
        console.error("Discord mirror failed:", error)
      }
    }

    await auditPromise

    const response = Response.json({
      ok: true,
      mirroredToDiscord: discordMirrorOk,
      mirrorError: discordMirrorError
    })

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return Response.json(
      { error: error.message || "Reply failed" },
      { status: 500 }
    )
  }
}
