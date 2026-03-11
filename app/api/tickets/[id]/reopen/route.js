import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export const dynamic = "force-dynamic"

export async function POST(req, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
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

    const { data: updatedTicket, error: updateError } = await supabase
      .from("tickets")
      .update({
        status: "open",
        closed_by: null,
        closed_reason: null,
        closed_at: null,
        reopened_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", ticket.id)
      .select("*")
      .single()

    if (updateError || !updatedTicket) {
      return Response.json(
        { error: updateError?.message || "Failed to reopen ticket" },
        { status: 500 }
      )
    }

    await Promise.all([
      supabase.from("audit_events").insert({
        title: "Ticket reopened",
        description: `${staffName} reopened ticket ${ticket.id}`,
        event_type: "ticket_reopened",
        related_id: ticket.id
      }),
      supabase.from("ticket_notes").insert({
        ticket_id: ticket.id,
        staff_id: session.user.id,
        staff_name: staffName,
        content: "Ticket reopened from dashboard"
      })
    ])

    const response = Response.json({
      ok: true,
      ticket: updatedTicket
    })

    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to reopen ticket" },
      { status: 500 }
    )
  }
}
