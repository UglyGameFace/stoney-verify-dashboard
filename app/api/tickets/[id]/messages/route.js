import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireStaffSessionForRoute, applyAuthCookies } from "@/lib/auth-server"

export async function GET(request, { params }) {
  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data || [] })
}

export async function POST(request, { params }) {
  try {
    const { session, refreshedTokens } = await requireStaffSessionForRoute()
    const body = await request.json()
    const supabase = createServerSupabase()

    const { data, error } = await supabase.from("ticket_messages").insert({
      ticket_id: params.id,
      author_id: session.user.id,
      author_name: session.user.username,
      content: body.content,
      message_type: body.message_type || "staff"
    }).select("*").single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await Promise.all([
      supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", params.id),
      supabase.from("audit_events").insert({
        title: "Ticket reply added",
        description: `${session.user.username} replied to ticket ${params.id}`,
        event_type: "ticket_reply",
        related_id: params.id
      })
    ])

    const response = NextResponse.json({ message: data })
    applyAuthCookies(response, refreshedTokens)
    return response
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
