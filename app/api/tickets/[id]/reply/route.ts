import { createServerSupabase } from "@/lib/supabase-server"
import { discordBotFetch } from "@/lib/discord-api"

export const dynamic = "force-dynamic"

export async function POST(req, { params }) {
  try {
    const body = await req.json()
    const { message, staff } = body

    if (!message) {
      return Response.json(
        { error: "Message content required" },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", params.id)
      .single()

    if (ticketError || !ticket) {
      return Response.json(
        { error: "Ticket not found" },
        { status: 404 }
      )
    }

    const { error: insertError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticket.id,
        author_name: staff || "Dashboard Staff",
        content: message,
        message_type: "staff"
      })

    if (insertError) {
      return Response.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    if (ticket.discord_thread_id) {
      try {
        await discordBotFetch(
          `/channels/${ticket.discord_thread_id}/messages`,
          {
            method: "POST",
            body: {
              content: `🌿 **Staff:** ${staff || "Dashboard Staff"}\n${message}`
            }
          }
        )
      } catch (err) {
        console.error("Discord mirror failed", err)
      }
    }

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { error: error.message || "Reply failed" },
      { status: 500 }
    )
  }
}
