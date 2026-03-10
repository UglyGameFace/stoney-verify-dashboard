import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function POST(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase.from("ticket_notes").insert({
      ticket_id: params.id,
      staff_id: session.user.id,
      staff_name: session.user.username,
      content: body.content
    }).select("*").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("audit_events").insert({
      title: "Staff note added",
      description: `${session.user.username} added internal note to ticket ${params.id}`,
      event_type: "ticket_note",
      related_id: params.id
    })

    const response = NextResponse.json({ note: data })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
