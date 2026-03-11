import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export const dynamic = "force-dynamic"

export async function POST(req, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const supabase = createServerSupabase()
    const body = await req.json()

    const nextAssignee = String(body.assigned_to || "").trim()
    const reason = String(body.reason || "").trim()
    const staffName = session?.user?.username || "Dashboard Staff"

    if (!nextAssignee) {
      return Response.json(
        { error: "assigned_to is required" },
        { status: 400 }
      )
    }

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
        assigned_to: nextAssignee,
        claimed_by: nextAssignee,
        status: "claimed",
        updated_at: new Date().toISOString()
      })
      .eq("id", ticket.id)
      .select("*")
      .single()

    if (updateError || !updatedTicket) {
      return Response.json(
        { error: updateError?.message || "Failed to transfer ticket" },
        { status: 500 }
      )
    }

    const noteText = reason
      ? `Ticket transferred to ${nextAssignee}. Reason: ${reason}`
      : `Ticket transferred to ${nextAssignee}.`

    await Promise.all([
      supabase.from("audit_events").insert({
        title: "Ticket transferred",
        description: `${staffName
